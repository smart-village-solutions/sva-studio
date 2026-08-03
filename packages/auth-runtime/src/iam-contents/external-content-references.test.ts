import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  insertContentRow: vi.fn(),
  insertHistory: vi.fn(),
  updateRevision: vi.fn(),
  emitCreated: vi.fn(),
  validatePublicationWindow: vi.fn(),
  loadContentById: vi.fn(),
  updateContent: vi.fn(),
}));

vi.mock('../iam-account-management/shared.js', () => ({
  withInstanceScopedDb: (_instanceId: string, execute: (client: { query: typeof state.query }) => unknown) =>
    execute({ query: state.query }),
}));

vi.mock('./repository-shared.js', () => ({
  insertContentHistory: state.insertHistory,
}));

vi.mock('./repository-write-helpers.js', () => ({
  emitContentCreatedActivity: state.emitCreated,
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
  listExternalContentReferences,
  prepareExternalContent,
  updateExternalContentReconciliationStatus,
  withExternalContentMutationLock,
} from './external-content-references.js';

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
    ).resolves.toEqual(expect.objectContaining({ sourceEntityId: 'external-1', reconciliationStatus: 'bound' }));
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
});
