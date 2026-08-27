import { describe, expect, it } from 'vitest';

import {
  registerProjectionFixture,
  ctx,
  fixture,
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
    state.getSvaMainserverGenericItem.mockResolvedValue({
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
    });

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
    expect([...fixture.syncStates.keys()].some((key) => key.startsWith('faq.faq::'))).toBe(false);
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
