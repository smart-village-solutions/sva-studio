import { describe, expect, it } from 'vitest';

import {
  registerProjectionFixture,
  ctx,
  fixture,
  computeProjectionSyncStatesForTest,
  listProjectedContentsForTest as listProjectedContents,
  refreshProjectedContentsForTest as refreshProjectedContents,
  refreshProjectedContentsForMainserverMutationForTest as refreshProjectedContentsForMainserverMutation,
  getProjectionTestState,
} from './iam-content-list-projection.test-fixture.js';

const state = getProjectionTestState();

describe('GenericItem content projection mutations', () => {
  registerProjectionFixture();

  it('refreshes generic item projections after direct mainserver mutations', async () => {
    state.getSvaMainserverGenericItem.mockResolvedValue({
      id: 'generic-mutation-1',
      title: 'Mutation Generic Item',
      contentType: 'generic-items.generic-item',
      genericType: 'info',
      teaser: 'Kurztext',
      keywords: ['hinweis'],
      payload: { answer: '42' },
      categories: [],
      contacts: [],
      webUrls: [],
      addresses: [],
      contentBlocks: [],
      openingHours: [],
      mediaContents: [],
      locations: [],
      dates: [],
      accessibilityInformations: [],
      priceInformations: [],
      visible: true,
      author: 'Redaktion',
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-21T10:00:00.000Z',
    });

    await refreshProjectedContentsForMainserverMutation({
      contentType: 'generic-items.generic-item',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'operation-generic-update-1',
      organizationId: 'org-1',
      operation: 'update',
      entityId: 'generic-mutation-1',
    });

    expect(state.getSvaMainserverGenericItem).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOrganizationId: 'org-1',
        genericItemId: 'generic-mutation-1',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
      })
    );
    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        content_type: 'generic-items.generic-item',
        organization_id: 'org-1',
        source_entity_id: 'generic-mutation-1',
      }),
    ]);

    const otherScope = 'de-musterhausen::account-2::org-1::generic-items.generic-item';
    fixture.syncStates.set(`generic-items.generic-item::${otherScope}`, {
      sync_scope_key: otherScope,
      last_started_at: new Date().toISOString(),
      last_succeeded_at: new Date().toISOString(),
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 0,
    });
    await refreshProjectedContentsForMainserverMutation({
      contentType: 'generic-items.generic-item',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      organizationId: 'org-1',
      operation: 'update',
      entityId: 'generic-mutation-1',
    });
    expect(
      fixture.syncStates.get(`generic-items.generic-item::${otherScope}`)?.snapshot_invalidated
    ).not.toBe(true);
  });

  it('applies the credential cooldown before loading generic item details', async () => {
    const syncScopeKey =
      'de-musterhausen::account-1::org-1::organization::generic-items.generic-item';
    fixture.syncStates.set(`generic-items.generic-item::${syncScopeKey}`, {
      sync_scope_key: syncScopeKey,
      last_started_at: '2026-09-13T12:00:00.000Z',
      last_succeeded_at: null,
      last_failed_at: new Date().toISOString(),
      last_error_code: 'mainserver_credentials_stale',
      last_error_message: 'credentials not ready',
      projected_count: 0,
    });

    await expect(
      refreshProjectedContentsForMainserverMutation({
        contentType: 'generic-items.generic-item',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
        actorAccountId: 'account-1',
        actorDisplayName: 'Redaktion',
        mutationRef: 'operation-generic-update-cooldown',
        organizationId: 'org-1',
        operation: 'update',
        entityId: 'generic-mutation-1',
      })
    ).resolves.toBeUndefined();

    expect(state.getSvaMainserverGenericItem).not.toHaveBeenCalled();
    expect(state.readEffectiveSvaMainserverCredentialsWithStatus).not.toHaveBeenCalled();
    expect(state.deferMainserverMutationProjection).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      operationExternalId: 'operation-generic-update-cooldown',
    });
  });

  it('does not close a confirmed transfer when a generic item follow-up cannot be deferred', async () => {
    const syncScopeKey =
      'de-musterhausen::account-1::org-1::organization::projects.project';
    fixture.syncStates.set(`projects.project::${syncScopeKey}`, {
      sync_scope_key: syncScopeKey, last_started_at: '2026-09-13T12:00:00.000Z',
      last_succeeded_at: null, last_failed_at: new Date().toISOString(),
      last_error_code: 'mainserver_credentials_stale',
      last_error_message: 'credentials not ready', projected_count: 0,
    });
    state.deferMainserverMutationProjection.mockResolvedValue(false);
    state.loadMainserverMutationJournal.mockResolvedValue({ completedSteps: [] });

    await expect(refreshProjectedContentsForMainserverMutation({
      contentType: 'projects.project', instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1', actorAccountId: 'account-1',
      auditActorAccountId: 'account-1', actorDisplayName: 'Redaktion',
      mutationRef: 'project-transfer-not-deferred', organizationId: 'org-1',
      ownershipPrincipal: { type: 'organization', id: 'org-1' },
      actingPrincipalType: 'organization', authorizationMode: 'exact',
      credentialFingerprint: 'a'.repeat(64), operation: 'update',
      entityId: 'provider-project-1',
    })).rejects.toThrow('content_transfer_projection_reconciliation_unavailable');
    expect(state.getSvaMainserverGenericItem).not.toHaveBeenCalled();
  });

  it('refreshes only the registered FAQ projection after FAQ mutations', async () => {
    state.getSvaMainserverGenericItem.mockResolvedValue({
      id: 'faq-mutation-1',
      title: 'Mutation FAQ',
      contentType: 'generic-items.generic-item',
      genericType: 'FAQ',
      payload: { answer: '42' },
      categories: [],
      contacts: [],
      webUrls: [],
      addresses: [],
      contentBlocks: [],
      openingHours: [],
      mediaContents: [],
      locations: [],
      dates: [],
      accessibilityInformations: [],
      priceInformations: [],
      visible: true,
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-21T10:00:00.000Z',
    });

    await refreshProjectedContentsForMainserverMutation({
      contentType: 'faq.faq',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      organizationId: 'org-1',
      operation: 'update',
      entityId: 'faq-mutation-1',
    });

    expect(state.getSvaMainserverGenericItem).toHaveBeenCalledTimes(1);
    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        content_type: 'faq.faq',
        source_entity_id: 'faq-mutation-1',
      }),
    ]);
  });

  it('refreshes only the registered project projection for externally created FeaturedProject items', async () => {
    state.getSvaMainserverGenericItem.mockResolvedValue({
      id: 'project-mutation-1',
      title: 'Externes Projekt',
      contentType: 'generic-items.generic-item',
      genericType: 'FeaturedProject',
      payload: { status: 'published' },
      categories: [],
      contacts: [],
      webUrls: [],
      addresses: [],
      contentBlocks: [],
      openingHours: [],
      mediaContents: [],
      locations: [],
      dates: [],
      accessibilityInformations: [],
      priceInformations: [],
      visible: true,
      createdAt: '2026-08-04T10:00:00.000Z',
      updatedAt: '2026-08-04T11:00:00.000Z',
    });

    await refreshProjectedContentsForMainserverMutation({
      contentType: 'projects.project',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      organizationId: 'org-1',
      operation: 'update',
      entityId: 'project-mutation-1',
    });

    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        content_type: 'projects.project',
        source_entity_id: 'project-mutation-1',
      }),
    ]);
  });

  it('archives the bound GenericItem reference after deleting a project', async () => {
    await refreshProjectedContentsForMainserverMutation({
      contentType: 'projects.project',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'project-delete-operation-1',
      organizationId: 'org-1',
      operation: 'delete',
      entityId: 'project-delete-1',
    });

    expect(state.recordSuccessfulExternalContentDeletion).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'project-delete-operation-1',
      sourceSystem: 'mainserver',
      sourceEntityType: 'GenericItem',
      sourceEntityId: 'project-delete-1',
    });
    expect(state.recordSuccessfulExternalContentDeletion).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'project-delete-operation-1',
      sourceSystem: 'mainserver',
      sourceEntityType: 'projects.project',
      sourceEntityId: 'project-delete-1',
    });
  });

  it('continues project refresh after filtered pages and projects every payload variant', async () => {
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [{ action: 'projects.read', resourceType: 'projects' }],
    });
    const genericItem = (input: { id: string; genericType: string; deleted?: boolean }) => ({
      id: input.id,
      title: input.id,
      contentType: 'generic-items.generic-item' as const,
      genericType: input.genericType,
      payload: input.deleted ? { deleted: true } : {},
      categories: [],
      contacts: [],
      webUrls: [],
      addresses: [],
      contentBlocks: [],
      openingHours: [],
      mediaContents: [],
      locations: [],
      dates: [],
      accessibilityInformations: [],
      priceInformations: [],
      visible: true,
      createdAt: '2026-08-04T10:00:00.000Z',
      updatedAt: '2026-08-04T11:00:00.000Z',
    });
    state.listSvaMainserverGenericItems
      .mockResolvedValueOnce({
        data: [genericItem({ id: 'faq-page-one', genericType: 'FAQ' })],
        pagination: { page: 1, pageSize: 100, hasNextPage: true },
      })
      .mockResolvedValueOnce({
        data: [
          genericItem({ id: 'project-active', genericType: 'FeaturedProject' }),
          genericItem({ id: 'project-deleted', genericType: 'FeaturedProject', deleted: true }),
        ],
        pagination: { page: 2, pageSize: 100, hasNextPage: false },
      });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['projects.project'],
      force: true,
    });

    expect(response.status).toBe(200);
    expect(state.listSvaMainserverGenericItems).toHaveBeenCalledTimes(2);
    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        content_type: 'projects.project',
        source_entity_id: 'project-active',
      }),
      expect.objectContaining({
        content_type: 'projects.project',
        source_entity_id: 'project-deleted',
      }),
    ]);

    const listResponse = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      type: 'projects.project',
      visibleTypes: ['projects.project'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    const listPayload = (await listResponse.json()) as {
      data: Array<{ id: string }>;
      pagination: { total: number };
    };
    expect(listPayload.pagination.total).toBe(2);
    expect(listPayload.data.map((item) => item.id).sort()).toEqual([
      'project-active',
      'project-deleted',
    ]);
  });

  it('removes stale specialized sibling projections when the generic type changes', async () => {
    const successorScope = 'de-musterhausen::account-2::org-1::cockpit-cards.cockpit-card';
    fixture.syncStates.set(`cockpit-cards.cockpit-card::${successorScope}`, {
      sync_scope_key: successorScope,
      last_started_at: new Date().toISOString(),
      last_succeeded_at: new Date().toISOString(),
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 0,
    });
    const otherAccountTarget = {
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-2',
      actorAccountId: 'account-2',
      organizationId: 'org-1',
      contentType: 'cockpit-cards.cockpit-card' as const,
    };
    expect((await computeProjectionSyncStatesForTest([otherAccountTarget]))[0]?.isStale).toBe(
      false
    );
    fixture.projectionRows = [
      {
        id: 'generic-type-change-1',
        instance_id: 'de-musterhausen',
        projection_scope_key: 'de-musterhausen::account-1::org-1::organization::faq.faq',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: null,
        content_type: 'faq.faq',
        title: 'Ehemalige FAQ',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'mainserver',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'mainserver',
        author_display_name: 'Redaktion',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-generic-type-change-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'faq.faq',
        source_entity_id: 'generic-type-change-1',
      },
    ];
    fixture.projectionRows.push({
      ...fixture.projectionRows[0]!,
      projection_scope_key: 'de-musterhausen::account-2::org-1::organization::faq.faq',
    });
    const genericItem = {
      id: 'generic-type-change-1',
      title: 'Jetzt eine Kachel',
      contentType: 'generic-items.generic-item',
      genericType: 'COCKPIT_CARD',
      payload: {},
      categories: [],
      contacts: [],
      webUrls: [],
      addresses: [],
      contentBlocks: [],
      openingHours: [],
      mediaContents: [],
      locations: [],
      dates: [],
      accessibilityInformations: [],
      priceInformations: [],
      visible: true,
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-21T10:00:00.000Z',
    };
    state.getSvaMainserverGenericItem.mockResolvedValue(genericItem);

    await refreshProjectedContentsForMainserverMutation({
      contentType: 'generic-items.generic-item',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      organizationId: 'org-1',
      operation: 'update',
      entityId: 'generic-type-change-1',
    });

    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({ content_type: 'cockpit-cards.cockpit-card' }),
    ]);
    expect(fixture.projectionRows.some((row) => row.content_type === 'faq.faq')).toBe(false);
    expect(fixture.projectionRows).toHaveLength(1);
    expect(
      fixture.syncStates.get(`cockpit-cards.cockpit-card::${successorScope}`)?.snapshot_invalidated
    ).toBe(true);
    expect((await computeProjectionSyncStatesForTest([otherAccountTarget]))[0]?.isStale).toBe(true);
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [
        { action: 'faq.read', resourceType: 'faq' },
        { action: 'cockpit-cards.read', resourceType: 'cockpit-cards' },
      ],
    });
    const listOptions = {
      page: 1,
      pageSize: 25,
      type: 'cockpit-cards.cockpit-card' as const,
      visibleTypes: ['cockpit-cards.cockpit-card' as const],
      sortBy: 'updatedAt' as const,
      sortDirection: 'desc' as const,
    };
    state.listSvaMainserverGenericItems.mockResolvedValue({
      credentialSource: 'organization',
      data: [genericItem],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });
    await refreshProjectedContents(ctx, {
      visibleTypes: ['cockpit-cards.cockpit-card'],
      force: true,
    });
    const firstList = await listProjectedContents(ctx, listOptions);
    expect(firstList.status).toBe(200);
    expect(
      ((await firstList.json()) as { data: Array<{ id: string }> }).data.map((row) => row.id)
    ).toEqual(['generic-type-change-1']);

    state.resolveActorAccountId.mockResolvedValue('account-2');
    state.listSvaMainserverGenericItems.mockRejectedValueOnce(new Error('temporary failure'));
    const failedRefresh = await refreshProjectedContents(ctx, {
      visibleTypes: ['cockpit-cards.cockpit-card'],
      force: true,
    });
    expect((await failedRefresh.json()) as { data: { status: string } }).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) })
    );
    expect(
      fixture.syncStates.get(`cockpit-cards.cockpit-card::${successorScope}`)?.snapshot_invalidated
    ).toBe(true);
    const secondRefresh = await refreshProjectedContents(ctx, {
      visibleTypes: ['cockpit-cards.cockpit-card'],
      force: true,
    });
    expect((await secondRefresh.json()) as { data: { status: string } }).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) })
    );
    const secondList = await listProjectedContents(ctx, listOptions);
    expect(secondList.status).toBe(200);
    expect(
      ((await secondList.json()) as { data: Array<{ id: string }> }).data.map((row) => row.id)
    ).toEqual(['generic-type-change-1']);
    expect(
      fixture.syncStates.get(`cockpit-cards.cockpit-card::${successorScope}`)?.snapshot_invalidated
    ).toBe(false);
    expect((await computeProjectionSyncStatesForTest([otherAccountTarget]))[0]?.isStale).toBe(
      false
    );
    expect(
      fixture.projectionRows.filter((row) => row.content_type === 'cockpit-cards.cockpit-card')
    ).toHaveLength(3);
    expect(
      [...fixture.syncStates.keys()].some(
        (key) => key.startsWith('faq.faq::') && key !== 'faq.faq::__mainserver_global_mutation__'
      )
    ).toBe(false);
  });

  it('falls back to the generic projection when a specialized item gets an unclaimed type', async () => {
    fixture.projectionRows = [
      {
        id: 'generic-type-fallback-1',
        instance_id: 'de-musterhausen',
        projection_scope_key: 'de-musterhausen::account-1::org-1::organization::faq.faq',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: null,
        content_type: 'faq.faq',
        title: 'Ehemalige FAQ',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'mainserver',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'mainserver',
        author_display_name: 'Redaktion',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-generic-type-fallback-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'faq.faq',
        source_entity_id: 'generic-type-fallback-1',
      },
    ];
    state.getSvaMainserverGenericItem.mockResolvedValue({
      id: 'generic-type-fallback-1',
      title: 'Jetzt technisch',
      contentType: 'generic-items.generic-item',
      genericType: 'FUTURE_TYPE',
      payload: {},
      categories: [],
      contacts: [],
      webUrls: [],
      addresses: [],
      contentBlocks: [],
      openingHours: [],
      mediaContents: [],
      locations: [],
      dates: [],
      accessibilityInformations: [],
      priceInformations: [],
      visible: true,
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-21T10:00:00.000Z',
    });

    await refreshProjectedContentsForMainserverMutation({
      contentType: 'faq.faq',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      organizationId: 'org-1',
      operation: 'update',
      entityId: 'generic-type-fallback-1',
    });

    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        content_type: 'generic-items.generic-item',
        source_entity_id: 'generic-type-fallback-1',
      }),
    ]);
  });

  it('rejects an incomplete snapshot fallback after a targeted generic item read fails', async () => {
    state.getSvaMainserverGenericItem.mockRejectedValueOnce(new Error('target read failed'));
    state.listSvaMainserverGenericItems.mockRejectedValue(new Error('snapshot read failed'));

    await expect(
      refreshProjectedContentsForMainserverMutation({
        contentType: 'generic-items.generic-item',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
        actorAccountId: 'account-1',
        organizationId: 'org-1',
        operation: 'update',
        entityId: 'generic-fallback-failure-1',
      })
    ).rejects.toThrow('content_projection_refresh_incomplete');
  });

  it('defers a confirmed project transfer when only the snapshot fallback succeeds', async () => {
    process.env.SVA_CONTENT_PROJECTION_HOT_COMPLETION_ENABLED = 'true';
    state.getSvaMainserverGenericItem.mockRejectedValueOnce(new Error('target read failed'));
    state.listSvaMainserverGenericItems.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });
    state.deferMainserverMutationProjection.mockResolvedValueOnce(true);

    await expect(refreshProjectedContentsForMainserverMutation({
      contentType: 'projects.project',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      auditActorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'project-transfer-1',
      ownershipPrincipal: { type: 'account', id: 'account-1' },
      actingPrincipalType: 'user',
      authorizationMode: 'exact',
      credentialFingerprint: 'a'.repeat(64),
      operation: 'update',
      entityId: 'provider-project-1',
    })).resolves.toBe(true);

    expect(state.deferMainserverMutationProjection).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      operationExternalId: 'project-transfer-1',
    });
    expect(state.recordSuccessfulExternalContentMutation).not.toHaveBeenCalled();
  });

  it('accepts a concurrently reconciled transfer after the snapshot fallback', async () => {
    state.getSvaMainserverGenericItem.mockRejectedValueOnce(new Error('target read failed'));
    state.deferMainserverMutationProjection.mockResolvedValueOnce(false);
    state.loadMainserverMutationJournal.mockResolvedValueOnce({
      completedSteps: ['projection_history_reconciled'],
    });

    await expect(refreshProjectedContentsForMainserverMutation({
      contentType: 'projects.project', instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1', actorAccountId: 'account-1',
      auditActorAccountId: 'account-1', actorDisplayName: 'Redaktion',
      mutationRef: 'project-transfer-complete-1',
      ownershipPrincipal: { type: 'account', id: 'account-1' },
      actingPrincipalType: 'user', authorizationMode: 'exact',
      credentialFingerprint: 'a'.repeat(64), operation: 'update',
      entityId: 'provider-project-1',
    })).resolves.toBeUndefined();
    expect(state.loadMainserverMutationJournal).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      operationExternalId: 'project-transfer-complete-1',
    });
  });

  it('keeps a confirmed project transfer deferred when targeted and snapshot reads both fail', async () => {
    state.getSvaMainserverGenericItem.mockRejectedValueOnce(new Error('target read failed'));
    state.listSvaMainserverGenericItems.mockRejectedValue(new Error('snapshot read failed'));
    state.deferMainserverMutationProjection.mockResolvedValueOnce(true);

    await expect(refreshProjectedContentsForMainserverMutation({
      contentType: 'projects.project',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      auditActorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'project-transfer-failed-1',
      ownershipPrincipal: { type: 'account', id: 'account-1' },
      actingPrincipalType: 'user',
      authorizationMode: 'exact',
      credentialFingerprint: 'a'.repeat(64),
      operation: 'update',
      entityId: 'provider-project-1',
    })).rejects.toThrow('content_projection_refresh_incomplete');

    expect(state.deferMainserverMutationProjection).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      operationExternalId: 'project-transfer-failed-1',
    });
    expect(state.recordSuccessfulExternalContentMutation).not.toHaveBeenCalled();
  });

  it('removes only the targeted generic item projection row after delete mutations', async () => {
    fixture.projectionRows = [
      {
        id: 'generic-delete-1',
        instance_id: 'de-musterhausen',
        projection_scope_key:
          'de-musterhausen::account-1::org-1::organization::generic-items.generic-item',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: 'org-1',
        content_type: 'generic-items.generic-item',
        title: 'Wird geloescht',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'mainserver',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'mainserver',
        author_display_name: 'Redaktion',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-generic-delete-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'generic-items.generic-item',
        source_entity_id: 'generic-delete-1',
      },
      {
        id: 'generic-keep-1',
        instance_id: 'de-musterhausen',
        projection_scope_key:
          'de-musterhausen::account-1::org-1::organization::generic-items.generic-item',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: 'org-1',
        content_type: 'generic-items.generic-item',
        title: 'Bleibt',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'mainserver',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'mainserver',
        author_display_name: 'Redaktion',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-generic-keep-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'generic-items.generic-item',
        source_entity_id: 'generic-keep-1',
      },
    ];

    await refreshProjectedContentsForMainserverMutation({
      contentType: 'generic-items.generic-item',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'operation-delete-1',
      organizationId: 'org-1',
      operation: 'delete',
      entityId: 'generic-delete-1',
    });

    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        source_entity_id: 'generic-keep-1',
      }),
    ]);
    expect(state.recordSuccessfulExternalContentDeletion).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'operation-delete-1',
      sourceSystem: 'mainserver',
      sourceEntityType: 'generic-items.generic-item',
      sourceEntityId: 'generic-delete-1',
    });
  });
});
