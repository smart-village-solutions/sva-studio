import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  insertContentRow: vi.fn(),
  insertHistory: vi.fn(),
  updateRevision: vi.fn(),
  emitCreated: vi.fn(),
  emitUpdated: vi.fn(),
  emitOwnershipTransferred: vi.fn(),
  validatePublicationWindow: vi.fn(),
  loadContentById: vi.fn(),
  updateContent: vi.fn(),
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('../iam-account-management/shared.js', () => ({
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

vi.mock('./repository-shared.js', () => ({
  insertContentHistory: state.insertHistory,
}));

vi.mock('./repository-write-helpers.js', () => ({
  emitContentCreatedActivity: state.emitCreated,
  emitExternalContentUpdatedActivity: state.emitUpdated,
  emitContentOwnershipTransferredActivity: state.emitOwnershipTransferred,
  insertContentRow: state.insertContentRow,
  updateContentRevisionRefs: state.updateRevision,
  validatePublicationWindow: state.validatePublicationWindow,
}));

vi.mock('./repository.js', () => ({
  loadContentById: state.loadContentById,
  updateContent: state.updateContent,
}));

import {
  bindExternalContentReference,
  createExternalContentReference,
  listExternalContentReferences,
  loadExternalContentCore,
  loadExternalContentReferenceByContentId,
  loadExternalContentReferenceByOperation,
  loadExternalContentReferenceBySourceEntity,
  prepareExternalContent,
  updateExternalContentCore,
  updateExternalContentReconciliationStatus,
  withExternalContentMutationLock,
} from './external-content-references.js';
import {
  recordSuccessfulExternalContentDeletion,
  recordSuccessfulExternalContentMutation,
} from './external-content-mutations.js';

const row = {
  id: 'reference-1',
  instance_id: 'tenant-1',
  content_id: 'content-1',
  source_system: 'mainserver',
  source_entity_type: 'GenericItem',
  source_entity_id: null,
  operation_external_id: 'operation-1',
  reconciliation_status: 'pending' as const,
  last_error_code: null,
};

describe('external content references', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.withInstanceScopedDb.mockImplementation(
      (_instanceId: string, execute: (client: { query: typeof state.query }) => unknown) =>
        execute({ query: state.query })
    );
    state.insertContentRow.mockResolvedValue('content-1');
    state.insertHistory.mockResolvedValue('history-1');
  });

  it('prepares the content core and unbound reference on the same scoped client', async () => {
    state.query.mockResolvedValueOnce({ rows: [row] });

    await expect(
      prepareExternalContent({
        instanceId: 'tenant-1',
        actorAccountId: 'account-1',
        actorDisplayName: 'Redaktion',
        contentType: 'projects.project',
        title: 'Projekt',
        payload: { language: 'de', status: 'draft', deleted: false },
        status: 'draft',
        authorDisplayMode: 'organization',
        sourceSystem: 'mainserver',
        sourceEntityType: 'GenericItem',
        operationExternalId: 'operation-1',
      })
    ).resolves.toEqual({
      contentId: 'content-1',
      reference: {
        id: 'reference-1',
        instanceId: 'tenant-1',
        contentId: 'content-1',
        sourceSystem: 'mainserver',
        sourceEntityType: 'GenericItem',
        operationExternalId: 'operation-1',
        reconciliationStatus: 'pending',
      },
    });
    expect(state.insertContentRow).toHaveBeenCalled();
    expect(state.insertHistory).toHaveBeenCalled();
    expect(state.updateRevision).toHaveBeenCalledWith(
      expect.objectContaining({ query: state.query }),
      'tenant-1',
      'content-1',
      'history-1'
    );
    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO iam.external_content_references'),
      ['tenant-1', 'content-1', 'mainserver', 'GenericItem', 'operation-1']
    );
  });

  it('binds provider identity and lists reusable references', async () => {
    state.query
      .mockResolvedValueOnce({
        rows: [{ ...row, source_entity_id: 'external-1', reconciliation_status: 'bound' }],
      })
      .mockResolvedValueOnce({
        rows: [{ ...row, source_entity_id: 'external-1', reconciliation_status: 'bound' }],
      });

    await expect(
      bindExternalContentReference({
        instanceId: 'tenant-1',
        referenceId: 'reference-1',
        sourceEntityId: 'external-1',
      })
    ).resolves.toEqual(
      expect.objectContaining({ sourceEntityId: 'external-1', reconciliationStatus: 'bound' })
    );
    await expect(
      listExternalContentReferences({
        instanceId: 'tenant-1',
        sourceSystem: 'mainserver',
        sourceEntityType: 'GenericItem',
      })
    ).resolves.toHaveLength(1);
  });

  it('persists reconciliation state and serializes the complete mutation callback', async () => {
    state.query.mockResolvedValue({ rows: [] });
    await updateExternalContentReconciliationStatus({
      instanceId: 'tenant-1',
      referenceId: 'reference-1',
      status: 'reconciliation_required',
      errorCode: 'provider_result_unknown',
    });
    const execute = vi.fn(async () => 'done');
    await expect(
      withExternalContentMutationLock({
        instanceId: 'tenant-1',
        referenceId: 'reference-1',
        execute,
      })
    ).resolves.toBe('done');
    expect(state.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));',
      ['tenant-1', 'reference-1']
    );
    expect(execute).toHaveBeenCalledOnce();
  });

  it('creates and loads references through both stable lookup keys', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [{ ...row, last_error_code: 'retry' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      createExternalContentReference({
        instanceId: 'tenant-1',
        contentId: 'content-1',
        sourceSystem: 'mainserver',
        sourceEntityType: 'GenericItem',
        operationExternalId: 'operation-1',
      })
    ).resolves.toEqual(expect.objectContaining({ operationExternalId: 'operation-1' }));

    await expect(
      loadExternalContentReferenceByContentId({
        instanceId: 'tenant-1',
        contentId: 'content-1',
        sourceSystem: 'mainserver',
        sourceEntityType: 'GenericItem',
      })
    ).resolves.toEqual(expect.objectContaining({ lastErrorCode: 'retry' }));

    await expect(
      loadExternalContentReferenceByOperation({
        instanceId: 'tenant-1',
        sourceSystem: 'mainserver',
        sourceEntityType: 'GenericItem',
        operationExternalId: 'missing',
      })
    ).resolves.toBeUndefined();
  });

  it('loads a reference by its provider identity', async () => {
    state.query.mockResolvedValueOnce({
      rows: [{ ...row, source_entity_id: 'external-1', reconciliation_status: 'bound' }],
    });

    await expect(
      loadExternalContentReferenceBySourceEntity({
        instanceId: 'tenant-1',
        sourceSystem: 'mainserver',
        sourceEntityType: 'GenericItem',
        sourceEntityId: 'external-1',
      })
    ).resolves.toEqual(
      expect.objectContaining({ contentId: 'content-1', sourceEntityId: 'external-1' })
    );
  });

  it('resolves project reads through GenericItem and older project references', async () => {
    state.query.mockResolvedValueOnce({
      rows: [{ ...row, source_entity_type: 'GenericItem', source_entity_id: 'project-1' }],
    });

    await expect(loadExternalContentReferenceBySourceEntity({
      instanceId: 'tenant-1',
      sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project',
      sourceEntityId: 'project-1',
    })).resolves.toEqual(expect.objectContaining({ contentId: 'content-1' }));
    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY array_position($3::text[], source_entity_type)'),
      ['tenant-1', 'mainserver', ['GenericItem', 'projects.project'], 'project-1']
    );
  });

  it('records a successful provider mutation against an existing content core', async () => {
    state.query.mockResolvedValueOnce({
      rows: [{ ...row, source_entity_id: 'external-1', reconciliation_status: 'bound' }],
    });
    state.updateContent.mockResolvedValue('content-1');

    await expect(
      recordSuccessfulExternalContentMutation({
        instanceId: 'tenant-1',
        actorAccountId: 'account-1',
        actorDisplayName: 'Redaktion',
        mutationRef: 'request-1',
        operation: 'update',
        sourceSystem: 'mainserver',
        sourceEntityType: 'GenericItem',
        sourceEntityId: 'external-1',
        contentType: 'generic-items.generic-item',
        title: 'Eintrag',
        payload: { status: 'published' },
        status: 'published',
        authorDisplayMode: 'user',
        authorDisplayName: 'Redaktion',
      })
    ).resolves.toBe('content-1');
    expect(state.updateContent).toHaveBeenCalledWith(
      expect.objectContaining({ contentId: 'content-1', mutationRef: 'request-1' })
    );
    expect(state.query).toHaveBeenCalledWith(expect.stringContaining("source_system = 'iam'"), [
      'tenant-1',
      'content-1',
    ]);
  });

  it('forwards a confirmed transfer target to the existing content core', async () => {
    state.query.mockResolvedValueOnce({
      rows: [{ ...row, source_entity_id: 'external-1', reconciliation_status: 'bound' }],
    });
    state.updateContent.mockResolvedValue('content-1');

    await recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'transfer-1',
      operation: 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: 'GenericItem',
      sourceEntityId: 'external-1',
      contentType: 'generic-items.generic-item',
      organizationId: 'organization-1',
      ownershipPrincipal: { type: 'organization', id: 'organization-1' },
      title: 'Eintrag',
      payload: {},
      status: 'draft',
      authorDisplayMode: 'organization',
      authorDisplayName: 'Organisation',
    });

    const update = state.updateContent.mock.calls[0]?.[0];
    expect(update).toEqual(expect.objectContaining({
      confirmedExternalOwner: { type: 'organization', id: 'organization-1' },
      preserveExistingContentState: true,
    }));
    expect(update).not.toHaveProperty('title');
    expect(update).not.toHaveProperty('payload');
    expect(update).not.toHaveProperty('status');
  });

  it('updates the existing GenericItem Core reference for a project transfer', async () => {
    state.query
      .mockResolvedValueOnce({
        rows: [{ ...row, source_entity_id: 'project-1', reconciliation_status: 'bound' }],
      })
      .mockResolvedValue({ rows: [] });
    state.updateContent.mockResolvedValue('content-1');

    await recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'project-transfer-1',
      operation: 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project',
      sourceEntityId: 'project-1',
      contentType: 'projects.project',
      ownershipPrincipal: { type: 'organization', id: 'organization-1' },
      title: 'Projekt',
      payload: { body: 'Vollständiger Inhalt' },
      status: 'published',
      authorDisplayMode: 'organization',
      authorDisplayName: 'Organisation',
    });

    expect(state.query).toHaveBeenCalledWith(expect.stringContaining('source_entity_type = ANY($3::text[])'), [
      'tenant-1', 'mainserver', ['GenericItem'], 'project-1',
    ]);
    expect(state.insertContentRow).not.toHaveBeenCalled();
    expect(state.updateContent).toHaveBeenCalledWith(expect.objectContaining({
      contentId: 'content-1',
      confirmedExternalOwner: { type: 'organization', id: 'organization-1' },
      preserveExistingContentState: true,
    }));
  });

  it('falls back to an existing projects.project Core reference', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...row, source_entity_type: 'projects.project', source_entity_id: 'project-1' }],
      });
    state.updateContent.mockResolvedValue('content-1');

    await recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'project-transfer-1',
      operation: 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project',
      sourceEntityId: 'project-1',
      contentType: 'projects.project',
      ownershipPrincipal: { type: 'organization', id: 'organization-1' },
      title: 'Projekt',
      payload: { body: 'Vollständiger Inhalt' },
      status: 'published',
      authorDisplayMode: 'organization',
      authorDisplayName: 'Organisation',
    });

    expect(state.query).toHaveBeenCalledWith(expect.stringContaining('source_entity_type = ANY($3::text[])'), [
      'tenant-1', 'mainserver', ['projects.project'], 'project-1',
    ]);
    expect(state.insertContentRow).not.toHaveBeenCalled();
    expect(state.updateContent).toHaveBeenCalledWith(expect.objectContaining({
      contentId: 'content-1',
      preserveExistingContentState: true,
    }));
  });

  it('updates both distinct project Cores before completing a confirmed transfer', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [{ ...row, content_id: 'canonical-core', source_entity_id: 'project-1' }] })
      .mockResolvedValueOnce({ rows: [{ ...row, content_id: 'legacy-core', source_entity_type: 'projects.project', source_entity_id: 'project-1' }] })
      .mockResolvedValue({ rows: [] });
    state.updateContent.mockResolvedValue('updated');

    await expect(recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1', actorAccountId: 'account-1', actorDisplayName: 'Redaktion',
      mutationRef: 'project-transfer-1', operation: 'update', sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project', sourceEntityId: 'project-1',
      contentType: 'projects.project',
      ownershipPrincipal: { type: 'organization', id: 'organization-1' },
      title: 'Projekt', payload: {}, status: 'draft',
      authorDisplayMode: 'organization', authorDisplayName: 'Organisation',
    })).resolves.toBe('canonical-core');

    expect(state.updateContent.mock.calls.map(([input]) => input.contentId)).toEqual([
      'canonical-core', 'legacy-core',
    ]);
  });

  it('keeps a dual-reference transfer unresolved if the second Core update fails', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [{ ...row, content_id: 'canonical-core', source_entity_id: 'project-1' }] })
      .mockResolvedValueOnce({ rows: [{ ...row, content_id: 'legacy-core', source_entity_type: 'projects.project', source_entity_id: 'project-1' }] })
      .mockResolvedValue({ rows: [] });
    state.updateContent
      .mockResolvedValueOnce('canonical-core')
      .mockRejectedValueOnce(new Error('legacy_core_unavailable'));

    await expect(recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1', actorAccountId: 'account-1', actorDisplayName: 'Redaktion',
      mutationRef: 'project-transfer-1', operation: 'update', sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project', sourceEntityId: 'project-1',
      contentType: 'projects.project',
      ownershipPrincipal: { type: 'organization', id: 'organization-1' },
      title: 'Projekt', payload: {}, status: 'draft',
      authorDisplayMode: 'organization', authorDisplayName: 'Organisation',
    })).rejects.toThrow('legacy_core_unavailable');
  });

  it('keeps normal project archive updates on their existing project reference', async () => {
    state.query.mockResolvedValueOnce({
      rows: [{ ...row, source_entity_type: 'projects.project', source_entity_id: 'project-1' }],
    });
    state.updateContent.mockResolvedValue('content-1');

    await recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'project-archive-1',
      operation: 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project',
      sourceEntityId: 'project-1',
      contentType: 'projects.project',
      title: 'Projekt',
      payload: { body: 'Bestehender Inhalt' },
      status: 'archived',
      authorDisplayMode: 'organization',
      authorDisplayName: 'Organisation',
    });

    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('source_entity_type = ANY($3::text[])'),
      ['tenant-1', 'mainserver', ['projects.project'], 'project-1']
    );
    expect(state.updateContent).toHaveBeenCalledWith(expect.objectContaining({
      status: 'archived',
      payload: { body: 'Bestehender Inhalt' },
    }));
  });

  it('does not create or overwrite a transfer-bound project Core after a normal archive', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...row, source_entity_type: 'GenericItem', source_entity_id: 'project-1' }],
      })
      .mockResolvedValueOnce({ rows: [{ updated: true }] });

    await expect(recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'project-archive-1',
      operation: 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project',
      sourceEntityId: 'project-1',
      contentType: 'projects.project',
      title: 'Projekt',
      payload: { body: 'Slim-Projektion' },
      status: 'draft',
      authorDisplayMode: 'organization',
      authorDisplayName: 'Organisation',
    })).resolves.toBe('content-1');

    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('source_entity_type = ANY($3::text[])'),
      ['tenant-1', 'mainserver', ['GenericItem'], 'project-1']
    );
    expect(state.insertContentRow).not.toHaveBeenCalled();
    expect(state.updateContent).not.toHaveBeenCalled();
  });

  it('preserves a created project Core when journal and idempotency IDs differ', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...row, operation_external_id: 'create-idempotency-1',
          source_entity_type: 'GenericItem', source_entity_id: 'project-1' }],
      })
      .mockResolvedValueOnce({ rows: [{ updated: true }] });

    await expect(recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1', actorAccountId: 'account-1', actorDisplayName: 'Redaktion',
      mutationRef: 'journal-create-1', operation: 'create', sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project', sourceEntityId: 'project-1',
      contentType: 'projects.project', title: 'Projekt', payload: { body: 'Slim' },
      status: 'published', authorDisplayMode: 'organization', authorDisplayName: 'Organisation',
    })).resolves.toBe('content-1');

    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining("completed_steps ? 'project_core_updated'"),
      ['tenant-1', 'journal-create-1']
    );
    expect(state.updateContent).not.toHaveBeenCalled();
    expect(state.insertContentRow).not.toHaveBeenCalled();
  });

  it('keeps a failed project route Core update unresolved', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...row, source_entity_id: 'project-1' }] })
      .mockResolvedValueOnce({ rows: [{ updated: false }] });
    await expect(recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1', actorAccountId: 'account-1', actorDisplayName: 'Redaktion',
      mutationRef: 'project-archive-1', operation: 'update', sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project', sourceEntityId: 'project-1',
      contentType: 'projects.project', title: 'Projekt', payload: { body: 'Slim' },
      status: 'archived', authorDisplayMode: 'organization', authorDisplayName: 'Organisation',
    })).rejects.toThrow('project_core_full_update_unverified');
    expect(state.updateContent).not.toHaveBeenCalled();
  });

  it('does not attribute a newer provider payload to a deferred transfer', async () => {
    state.query.mockResolvedValueOnce({
      rows: [{ ...row, source_entity_id: 'external-1', reconciliation_status: 'bound' }],
    });
    state.updateContent.mockResolvedValue('content-1');

    await recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'transfer-1',
      operation: 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: 'GenericItem',
      sourceEntityId: 'external-1',
      contentType: 'generic-items.generic-item',
      ownershipPrincipal: { type: 'organization', id: 'organization-1' },
      preserveExistingContentState: true,
      title: 'Später bearbeitet',
      payload: { body: 'Neue Fassung' },
      status: 'published',
      authorDisplayMode: 'organization',
      authorDisplayName: 'Organisation',
    });

    const update = state.updateContent.mock.calls[0]?.[0];
    expect(update).toEqual(expect.objectContaining({
      confirmedExternalOwner: { type: 'organization', id: 'organization-1' },
      preserveExistingContentState: true,
      mutationRef: 'transfer-1',
    }));
    expect(update).not.toHaveProperty('title');
    expect(update).not.toHaveProperty('payload');
    expect(update).not.toHaveProperty('status');
  });

  it('leaves an owner-only replay unresolved without an existing Core reference', async () => {
    state.query.mockResolvedValueOnce({ rows: [] });

    await expect(recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'transfer-1',
      operation: 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: 'GenericItem',
      sourceEntityId: 'external-1',
      contentType: 'generic-items.generic-item',
      ownershipPrincipal: { type: 'organization', id: 'organization-1' },
      preserveExistingContentState: true,
      title: 'Später bearbeitet',
      payload: { body: 'Neue Fassung' },
      status: 'published',
      authorDisplayMode: 'organization',
      authorDisplayName: 'Organisation',
    })).rejects.toThrow('external_content_core_reference_required_for_owner_only_replay');

    expect(state.insertContentRow).not.toHaveBeenCalled();
    expect(state.insertHistory).not.toHaveBeenCalled();
    expect(state.updateContent).not.toHaveBeenCalled();
  });

  it('records an idempotently correlated delete in host-owned studio history', async () => {
    state.query
      .mockResolvedValueOnce({
        rows: [{ ...row, source_entity_id: 'external-1', reconciliation_status: 'bound' }],
      })
      .mockResolvedValueOnce({
        rows: [{ payload_json: { title: 'Eintrag' }, status: 'published' }],
      })
      .mockResolvedValue({ rows: [] });

    await expect(
      recordSuccessfulExternalContentDeletion({
        instanceId: 'tenant-1',
        actorAccountId: 'account-1',
        actorDisplayName: 'Redaktion',
        mutationRef: 'operation-delete-1',
        sourceSystem: 'mainserver',
        sourceEntityType: 'GenericItem',
        sourceEntityId: 'external-1',
      })
    ).resolves.toBe(true);

    expect(state.insertHistory).toHaveBeenCalledWith(
      expect.objectContaining({ query: state.query }),
      expect.objectContaining({
        action: 'status_changed',
        mutationRef: 'operation-delete-1',
        previousStatus: 'published',
        nextStatus: 'archived',
        summary: 'Inhalt im Mainserver gelöscht',
      })
    );
    expect(state.updateRevision).toHaveBeenCalledWith(
      expect.objectContaining({ query: state.query }),
      'tenant-1',
      'content-1',
      'history-1'
    );
    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'archived', updater_account_id = $3::uuid"),
      ['tenant-1', 'content-1', 'account-1']
    );
  });

  it('archives both canonical and legacy project Cores when both references exist', async () => {
    state.query
      .mockResolvedValueOnce({
        rows: [{ ...row, content_id: 'canonical-core', source_entity_id: 'project-1' }],
      })
      .mockResolvedValueOnce({ rows: [{ payload_json: {}, status: 'published' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...row, content_id: 'legacy-core', source_entity_type: 'projects.project', source_entity_id: 'project-1' }],
      })
      .mockResolvedValueOnce({ rows: [{ payload_json: {}, status: 'published' }] })
      .mockResolvedValue({ rows: [] });

    for (const sourceEntityType of ['GenericItem', 'projects.project']) {
      await expect(recordSuccessfulExternalContentDeletion({
        instanceId: 'tenant-1',
        actorAccountId: 'account-1',
        actorDisplayName: 'Redaktion',
        mutationRef: 'project-delete-1',
        sourceSystem: 'mainserver',
        sourceEntityType,
        sourceEntityId: 'project-1',
      })).resolves.toBe(true);
    }

    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('source_entity_type = ANY($3::text[])'),
      ['tenant-1', 'mainserver', ['projects.project'], 'project-1']
    );
    expect(state.insertHistory.mock.calls.map((call) => call[1].contentId)).toEqual([
      'canonical-core', 'legacy-core',
    ]);
    expect(state.updateRevision).toHaveBeenCalledTimes(2);
  });

  it('creates and binds a local core for the first successful provider mutation', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      recordSuccessfulExternalContentMutation({
        instanceId: 'tenant-1',
        actorAccountId: 'account-1',
        actorDisplayName: 'Redaktion',
        mutationRef: 'request-1',
        operation: 'create',
        sourceSystem: 'mainserver',
        sourceEntityType: 'GenericItem',
        sourceEntityId: 'external-1',
        contentType: 'generic-items.generic-item',
        title: 'Eintrag',
        payload: { status: 'draft' },
        status: 'draft',
        authorDisplayMode: 'user',
        authorDisplayName: 'Redaktion',
      })
    ).resolves.toBe('content-1');
    expect(state.insertHistory).toHaveBeenCalledWith(
      expect.objectContaining({ query: state.query }),
      expect.objectContaining({ mutationRef: 'request-1', action: 'created' })
    );
    expect(state.emitCreated).toHaveBeenCalledWith(
      expect.objectContaining({ query: state.query }),
      expect.objectContaining({ mutationRef: 'request-1' }),
      'content-1'
    );
    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining("SET source_entity_id = $3, reconciliation_status = 'bound'"),
      ['tenant-1', 'reference-1', 'external-1']
    );
    expect(state.query).toHaveBeenLastCalledWith(expect.stringContaining("source_system = 'iam'"), [
      'tenant-1',
      'content-1',
    ]);
  });

  it('uses the confirmed personal target when a transfer first binds a local core', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });

    await recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1',
      actorAccountId: 'account-source',
      actorDisplayName: 'Redaktion',
      mutationRef: 'transfer-1',
      operation: 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: 'GenericItem',
      sourceEntityId: 'external-1',
      contentType: 'generic-items.generic-item',
      ownershipPrincipal: { type: 'account', id: 'account-target' },
      title: 'Eintrag',
      payload: {},
      status: 'draft',
      authorDisplayMode: 'user',
      authorDisplayName: 'Redaktion',
    });

    expect(state.insertContentRow).toHaveBeenCalledWith(
      expect.objectContaining({ query: state.query }),
      expect.objectContaining({
        actorAccountId: 'account-source',
        confirmedExternalOwner: { type: 'account', id: 'account-target' },
      })
    );
    expect(state.insertHistory).toHaveBeenCalledWith(
      expect.objectContaining({ query: state.query }),
      expect.objectContaining({
        mutationRef: 'transfer-1',
        summary: 'Inhaber übertragen',
        changedFields: expect.arrayContaining([
          'organizationId',
          'ownerUserId',
          'ownerOrganizationId',
        ]),
      })
    );
    expect(state.emitOwnershipTransferred).toHaveBeenCalledWith(
      expect.objectContaining({ query: state.query }),
      expect.objectContaining({
        contentId: 'content-1',
        targetPrincipal: { type: 'account', id: 'account-target' },
      })
    );
    expect(state.emitUpdated).not.toHaveBeenCalled();
  });

  it('keeps the locked provider lookup on the transaction client', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });

    await recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'request-locked',
      operation: 'create',
      sourceSystem: 'mainserver',
      sourceEntityType: 'GenericItem',
      sourceEntityId: 'external-locked',
      contentType: 'generic-items.generic-item',
      title: 'Eintrag',
      payload: { status: 'draft' },
      status: 'draft',
      authorDisplayMode: 'user',
      authorDisplayName: 'Redaktion',
    });

    expect(state.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('source_entity_id = $4'),
      ['tenant-1', 'mainserver', ['GenericItem'], 'external-locked']
    );
    expect(state.withInstanceScopedDb).toHaveBeenCalledTimes(2);
  });

  it('rechecks both project reference types under the shared lock before creating a Core', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ content_id: 'canonical-core', source_entity_type: 'GenericItem' }] })
      .mockResolvedValueOnce({ rows: [{ ...row, content_id: 'canonical-core', source_entity_id: 'project-1' }] })
      .mockResolvedValueOnce({ rows: [{ updated: false }] });

    await expect(recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'project-archive-1',
      operation: 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project',
      sourceEntityId: 'project-1',
      contentType: 'projects.project',
      title: 'Projekt',
      payload: {},
      status: 'draft',
      authorDisplayMode: 'organization',
      authorDisplayName: 'Organisation',
    })).rejects.toThrow('project_core_full_update_unverified');

    expect(state.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));',
      ['mainserver:projects.project', 'project-1']
    );
    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY array_position($3::text[], source_entity_type)'),
      ['tenant-1', 'mainserver', ['projects.project', 'GenericItem'], 'project-1']
    );
    expect(state.insertContentRow).not.toHaveBeenCalled();
    expect(state.updateContent).not.toHaveBeenCalled();
  });

  it('accepts a concurrent canonical project Core only with a journal full-update marker', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ content_id: 'canonical-core', source_entity_type: 'GenericItem' }] })
      .mockResolvedValueOnce({ rows: [{ ...row, content_id: 'canonical-core', source_entity_id: 'project-1' }] })
      .mockResolvedValueOnce({ rows: [{ updated: true }] });

    await expect(recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1', actorAccountId: 'account-1', actorDisplayName: 'Redaktion',
      mutationRef: 'project-archive-1', operation: 'update', sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project', sourceEntityId: 'project-1',
      contentType: 'projects.project', title: 'Projekt', payload: {}, status: 'draft',
      authorDisplayMode: 'organization', authorDisplayName: 'Organisation',
    })).resolves.toBe('canonical-core');
    expect(state.updateContent).not.toHaveBeenCalled();
  });

  it('reuses a concurrent legacy project Core for the transfer under the same lock', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ content_id: 'legacy-core', source_entity_type: 'projects.project' }] })
      .mockResolvedValue({ rows: [] });
    state.updateContent.mockResolvedValue('legacy-core');

    await expect(recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'project-transfer-1',
      operation: 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project',
      sourceEntityId: 'project-1',
      contentType: 'projects.project',
      ownershipPrincipal: { type: 'organization', id: 'organization-1' },
      title: 'Projekt',
      payload: {},
      status: 'draft',
      authorDisplayMode: 'organization',
      authorDisplayName: 'Organisation',
    })).resolves.toBe('legacy-core');

    expect(state.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));',
      ['mainserver:projects.project', 'project-1']
    );
    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY array_position($3::text[], source_entity_type)'),
      ['tenant-1', 'mainserver', ['GenericItem', 'projects.project'], 'project-1']
    );
    expect(state.insertContentRow).not.toHaveBeenCalled();
    expect(state.updateContent).toHaveBeenCalledWith(expect.objectContaining({
      contentId: 'legacy-core',
      confirmedExternalOwner: { type: 'organization', id: 'organization-1' },
    }));
  });

  it('emits update audit semantics when the first bound provider operation is an update', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });

    await recordSuccessfulExternalContentMutation({
      instanceId: 'tenant-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'request-update',
      operation: 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: 'GenericItem',
      sourceEntityId: 'external-update',
      contentType: 'generic-items.generic-item',
      title: 'Eintrag',
      payload: { status: 'published' },
      status: 'published',
      authorDisplayMode: 'user',
      authorDisplayName: 'Redaktion',
    });

    expect(state.emitCreated).not.toHaveBeenCalled();
    expect(state.emitUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ query: state.query }),
      expect.objectContaining({ mutationRef: 'request-update' }),
      'content-1',
      ['title', 'payload', 'status']
    );
  });

  it('fails closed when reference writes return no row', async () => {
    state.query.mockResolvedValue({ rows: [] });

    await expect(
      createExternalContentReference({
        instanceId: 'tenant-1',
        contentId: 'content-1',
        sourceSystem: 'mainserver',
        sourceEntityType: 'GenericItem',
        operationExternalId: 'operation-1',
      })
    ).rejects.toThrow('external_content_reference_create_failed');

    await expect(
      bindExternalContentReference({
        instanceId: 'tenant-1',
        referenceId: 'missing',
        sourceEntityId: 'external-1',
      })
    ).rejects.toThrow('external_content_reference_not_found');
  });

  it('delegates core reads and rejects missing core updates', async () => {
    state.loadContentById.mockResolvedValue({ id: 'content-1' });
    await expect(loadExternalContentCore('tenant-1', 'content-1')).resolves.toEqual({
      id: 'content-1',
    });
    expect(state.loadContentById).toHaveBeenCalledWith('tenant-1', 'content-1');

    state.updateContent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const update = {
      instanceId: 'tenant-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      contentId: 'content-1',
      title: 'Projekt',
      payload: { language: 'de' },
      status: 'draft' as const,
      authorDisplayMode: 'user' as const,
      authorDisplayName: 'Redaktion',
    };
    await expect(updateExternalContentCore(update)).resolves.toBeUndefined();
    await expect(updateExternalContentCore(update)).rejects.toThrow(
      'external_content_core_not_found'
    );
  });
});
