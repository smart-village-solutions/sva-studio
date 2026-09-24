import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  finalizeMainserverMutationJournal: vi.fn(),
  query: vi.fn(),
  recordSuccessfulExternalContentMutation: vi.fn(),
  revealField: vi.fn(),
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('@sva/iam-admin', () => ({ revealField: state.revealField }));
vi.mock('../iam-account-management/shared.js', () => ({
  withInstanceScopedDb: state.withInstanceScopedDb,
}));
vi.mock('./external-content-mutations.js', () => ({
  recordSuccessfulExternalContentMutation: state.recordSuccessfulExternalContentMutation,
}));
vi.mock('./mainserver-mutation-journal.js', () => ({
  finalizeMainserverMutationJournal: state.finalizeMainserverMutationJournal,
}));

describe('deferred Mainserver mutation projection reconciliation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) =>
      work({ query: state.query })
    );
    state.revealField.mockReturnValue('Redaktion');
    state.recordSuccessfulExternalContentMutation.mockResolvedValue(
      '11111111-1111-4111-8111-111111111111'
    );
  });

  it('materializes deferred history from the next loaded projection row', async () => {
    state.query.mockResolvedValue({
      rows: [
        {
          operation_external_id: 'operation-1',
          action_id: 'generic-items.update',
          content_type: 'generic-items.generic-item',
          content_id: 'news-1',
          actor_account_id: '22222222-2222-4222-8222-222222222222',
          keycloak_subject: 'subject-1',
          display_name_ciphertext: 'encrypted-name',
          deferred_at: '2026-09-13T12:02:00.000Z',
        },
      ],
    });

    const { reconcileDeferredMainserverMutationProjections } =
      await import('./mainserver-mutation-projection-reconciliation.js');
    await expect(
      reconcileDeferredMainserverMutationProjections({
        instanceId: 'de-musterhausen',
        actingPrincipalType: 'organization',
        actingPrincipalId: '33333333-3333-4333-8333-333333333333',
        activeOrganizationId: '33333333-3333-4333-8333-333333333333',
        credentialFingerprint: 'a'.repeat(64),
        rows: [
          {
            sourceEntityType: 'projects.project',
            journalContentType: 'generic-items.generic-item',
            sourceEntityId: 'news-1',
            contentType: 'projects.project',
            organizationId: '33333333-3333-4333-8333-333333333333',
            title: 'Erfolgreiche Änderung',
            payload: { title: 'Erfolgreiche Änderung' },
            status: 'published',
            authorDisplayMode: 'organization',
            author: 'Musterhausen',
            updatedAt: '2026-09-13T12:01:00.000Z',
          },
        ],
      })
    ).resolves.toBe(1);

    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('journal.acting_principal_type = $2'),
      [
        'de-musterhausen',
        'organization',
        '33333333-3333-4333-8333-333333333333',
        '33333333-3333-4333-8333-333333333333',
        'a'.repeat(64),
        ['news-1'],
        ['generic-items.generic-item'],
      ]
    );
    expect(state.query.mock.calls[0]?.[0]).toContain(
      "journal.action_id <> 'content.transferOwnership'"
    );
    expect(state.query.mock.calls[0]?.[0]).toContain(
      'journal.acting_principal_id::text = $3::uuid::text'
    );
    expect(state.recordSuccessfulExternalContentMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        actorDisplayName: 'Redaktion',
        mutationRef: 'operation-1',
        operation: 'update',
        contentType: 'projects.project',
        sourceEntityType: 'projects.project',
        sourceEntityId: 'news-1',
      })
    );
    expect(state.finalizeMainserverMutationJournal).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      operationExternalId: 'operation-1',
      providerOutcome: 'succeeded',
      reconciliationStatus: 'complete',
      completedSteps: ['projection_history_reconciled'],
      contentId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('keeps an entry deferred when its actor display name cannot be recovered', async () => {
    state.query.mockResolvedValue({
      rows: [
        {
          operation_external_id: 'operation-1',
          action_id: 'news.create',
          content_type: 'news.article',
          content_id: 'news-1',
          actor_account_id: '22222222-2222-4222-8222-222222222222',
          keycloak_subject: 'subject-1',
          display_name_ciphertext: null,
          deferred_at: '2026-09-13T12:02:00.000Z',
        },
      ],
    });
    state.revealField.mockReturnValue(undefined);

    const { reconcileDeferredMainserverMutationProjections } =
      await import('./mainserver-mutation-projection-reconciliation.js');
    await expect(
      reconcileDeferredMainserverMutationProjections({
        instanceId: 'de-musterhausen',
        actingPrincipalType: 'user',
        actingPrincipalId: '22222222-2222-4222-8222-222222222222',
        credentialFingerprint: 'a'.repeat(64),
        rows: [
          {
            sourceEntityType: 'news.article',
            sourceEntityId: 'news-1',
            contentType: 'news.article',
            title: 'Erfolgreiche Änderung',
            payload: {},
            status: 'draft',
            authorDisplayMode: 'user',
            author: 'Redaktion',
            updatedAt: '2026-09-13T12:01:00.000Z',
          },
        ],
      })
    ).resolves.toBe(0);
    expect(state.recordSuccessfulExternalContentMutation).not.toHaveBeenCalled();
    expect(state.finalizeMainserverMutationJournal).not.toHaveBeenCalled();
  });

  it('reconciles an ownership transfer against its recorded target credentials', async () => {
    state.query.mockResolvedValue({
      rows: [
        {
          operation_external_id: 'transfer-1',
          action_id: 'content.transferOwnership',
          content_type: 'news.article',
          content_id: 'news-1',
          actor_account_id: '22222222-2222-4222-8222-222222222222',
          keycloak_subject: 'subject-1',
          display_name_ciphertext: 'encrypted-name',
          deferred_at: '2026-09-13T12:02:00.000Z',
        },
      ],
    });

    const { reconcileDeferredMainserverMutationProjections } =
      await import('./mainserver-mutation-projection-reconciliation.js');
    await expect(
      reconcileDeferredMainserverMutationProjections({
        instanceId: 'de-musterhausen',
        actingPrincipalType: 'organization',
        actingPrincipalId: '33333333-3333-4333-8333-333333333333',
        activeOrganizationId: '33333333-3333-4333-8333-333333333333',
        credentialFingerprint: 'b'.repeat(64),
        rows: [
          {
            sourceEntityType: 'news.article',
            sourceEntityId: 'news-1',
            contentType: 'news.article',
            organizationId: '33333333-3333-4333-8333-333333333333',
            title: 'Übertragener Inhalt',
            payload: {},
            status: 'published',
            authorDisplayMode: 'organization',
            author: 'Musterhausen',
            updatedAt: '2026-09-13T12:01:00.000Z',
          },
        ],
      })
    ).resolves.toBe(1);

    expect(state.query.mock.calls[0]?.[0]).toContain(
      "journal.action_id = 'content.transferOwnership'"
    );
    expect(state.query.mock.calls[0]?.[0]).toContain('targetCredentialFingerprint');
    expect(state.finalizeMainserverMutationJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        operationExternalId: 'transfer-1',
        completedSteps: ['projection_history_reconciled', 'target_projection_refreshed'],
      })
    );
  });

  it('preserves an independent reconciliation error after replaying lifecycle history', async () => {
    state.query.mockResolvedValue({
      rows: [
        {
          operation_external_id: 'publish-1',
          action_id: 'content.publish',
          content_type: 'news.article',
          content_id: 'news-1',
          actor_account_id: '22222222-2222-4222-8222-222222222222',
          keycloak_subject: 'subject-1',
          display_name_ciphertext: 'encrypted-name',
          deferred_at: '2026-09-13T12:02:00.000Z',
          last_error_code: 'mainserver_data_provider_binding_conflict',
        },
      ],
    });

    const { reconcileDeferredMainserverMutationProjections } =
      await import('./mainserver-mutation-projection-reconciliation.js');
    await reconcileDeferredMainserverMutationProjections({
      instanceId: 'de-musterhausen',
      actingPrincipalType: 'user',
      actingPrincipalId: '22222222-2222-4222-8222-222222222222',
      credentialFingerprint: 'a'.repeat(64),
      rows: [
        {
          sourceEntityType: 'news.article',
          sourceEntityId: 'news-1',
          contentType: 'news.article',
          title: 'Veröffentlichter Inhalt',
          payload: {},
          status: 'published',
          authorDisplayMode: 'user',
          author: 'Redaktion',
          updatedAt: '2026-09-13T12:01:00.000Z',
        },
      ],
    });

    expect(state.recordSuccessfulExternalContentMutation).toHaveBeenCalledWith(
      expect.objectContaining({ mutationRef: 'publish-1', operation: 'update' })
    );
    expect(state.finalizeMainserverMutationJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        operationExternalId: 'publish-1',
        reconciliationStatus: 'reconciliation_required',
        lastErrorCode: 'mainserver_data_provider_binding_conflict',
      })
    );
  });

  it('does not attribute a newer provider snapshot to the deferred Studio mutation', async () => {
    state.query.mockResolvedValue({
      rows: [
        {
          operation_external_id: 'operation-1',
          action_id: 'news.update',
          content_type: 'news.article',
          content_id: 'news-1',
          actor_account_id: '22222222-2222-4222-8222-222222222222',
          keycloak_subject: 'subject-1',
          display_name_ciphertext: 'encrypted-name',
          deferred_at: '2026-09-13T12:02:00.000Z',
        },
      ],
    });

    const { reconcileDeferredMainserverMutationProjections } =
      await import('./mainserver-mutation-projection-reconciliation.js');
    await expect(
      reconcileDeferredMainserverMutationProjections({
        instanceId: 'de-musterhausen',
        actingPrincipalType: 'user',
        actingPrincipalId: '22222222-2222-4222-8222-222222222222',
        credentialFingerprint: 'a'.repeat(64),
        rows: [
          {
            sourceEntityType: 'news.article',
            sourceEntityId: 'news-1',
            contentType: 'news.article',
            title: 'Extern geändert',
            payload: {},
            status: 'published',
            authorDisplayMode: 'user',
            author: 'Andere Redaktion',
            updatedAt: '2026-09-13T12:03:00.000Z',
          },
        ],
      })
    ).resolves.toBe(0);
    expect(state.recordSuccessfulExternalContentMutation).not.toHaveBeenCalled();
    expect(state.finalizeMainserverMutationJournal).not.toHaveBeenCalled();
  });
});
