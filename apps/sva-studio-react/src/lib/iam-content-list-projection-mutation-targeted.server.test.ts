import { describe, expect, it } from 'vitest';

import {
  registerProjectionFixture,
  fixture,
  refreshProjectedContentsForMainserverMutationForTest as refreshProjectedContentsForMainserverMutation,
  getProjectionTestState,
} from './iam-content-list-projection.test-fixture.js';

const state = getProjectionTestState();

describe('targeted content projection mutations', () => {
  registerProjectionFixture();

  it('refreshes a mainserver projection after direct mainserver mutations', async () => {
    state.getSvaMainserverPoi.mockResolvedValue({
      id: 'poi-mutation-1',
      name: 'Mutation POI',
      contentType: 'poi.point-of-interest',
      status: 'published',
      active: true,
      categories: [],
      addresses: [],
      priceInformations: [],
      openingHours: [],
      webUrls: [],
      mediaContents: [],
      certificates: [],
      tags: [],
      visible: true,
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-21T10:00:00.000Z',
    });

    await refreshProjectedContentsForMainserverMutation({
      contentType: 'poi.point-of-interest',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'mutation-1',
      organizationId: 'org-1',
      operation: 'update',
      entityId: 'poi-mutation-1',
    });

    expect(state.getSvaMainserverPoi).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOrganizationId: 'org-1',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
        poiId: 'poi-mutation-1',
      })
    );
    expect(fixture.syncStates.get('poi.point-of-interest')).toEqual(
      expect.objectContaining({
        last_error_code: null,
        projected_count: 1,
      })
    );
    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        organization_id: 'org-1',
        source_entity_id: 'poi-mutation-1',
      }),
    ]);
    expect(state.recordSuccessfulExternalContentMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: 'account-1',
        actorDisplayName: 'Redaktion',
        authorDisplayMode: 'organization',
        contentType: 'poi.point-of-interest',
        mutationRef: 'mutation-1',
        operation: 'update',
        sourceEntityId: 'poi-mutation-1',
        sourceSystem: 'mainserver',
      })
    );
  });

  it.each([undefined, 'org-1'])(
    'attributes a personal Mainserver event mutation to the actor (organization: %s)',
    async (organizationId) => {
      state.getSvaMainserverEvent.mockResolvedValue({
        id: 'event-personal-1',
        title: 'Persönlicher Termin',
        contentType: 'events.event-record',
        dates: [],
        addresses: [],
        contacts: [],
        urls: [],
        tags: [],
        createdAt: '2026-09-25T13:59:00.000Z',
        updatedAt: '2026-09-25T13:59:00.000Z',
      });

      await refreshProjectedContentsForMainserverMutation({
        contentType: 'events.event-record',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
        actorAccountId: 'account-1',
        actorDisplayName: 'Redaktion',
        mutationRef: 'mutation-personal-1',
        actingPrincipalType: 'user',
        organizationId,
        credentialFingerprint: 'a'.repeat(64),
        operation: 'create',
        entityId: 'event-personal-1',
      });

      expect(state.recordSuccessfulExternalContentMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          actorAccountId: 'account-1',
          authorDisplayMode: 'user',
          authorDisplayName: 'Redaktion',
          sourceEntityId: 'event-personal-1',
        })
      );
    }
  );

  it('records survey mutations through the targeted projection loader', async () => {
    state.getSvaMainserverSurvey.mockResolvedValue({
      id: 'survey-mutation-1',
      contentType: 'surveys.survey',
      title: { de: 'Mutation Umfrage' },
      status: 'ACTIVE',
      resultVisibility: 'NONE',
      targetAreaIds: [],
      showResultsInApp: false,
      isAnonymous: true,
      questions: [],
      questionCount: 0,
      participationCount: 0,
      submissionCount: 0,
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-21T10:00:00.000Z',
    });

    await refreshProjectedContentsForMainserverMutation({
      contentType: 'surveys.survey',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'survey-mutation-ref',
      organizationId: 'org-1',
      operation: 'update',
      entityId: 'survey-mutation-1',
    });

    expect(state.getSvaMainserverSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOrganizationId: 'org-1',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
        surveyId: 'survey-mutation-1',
      })
    );
    expect(state.recordSuccessfulExternalContentMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'surveys.survey',
        mutationRef: 'survey-mutation-ref',
        operation: 'update',
        sourceEntityId: 'survey-mutation-1',
      })
    );
  });

  it('does not invent user ownership for mutation projection refreshes', async () => {
    state.readEffectiveSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      source: 'user',
      credentials: { apiKey: 'key', apiSecret: 'secret' },
      credentialFingerprint: 'c'.repeat(64),
    });
    state.getSvaMainserverPoi.mockResolvedValue({
      id: 'poi-user-1',
      name: 'User POI',
      contentType: 'poi.point-of-interest',
      status: 'published',
      active: true,
      categories: [],
      addresses: [],
      priceInformations: [],
      openingHours: [],
      webUrls: [],
      mediaContents: [],
      certificates: [],
      tags: [],
      visible: true,
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-21T10:00:00.000Z',
    });

    await refreshProjectedContentsForMainserverMutation({
      actingPrincipalType: 'user',
      authorizationMode: 'credential_visible_compatibility',
      contentType: 'poi.point-of-interest',
      credentialFingerprint: 'c'.repeat(64),
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      operation: 'create',
      entityId: 'poi-user-1',
    });

    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        organization_id: null,
        owner_user_id: null,
        projection_scope_key:
          'de-musterhausen::account-1::no-organization::user::poi.point-of-interest',
        source_entity_id: 'poi-user-1',
      }),
    ]);
  });

  it('derives a targeted personal owner only from the exact verified binding of the immutable context', async () => {
    state.readEffectiveSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      source: 'user',
      credentials: { apiKey: 'key', apiSecret: 'secret' },
      credentialFingerprint: 'c'.repeat(64),
    });
    state.loadCurrentMainserverDataProviderBinding.mockResolvedValue({
      dataProviderId: 'provider-user',
    });
    state.getSvaMainserverPoi.mockResolvedValue({
      id: 'poi-user-exact-1',
      name: 'Persönlicher POI',
      contentType: 'poi.point-of-interest',
      status: 'published',
      active: true,
      categories: [],
      addresses: [],
      priceInformations: [],
      openingHours: [],
      webUrls: [],
      mediaContents: [],
      certificates: [],
      tags: [],
      visible: true,
      dataProvider: { id: 'provider-user', name: 'Persönlich' },
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-21T10:00:00.000Z',
    });

    await refreshProjectedContentsForMainserverMutation({
      actingPrincipalType: 'user',
      authorizationMode: 'exact',
      contentType: 'poi.point-of-interest',
      credentialFingerprint: 'c'.repeat(64),
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      organizationId: 'org-1',
      operation: 'update',
      entityId: 'poi-user-exact-1',
    });

    expect(state.getSvaMainserverPoi).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOrganizationId: 'org-1',
        actingPrincipalType: 'user',
        credentialFingerprint: 'c'.repeat(64),
      })
    );
    expect(state.loadCurrentMainserverDataProviderBinding).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      principalType: 'user',
      principalId: 'account-1',
      credentialFingerprint: 'c'.repeat(64),
    });
    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        organization_id: 'org-1',
        owner_user_id: 'account-1',
        owner_organization_id: null,
        credential_source: 'user',
        credential_fingerprint: 'c'.repeat(64),
        authorization_mode: 'exact',
        source_data_provider_id: 'provider-user',
      }),
    ]);
  });

  it('moves an account transfer projection into the recipient scope and keeps the audit actor', async () => {
    state.readEffectiveSvaMainserverCredentialsWithStatus.mockImplementation(
      async (input: { keycloakSubject: string }) => ({
        status: 'ok',
        source: 'user',
        credentials: { apiKey: 'key', apiSecret: 'secret' },
        credentialFingerprint:
          input.keycloakSubject === 'kc-target' ? 'b'.repeat(64) : 'a'.repeat(64),
      })
    );
    state.getSvaMainserverPoi.mockResolvedValue({
      id: 'poi-transfer-1',
      name: 'Übertragener POI',
      contentType: 'poi.point-of-interest',
      status: 'published',
      active: true,
      categories: [],
      addresses: [],
      priceInformations: [],
      openingHours: [],
      webUrls: [],
      mediaContents: [],
      certificates: [],
      tags: [],
      visible: true,
      dataProvider: { id: 'provider-target', name: 'Zielaccount' },
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-21T10:00:00.000Z',
    });
    state.loadCurrentMainserverDataProviderBinding.mockResolvedValue({
      dataProviderId: 'provider-target',
    });

    await refreshProjectedContentsForMainserverMutation({
      actingPrincipalType: 'user',
      authorizationMode: 'credential_visible_compatibility',
      contentType: 'poi.point-of-interest',
      credentialFingerprint: 'a'.repeat(64),
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-source',
      actorAccountId: 'account-source',
      operation: 'update',
      entityId: 'poi-transfer-1',
    });
    await refreshProjectedContentsForMainserverMutation({
      actingPrincipalType: 'user',
      authorizationMode: 'exact',
      contentType: 'poi.point-of-interest',
      credentialFingerprint: 'b'.repeat(64),
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-target',
      actorAccountId: 'account-target',
      auditActorAccountId: 'account-source',
      actorDisplayName: 'Ausführende Person',
      mutationRef: 'transfer-1',
      ownershipPrincipal: { type: 'account', id: 'account-target' },
      preserveExistingContentState: true,
      operation: 'update',
      entityId: 'poi-transfer-1',
    });

    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        owner_user_id: 'account-target',
        projection_scope_key:
          'de-musterhausen::account-target::no-organization::user::poi.point-of-interest',
        source_entity_id: 'poi-transfer-1',
      }),
    ]);
    expect(state.recordSuccessfulExternalContentMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actorAccountId: 'account-source',
        authorDisplayMode: 'user',
        authorDisplayName: 'mainserver',
        mutationRef: 'transfer-1',
        ownershipPrincipal: { type: 'account', id: 'account-target' },
        preserveExistingContentState: true,
      })
    );
  });

  it('passes an organization transfer target to the content core audit', async () => {
    state.readEffectiveSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      source: 'organization',
      credentials: { apiKey: 'key', apiSecret: 'secret' },
      credentialFingerprint: 'b'.repeat(64),
    });
    state.getSvaMainserverPoi.mockResolvedValue({
      id: 'poi-transfer-organization-1',
      name: 'Übertragener POI',
      contentType: 'poi.point-of-interest',
      status: 'published',
      active: true,
      categories: [],
      addresses: [],
      priceInformations: [],
      openingHours: [],
      webUrls: [],
      mediaContents: [],
      certificates: [],
      tags: [],
      visible: true,
      dataProvider: { id: 'provider-target', name: 'Zielorganisation' },
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-21T10:00:00.000Z',
    });
    state.loadCurrentMainserverDataProviderBinding.mockResolvedValue({
      dataProviderId: 'provider-target',
    });

    await refreshProjectedContentsForMainserverMutation({
      actingPrincipalType: 'organization',
      authorizationMode: 'exact',
      contentType: 'poi.point-of-interest',
      credentialFingerprint: 'b'.repeat(64),
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-target',
      actorAccountId: 'account-source',
      actorDisplayName: 'Ausführende Person',
      mutationRef: 'transfer-organization-1',
      organizationId: 'org-target',
      ownershipPrincipal: { type: 'organization', id: 'org-target' },
      operation: 'update',
      entityId: 'poi-transfer-organization-1',
    });

    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        organization_id: 'org-target',
        owner_organization_id: 'org-target',
        source_entity_id: 'poi-transfer-organization-1',
      }),
    ]);
    expect(state.recordSuccessfulExternalContentMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: 'account-source',
        ownershipPrincipal: { type: 'organization', id: 'org-target' },
        organizationId: 'org-target',
        authorDisplayMode: 'organization',
      })
    );
  });

  it('does not write a transfer when the refreshed provider owner differs from the target', async () => {
    state.readEffectiveSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      source: 'organization',
      credentials: { apiKey: 'key', apiSecret: 'secret' },
      credentialFingerprint: 'b'.repeat(64),
    });
    state.getSvaMainserverPoi.mockResolvedValue({
      id: 'poi-transfer-organization-1',
      name: 'Erneut übertragener POI',
      contentType: 'poi.point-of-interest',
      status: 'published',
      active: true,
      categories: [],
      addresses: [],
      priceInformations: [],
      openingHours: [],
      webUrls: [],
      mediaContents: [],
      certificates: [],
      tags: [],
      visible: true,
      dataProvider: { id: 'provider-other', name: 'Andere Organisation' },
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-21T10:00:00.000Z',
    });
    state.loadCurrentMainserverDataProviderBinding.mockResolvedValue({
      dataProviderId: 'provider-target',
    });

    await expect(refreshProjectedContentsForMainserverMutation({
      actingPrincipalType: 'organization',
      authorizationMode: 'exact',
      contentType: 'poi.point-of-interest',
      credentialFingerprint: 'b'.repeat(64),
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-target',
      actorAccountId: 'account-source',
      actorDisplayName: 'Ausführende Person',
      mutationRef: 'transfer-organization-1',
      organizationId: 'org-target',
      ownershipPrincipal: { type: 'organization', id: 'org-target' },
      operation: 'update',
      entityId: 'poi-transfer-organization-1',
    })).rejects.toMatchObject({ code: 'content_transfer_target_ownership_unverified' });
    expect(fixture.projectionRows).toEqual([]);
    expect(state.recordSuccessfulExternalContentMutation).not.toHaveBeenCalled();
  });

  it('ignores direct mainserver mutation refreshes without an actor account id', async () => {
    await expect(
      refreshProjectedContentsForMainserverMutation({
        contentType: 'news.article',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
        operation: 'update',
        entityId: 'news-1',
      })
    ).resolves.toBeUndefined();

    expect(state.getSvaMainserverNews).not.toHaveBeenCalled();
    expect(state.listSvaMainserverNews).not.toHaveBeenCalled();
    expect(fixture.projectionRows).toEqual([]);
  });

  it('rejects a mutation follow-up when the credential version changed', async () => {
    state.readEffectiveSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      source: 'user',
      credentials: { apiKey: 'new-key', apiSecret: 'new-secret' },
      credentialFingerprint: 'b'.repeat(64),
    });

    await expect(
      refreshProjectedContentsForMainserverMutation({
        actingPrincipalType: 'user',
        authorizationMode: 'exact',
        contentType: 'news.article',
        credentialFingerprint: 'a'.repeat(64),
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
        actorAccountId: 'account-1',
        actorDisplayName: 'Redaktion',
        mutationRef: 'operation-news-update-stale',
        operation: 'update',
        entityId: 'news-1',
      })
    ).rejects.toMatchObject({ code: 'mainserver_credentials_stale' });

    expect(state.getSvaMainserverNews).not.toHaveBeenCalled();
    expect(state.readEffectiveSvaMainserverCredentialsWithStatus).toHaveBeenCalledOnce();
    expect(state.deferMainserverMutationProjection).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      operationExternalId: 'operation-news-update-stale',
    });
    expect(fixture.projectionRows).toEqual([]);
  });

  it('skips a targeted mutation follow-up during the persisted credential cooldown', async () => {
    const syncScopeKey = 'de-musterhausen::account-1::org-1::organization::news.article';
    fixture.syncStates.set(`news.article::${syncScopeKey}`, {
      sync_scope_key: syncScopeKey,
      last_started_at: '2026-09-13T12:00:00.000Z',
      last_succeeded_at: null,
      last_failed_at: new Date().toISOString(),
      last_error_code: 'mainserver_credentials_partial',
      last_error_message: 'credentials not ready',
      projected_count: 0,
    });

    await expect(
      refreshProjectedContentsForMainserverMutation({
        contentType: 'news.article',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
        actorAccountId: 'account-1',
        organizationId: 'org-1',
        operation: 'update',
        entityId: 'news-1',
      })
    ).resolves.toBeUndefined();

    expect(state.readEffectiveSvaMainserverCredentialsWithStatus).not.toHaveBeenCalled();
    expect(state.getSvaMainserverNews).not.toHaveBeenCalled();
  });

  it('defers successful mutation history without an upstream read during credential cooldown', async () => {
    const syncScopeKey = 'de-musterhausen::account-1::org-1::organization::news.article';
    fixture.syncStates.set(`news.article::${syncScopeKey}`, {
      sync_scope_key: syncScopeKey,
      last_started_at: '2026-09-13T12:00:00.000Z',
      last_succeeded_at: null,
      last_failed_at: new Date().toISOString(),
      last_error_code: 'mainserver_credentials_stale',
      last_error_message: 'credentials not ready',
      projected_count: 0,
    });
    await refreshProjectedContentsForMainserverMutation({
      contentType: 'news.article',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'operation-news-update-1',
      organizationId: 'org-1',
      operation: 'update',
      entityId: 'news-1',
    });

    expect(state.getSvaMainserverNews).not.toHaveBeenCalled();
    expect(state.recordSuccessfulExternalContentMutation).not.toHaveBeenCalled();
    expect(state.deferMainserverMutationProjection).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      operationExternalId: 'operation-news-update-1',
    });
  });
});
