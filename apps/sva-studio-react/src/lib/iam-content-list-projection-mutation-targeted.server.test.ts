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
        contentType: 'poi.point-of-interest',
        mutationRef: 'mutation-1',
        operation: 'update',
        sourceEntityId: 'poi-mutation-1',
        sourceSystem: 'mainserver',
      })
    );
  });

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
});
