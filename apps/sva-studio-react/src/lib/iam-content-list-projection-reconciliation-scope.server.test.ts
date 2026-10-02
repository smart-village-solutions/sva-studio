import { describe, expect, it } from 'vitest';

import { buildRefreshDeletionScopeKeys } from './iam-content-list-projection-repository-schema.server.js';
import {
  registerProjectionFixture,
  ctx,
  fixture,
  mapInsertedProjectionRow,
  listProjectedContentsForTest as listProjectedContents,
  refreshProjectedContentsForTest as refreshProjectedContents,
  getProjectionTestState,
} from './iam-content-list-projection.test-fixture.js';

const state = getProjectionTestState();

describe('content projection reconciliation scopes', () => {
  registerProjectionFixture();

  it('includes the readable unscoped key for an explicit principal refresh', () => {
    expect(
      buildRefreshDeletionScopeKeys(
        {
          instanceId: 'de-musterhausen',
          actorAccountId: 'account-1',
          keycloakSubject: 'kc-user-1',
          organizationId: 'org-1',
          actingPrincipalType: 'organization',
          contentType: 'cockpit-cards.cockpit-card',
        },
        'organization'
      )
    ).toEqual([
      'de-musterhausen::account-1::org-1::organization::cockpit-cards.cockpit-card',
      'de-musterhausen::account-1::org-1::cockpit-cards.cockpit-card',
    ]);
  });

  it('removes stale principal-scope rows after a complete mainserver refresh', async () => {
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [{ action: 'cockpit-cards.read', resourceType: 'cockpit-cards' }],
    });
    const stale = mapInsertedProjectionRow({
      id: 'card-deleted-1',
      instance_id: 'de-musterhausen',
      projection_scope_key: 'de-musterhausen::account-1::org-1::user::cockpit-cards.cockpit-card',
      organization_id: 'org-1',
      owner_subject_id: null,
      owner_user_id: null,
      owner_organization_id: null,
      content_type: 'cockpit-cards.cockpit-card',
      title: 'Deleted card',
      published_at: null,
      publish_from: null,
      publish_until: null,
      created_at: '2026-06-20T10:00:00.000Z',
      created_by: 'mainserver',
      updated_at: '2026-06-21T10:00:00.000Z',
      updated_by: 'mainserver',
      author_display_mode: 'user',
      author_display_name: 'Editor',
      payload_json: {},
      status: 'published',
      validation_state: 'valid',
      history_ref: 'mainserver:cockpit-cards.cockpit-card:card-deleted-1',
      current_revision_ref: null,
      last_audit_event_ref: null,
      source_data_provider_id: null,
      source_data_provider_name: null,
      credential_source: 'user',
      credential_fingerprint: null,
      authorization_mode: 'credential_visible_compatibility',
      source_system: 'mainserver',
      source_entity_type: 'cockpit-cards.cockpit-card',
      source_entity_id: 'card-deleted-1',
    });
    fixture.projectionRows = [
      stale,
      {
        ...stale,
        projection_scope_key: 'de-musterhausen::account-2::org-1::user::cockpit-cards.cockpit-card',
      },
      {
        ...stale,
        projection_scope_key:
          'de-musterhausen::account-1::org-1::organization::cockpit-cards.cockpit-card',
        credential_source: 'organization',
      },
    ];
    state.listSvaMainserverGenericItems.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['cockpit-cards.cockpit-card'],
      force: true,
    });

    expect(response.status).toBe(200);
    expect((await response.json()) as { data: { status: string } }).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) })
    );
    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        projection_scope_key: 'de-musterhausen::account-2::org-1::user::cockpit-cards.cockpit-card',
      }),
      expect.objectContaining({
        projection_scope_key:
          'de-musterhausen::account-1::org-1::organization::cockpit-cards.cockpit-card',
      }),
    ]);

    state.listSvaMainserverGenericItems.mockResolvedValue({
      credentialSource: 'organization',
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });
    await refreshProjectedContents(ctx, {
      visibleTypes: ['cockpit-cards.cockpit-card'],
      force: true,
    });
    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        projection_scope_key: 'de-musterhausen::account-2::org-1::user::cockpit-cards.cockpit-card',
      }),
    ]);

    fixture.projectionRows.push(stale);
    fixture.syncStates.set(
      'cockpit-cards.cockpit-card::de-musterhausen::account-1::org-1::user::cockpit-cards.cockpit-card',
      {
        sync_scope_key: stale.projection_scope_key,
        last_started_at: '2999-01-01T00:00:00.000Z',
        last_succeeded_at: '2999-01-01T00:00:00.000Z',
        last_failed_at: null,
        last_error_code: null,
        last_error_message: null,
        projected_count: 1,
      }
    );
    state.listSvaMainserverGenericItems.mockResolvedValue({
      credentialSource: 'user',
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });
    const superseded = await refreshProjectedContents(ctx, {
      visibleTypes: ['cockpit-cards.cockpit-card'],
      force: true,
    });
    expect((await superseded.json()) as { data: { status: string } }).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) })
    );
    expect(fixture.projectionRows).toContainEqual(stale);

    fixture.syncStates.delete(
      'cockpit-cards.cockpit-card::de-musterhausen::account-1::org-1::user::cockpit-cards.cockpit-card'
    );
    fixture.syncStates.set(
      'cockpit-cards.cockpit-card::de-musterhausen::account-2::org-1::user::cockpit-cards.cockpit-card',
      {
        sync_scope_key: 'de-musterhausen::account-2::org-1::user::cockpit-cards.cockpit-card',
        last_started_at: '2999-01-01T00:00:00.000Z',
        last_succeeded_at: '2999-01-01T00:00:00.000Z',
        last_failed_at: null,
        last_error_code: null,
        last_error_message: null,
        projected_count: 1,
      }
    );
    const unrelatedAccount = await refreshProjectedContents(ctx, {
      visibleTypes: ['cockpit-cards.cockpit-card'],
      force: true,
    });
    expect((await unrelatedAccount.json()) as { data: { status: string } }).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) })
    );
    expect(fixture.projectionRows).not.toContainEqual(stale);

    fixture.projectionRows.push(stale);
    fixture.syncStates.set('cockpit-cards.cockpit-card::__mainserver_global_mutation__', {
      sync_scope_key: '__mainserver_global_mutation__',
      last_started_at: '2999-01-01T00:00:00.000Z',
      last_succeeded_at: '2999-01-01T00:00:00.000Z',
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 0,
    });
    const globalMutation = await refreshProjectedContents(ctx, {
      visibleTypes: ['cockpit-cards.cockpit-card'],
      force: true,
    });
    expect((await globalMutation.json()) as { data: { status: string } }).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) })
    );
    expect(fixture.projectionRows).toContainEqual(stale);
  });

  it('stores the same mainserver entity separately for different projection scopes', async () => {
    state.listSvaMainserverEvents.mockResolvedValue({
      data: [
        {
          id: 'event-shared-1',
          title: 'Geteilte Veranstaltung',
          contentType: 'events.event-record',
          status: 'published',
          dates: [],
          recurringWeekdays: [],
          categories: [],
          addresses: [],
          contacts: [],
          urls: [],
          mediaContents: [],
          priceInformations: [],
          tags: [],
          visible: true,
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });
    await refreshProjectedContents(
      {
        ...ctx,
        activeOrganizationId: undefined,
      },
      {
        visibleTypes: ['events.event-record'],
        force: true,
      }
    );

    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        projection_scope_key: 'de-musterhausen::account-1::org-1::events.event-record',
        organization_id: 'org-1',
        owner_user_id: null,
        owner_organization_id: null,
        source_entity_id: 'event-shared-1',
      }),
      expect.objectContaining({
        projection_scope_key: 'de-musterhausen::account-1::no-organization::events.event-record',
        organization_id: null,
        owner_user_id: null,
        owner_organization_id: null,
        source_entity_id: 'event-shared-1',
      }),
    ]);
  });

  it('does not reuse organization-scoped mainserver snapshots across actor accounts', async () => {
    state.listSvaMainserverNews.mockResolvedValue({
      data: [
        {
          id: 'news-account-1',
          title: 'News Account 1',
          contentType: 'news.article',
          payload: { teaser: 'A' },
          status: 'published',
          author: 'Redaktion',
          publishedAt: '2026-06-21T09:00:00.000Z',
          contentBlocks: [],
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article'],
      force: true,
    });

    state.resolveActorAccountId.mockResolvedValue('account-2');
    state.listSvaMainserverNews.mockRejectedValue(new Error('account-2 refresh blocked'));

    const response = await listProjectedContents(
      {
        ...ctx,
        user: {
          ...ctx.user,
          id: 'kc-user-2',
        },
      },
      {
        page: 1,
        pageSize: 100,
        visibleTypes: ['news.article'],
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      }
    );

    const payload = (await response.json()) as {
      metadata: {
        mainserverSyncStates: Array<{ contentType: string; hasSnapshot: boolean }>;
      };
    };

    expect(payload.metadata.mainserverSyncStates).toEqual([
      expect.objectContaining({
        contentType: 'news.article',
        hasSnapshot: false,
      }),
    ]);
  });

  it('deduplicates duplicate mainserver projection rows before insert', async () => {
    state.listSvaMainserverEvents.mockResolvedValue({
      data: [
        {
          id: 'event-duplicate-1',
          title: 'Doppelte Veranstaltung',
          contentType: 'events.event-record',
          status: 'published',
          dates: [],
          recurringWeekdays: [],
          categories: [],
          addresses: [],
          contacts: [],
          urls: [],
          mediaContents: [],
          priceInformations: [],
          tags: [],
          visible: true,
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        },
        {
          id: 'event-duplicate-1',
          title: 'Doppelte Veranstaltung',
          contentType: 'events.event-record',
          status: 'published',
          dates: [],
          recurringWeekdays: [],
          categories: [],
          addresses: [],
          contacts: [],
          urls: [],
          mediaContents: [],
          priceInformations: [],
          tags: [],
          visible: true,
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });

    expect(response.status).toBe(200);
    expect(fixture.projectionInsertArgs).toHaveLength(1);
    expect(JSON.parse(String(fixture.projectionInsertArgs?.[0] ?? '[]'))).toHaveLength(1);
    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        content_type: 'events.event-record',
        source_entity_id: 'event-duplicate-1',
      }),
    ]);
  });

  it('upserts mainserver projection rows when a concurrent write recreates the same scope', async () => {
    fixture.simulateConcurrentProjectionConflict = true;
    state.listSvaMainserverEvents.mockResolvedValue({
      data: [
        {
          id: 'event-concurrent-1',
          title: 'Konkurrierende Veranstaltung',
          contentType: 'events.event-record',
          status: 'published',
          dates: [],
          recurringWeekdays: [],
          categories: [],
          addresses: [],
          contacts: [],
          urls: [],
          mediaContents: [],
          priceInformations: [],
          tags: [],
          visible: true,
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });

    expect(response.status).toBe(200);
    expect(fixture.projectionInsertSql).toContain(
      'ON CONFLICT ON CONSTRAINT content_list_projection_scope_key'
    );
    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        content_type: 'events.event-record',
        organization_id: 'org-1',
        source_entity_id: 'event-concurrent-1',
      }),
    ]);
  });

  it('returns deterministic refresh errors for missing instances, permission backend failures, and forbidden types', async () => {
    const missingInstanceResponse = await refreshProjectedContents(
      {
        ...ctx,
        user: {
          ...ctx.user,
          instanceId: undefined,
        },
      },
      {
        visibleTypes: ['events.event-record'],
        force: true,
      }
    );

    expect(missingInstanceResponse.status).toBe(400);
    await expect(missingInstanceResponse.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_instance_id',
      },
    });

    state.resolveEffectivePermissions.mockResolvedValueOnce({
      ok: false,
    });

    const permissionFailureResponse = await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });

    expect(permissionFailureResponse.status).toBe(503);
    await expect(permissionFailureResponse.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
      },
    });

    state.resolveEffectivePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: [],
    });

    const forbiddenResponse = await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });

    expect(forbiddenResponse.status).toBe(403);
    await expect(forbiddenResponse.json()).resolves.toMatchObject({
      error: {
        code: 'forbidden',
      },
    });
  });

  it('returns a deterministic API error when manual refresh cannot resolve the actor account', async () => {
    state.resolveActorAccountId.mockRejectedValueOnce(new Error('db unavailable'));

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article'],
      force: true,
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: 'db unavailable',
      },
      requestId: 'req-1',
    });
  });

  it('returns a deterministic API error when manual refresh gets no actor account for mainserver types', async () => {
    state.resolveActorAccountId.mockResolvedValueOnce(undefined);

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article'],
      force: false,
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: 'Der Akteurkontext fuer Mainserver-Inhalte konnte nicht geladen werden.',
      },
      requestId: 'req-1',
    });
  });
});
