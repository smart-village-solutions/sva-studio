import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  insertContentRow: vi.fn(),
  insertHistory: vi.fn(),
  updateRevision: vi.fn(),
  emitCreated: vi.fn(),
  emitUpdated: vi.fn(),
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
    expect(state.query).toHaveBeenCalledWith(expect.stringContaining("SET status = 'archived'"), [
      'tenant-1',
      'content-1',
      'account-1',
    ]);
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
      ['tenant-1', 'mainserver', 'GenericItem', 'external-locked']
    );
    expect(state.withInstanceScopedDb).toHaveBeenCalledTimes(2);
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
