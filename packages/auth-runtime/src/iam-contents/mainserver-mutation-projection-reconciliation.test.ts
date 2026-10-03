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
    expect(state.query.mock.calls[0]?.[0]).toContain('journal.acting_principal_id::text = $3');
    expect(state.query.mock.calls[0]?.[0]).toContain(
      "NOT (journal.completed_steps ? 'projection_history_reconciled')"
    );
    expect(state.recordSuccessfulExternalContentMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        actorDisplayName: 'Redaktion',
        authorDisplayMode: 'organization',
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

  it('attributes deferred personal content history to the actor', async () => {
    state.query.mockResolvedValue({
      rows: [
        {
          operation_external_id: 'operation-personal-1',
          action_id: 'events.create',
          content_type: 'events.event-record',
          content_id: 'event-personal-1',
          actor_account_id: '22222222-2222-4222-8222-222222222222',
          keycloak_subject: 'subject-1',
          display_name_ciphertext: 'encrypted-name',
          deferred_at: '2026-09-25T14:00:00.000Z',
        },
      ],
    });

    const { reconcileDeferredMainserverMutationProjections } =
      await import('./mainserver-mutation-projection-reconciliation.js');
    await reconcileDeferredMainserverMutationProjections({
      instanceId: 'de-musterhausen',
      actingPrincipalType: 'user',
      actingPrincipalId: '22222222-2222-4222-8222-222222222222',
      activeOrganizationId: '33333333-3333-4333-8333-333333333333',
      credentialFingerprint: 'a'.repeat(64),
      rows: [
        {
          sourceEntityType: 'events.event-record',
          sourceEntityId: 'event-personal-1',
          contentType: 'events.event-record',
          organizationId: '33333333-3333-4333-8333-333333333333',
          title: 'Persönlicher Termin',
          payload: {},
          status: 'draft',
          authorDisplayMode: 'organization',
          author: 'mainserver',
          updatedAt: '2026-09-25T13:59:00.000Z',
        },
      ],
    });

    expect(state.recordSuccessfulExternalContentMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: '22222222-2222-4222-8222-222222222222',
        authorDisplayMode: 'user',
        authorDisplayName: 'Redaktion',
      })
    );
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

  it('reconciles only ownership from an older slim snapshot with verified target credentials', async () => {
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
          last_error_code: 'content_transfer_projection_refresh_failed',
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
            ownerOrganizationId: '33333333-3333-4333-8333-333333333333',
            title: 'Übertragener Inhalt',
            payload: { languageCode: 'de' },
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
    expect(state.recordSuccessfulExternalContentMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        ownershipPrincipal: {
          type: 'organization',
          id: '33333333-3333-4333-8333-333333333333',
        },
        preserveExistingContentState: true,
      })
    );
    expect(state.finalizeMainserverMutationJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        operationExternalId: 'transfer-1',
        reconciliationStatus: 'complete',
        completedSteps: ['projection_history_reconciled', 'target_projection_refreshed'],
      })
    );
  });

  it.each([
    ['unverified', undefined, undefined],
    ['another organization', undefined, '44444444-4444-4444-8444-444444444444'],
    ['another account', '44444444-4444-4444-8444-444444444444', undefined],
  ])('keeps a transfer deferred for %s owner', async (_case, ownerUserId, ownerOrganizationId) => {
    state.query.mockResolvedValue({
      rows: [{
        operation_external_id: 'transfer-1',
        action_id: 'content.transferOwnership',
        content_type: 'news.article',
        content_id: 'news-1',
        actor_account_id: '22222222-2222-4222-8222-222222222222',
        keycloak_subject: 'subject-1',
        display_name_ciphertext: 'encrypted-name',
        deferred_at: '2026-09-13T12:02:00.000Z',
      }],
    });
    const { reconcileDeferredMainserverMutationProjections } =
      await import('./mainserver-mutation-projection-reconciliation.js');
    await expect(reconcileDeferredMainserverMutationProjections({
      instanceId: 'de-musterhausen',
      actingPrincipalType: 'organization',
      actingPrincipalId: '33333333-3333-4333-8333-333333333333',
      credentialFingerprint: 'b'.repeat(64),
      rows: [{
        sourceEntityType: 'news.article',
        sourceEntityId: 'news-1',
        contentType: 'news.article',
        ownerUserId,
        ownerOrganizationId,
        title: 'Extern geändert',
        payload: {},
        status: 'published',
        authorDisplayMode: 'organization',
        author: 'Andere Redaktion',
        updatedAt: '2026-09-13T12:01:00.000Z',
      }],
    })).resolves.toBe(0);
    expect(state.recordSuccessfulExternalContentMutation).not.toHaveBeenCalled();
    expect(state.finalizeMainserverMutationJournal).not.toHaveBeenCalled();
  });

  it('reconciles only the verified owner when the provider snapshot is newer', async () => {
    state.query.mockResolvedValue({
      rows: [{
        operation_external_id: 'transfer-1',
        action_id: 'content.transferOwnership',
        content_type: 'news.article',
        content_id: 'news-1',
        actor_account_id: '22222222-2222-4222-8222-222222222222',
        keycloak_subject: 'subject-1',
        display_name_ciphertext: 'encrypted-name',
        deferred_at: '2026-09-13T12:02:00.000Z',
      }],
    });
    const { reconcileDeferredMainserverMutationProjections } =
      await import('./mainserver-mutation-projection-reconciliation.js');
    await expect(reconcileDeferredMainserverMutationProjections({
      instanceId: 'de-musterhausen',
      actingPrincipalType: 'organization',
      actingPrincipalId: '33333333-3333-4333-8333-333333333333',
      credentialFingerprint: 'b'.repeat(64),
      rows: [{
        sourceEntityType: 'news.article',
        sourceEntityId: 'news-1',
        contentType: 'news.article',
        organizationId: '33333333-3333-4333-8333-333333333333',
        ownerOrganizationId: '33333333-3333-4333-8333-333333333333',
        title: 'Später bearbeitet',
        payload: { body: 'Neue Fassung' },
        status: 'published',
        authorDisplayMode: 'organization',
        author: 'Musterhausen',
        updatedAt: '2026-09-13T12:03:00.000Z',
      }],
    })).resolves.toBe(1);
    expect(state.recordSuccessfulExternalContentMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        ownershipPrincipal: { type: 'organization', id: '33333333-3333-4333-8333-333333333333' },
        preserveExistingContentState: true,
      })
    );
    expect(state.finalizeMainserverMutationJournal).toHaveBeenCalledOnce();
  });

  it('keeps a transfer without a Core reference deferred and replays the next entry', async () => {
    state.query.mockResolvedValue({
      rows: ['missing', 'bound'].map((id) => ({
        operation_external_id: `transfer-${id}`,
        action_id: 'content.transferOwnership',
        content_type: 'news.article',
        content_id: id,
        actor_account_id: '22222222-2222-4222-8222-222222222222',
        keycloak_subject: 'subject-1',
        display_name_ciphertext: 'encrypted-name',
        deferred_at: '2026-09-13T12:02:00.000Z',
      })),
    });
    state.recordSuccessfulExternalContentMutation
      .mockRejectedValueOnce(new Error('external_content_core_reference_required_for_owner_only_replay'))
      .mockResolvedValueOnce('11111111-1111-4111-8111-111111111111');

    const { reconcileDeferredMainserverMutationProjections } =
      await import('./mainserver-mutation-projection-reconciliation.js');
    await expect(reconcileDeferredMainserverMutationProjections({
      instanceId: 'de-musterhausen',
      actingPrincipalType: 'organization',
      actingPrincipalId: '33333333-3333-4333-8333-333333333333',
      credentialFingerprint: 'b'.repeat(64),
      rows: ['missing', 'bound'].map((id) => ({
        sourceEntityType: 'news.article',
        sourceEntityId: id,
        contentType: 'news.article',
        ownerOrganizationId: '33333333-3333-4333-8333-333333333333',
        title: id,
        payload: { languageCode: 'de' },
        status: 'published' as const,
        authorDisplayMode: 'organization' as const,
        author: 'Zielorganisation',
        updatedAt: '2026-09-13T12:01:00.000Z',
      })),
    })).resolves.toBe(1);

    expect(state.recordSuccessfulExternalContentMutation).toHaveBeenCalledTimes(2);
    expect(state.finalizeMainserverMutationJournal).toHaveBeenCalledOnce();
    expect(state.finalizeMainserverMutationJournal).toHaveBeenCalledWith(
      expect.objectContaining({ operationExternalId: 'transfer-bound' })
    );
  });

  it('uses the newer provider author when replaying ownership for a personal target', async () => {
    state.query.mockResolvedValue({
      rows: [{
        operation_external_id: 'transfer-personal-1',
        action_id: 'content.transferOwnership',
        content_type: 'news.article',
        content_id: 'news-1',
        actor_account_id: '22222222-2222-4222-8222-222222222222',
        keycloak_subject: 'subject-1',
        display_name_ciphertext: 'encrypted-name',
        deferred_at: '2026-09-13T12:02:00.000Z',
      }],
    });
    const { reconcileDeferredMainserverMutationProjections } =
      await import('./mainserver-mutation-projection-reconciliation.js');
    await expect(reconcileDeferredMainserverMutationProjections({
      instanceId: 'de-musterhausen',
      actingPrincipalType: 'user',
      actingPrincipalId: '44444444-4444-4444-8444-444444444444',
      credentialFingerprint: 'b'.repeat(64),
      rows: [{
        sourceEntityType: 'news.article',
        sourceEntityId: 'news-1',
        contentType: 'news.article',
        ownerUserId: '44444444-4444-4444-8444-444444444444',
        title: 'Später bearbeitet',
        payload: { body: 'Neue Fassung' },
        status: 'published',
        authorDisplayMode: 'user',
        author: 'Spätere Autorin',
        updatedAt: '2026-09-13T12:03:00.000Z',
      }],
    })).resolves.toBe(1);
    expect(state.recordSuccessfulExternalContentMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        preserveExistingContentState: true,
        authorDisplayMode: 'user',
        authorDisplayName: 'Spätere Autorin',
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
