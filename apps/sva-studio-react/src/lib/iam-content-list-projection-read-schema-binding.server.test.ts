import { describe, expect, it, vi } from 'vitest';

import {
  registerProjectionFixture,
  ctx,
  fixture,
  listProjectedContentsForTest as listProjectedContents,
  refreshProjectedContentsForTest as refreshProjectedContents,
  getProjectionTestState,
} from './iam-content-list-projection.test-fixture.js';

const state = getProjectionTestState();

describe('content projection schema and binding compatibility', () => {
  registerProjectionFixture();

  it('returns an empty list when type and visibleType do not intersect', async () => {
    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      type: 'news.article',
      visibleTypes: ['poi.point-of-interest'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toEqual({
      data: [],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 0,
      },
      requestId: 'req-1',
    });
  });

  it('starts a refresh when a missing snapshot can be rebuilt during the request', async () => {
    state.listSvaMainserverNews.mockResolvedValue({
      data: [
        {
          id: 'news-1',
          title: 'Rathaus',
          contentType: 'news.article',
          payload: { teaser: 'A' },
          status: 'published',
          author: 'Redaktion',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
          contentBlocks: [],
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    const payload = (await response.json()) as {
      data: Array<{ id: string }>;
      metadata: {
        hasBlockingSyncGap: boolean;
        hasRunningMainserverSync: boolean;
        mainserverSyncStates: Array<{ contentType: string; hasSnapshot: boolean }>;
      };
      pagination: {
        total: number;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([]);
    expect(payload.pagination.total).toBe(0);
    expect(payload.metadata.hasBlockingSyncGap).toBe(true);
    expect(payload.metadata.hasRunningMainserverSync).toBe(true);
    expect(
      payload.metadata.mainserverSyncStates.some((entry) => entry.contentType === 'news.article')
    ).toBe(true);
    expect(state.listSvaMainserverNews).toHaveBeenCalledTimes(1);
    expect(state.listSvaMainserverNews).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: 'updatedAt_DESC',
      })
    );
    expect(fixture.syncStates.get('news.article')?.last_started_at).toBeTruthy();
    expect(fixture.projectionInsertArgs).toHaveLength(1);
  });

  it('keeps the legacy sync-state schema readable while scoped rows are refreshed', async () => {
    fixture.syncScopeKeyColumnAvailable = false;
    fixture.projectionRows = [
      {
        id: 'news-1',
        instance_id: 'de-musterhausen',
        projection_scope_key: 'de-musterhausen::account-1::org-1::news.article',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: null,
        content_type: 'news.article',
        title: 'Legacy Snapshot',
        published_at: '2026-06-21T09:00:00.000Z',
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
        history_ref: 'history-legacy-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        authorization_mode: 'credential_visible_compatibility',
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-1',
      },
    ];
    fixture.syncStates.set('news.article', {
      last_started_at: null,
      last_succeeded_at: '2026-06-20T10:00:00.000Z',
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 1,
    });
    state.listSvaMainserverNews.mockResolvedValue({
      data: [
        {
          id: 'news-1',
          title: 'Legacy Snapshot',
          contentType: 'news.article',
          payload: {},
          status: 'published',
          author: 'Redaktion',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
          contentBlocks: [],
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    const payload = (await response.json()) as {
      data: Array<{ id: string }>;
      metadata: {
        mainserverSyncStates: Array<{ contentType: string; hasSnapshot: boolean }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([expect.objectContaining({ id: 'news-1' })]);
    expect(
      payload.metadata.mainserverSyncStates.some((entry) => entry.contentType === 'news.article')
    ).toBe(true);
  });

  it('falls back to the legacy projection schema when projection_scope_key is not available yet', async () => {
    fixture.syncScopeKeyColumnAvailable = false;
    fixture.projectionScopeKeyColumnAvailable = false;
    fixture.projectionRows = [
      {
        id: 'news-legacy-projection-1',
        instance_id: 'de-musterhausen',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: 'org-1',
        content_type: 'news.article',
        title: 'Legacy Projektion',
        published_at: '2026-06-21T09:00:00.000Z',
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
        history_ref: 'history-legacy-projection-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-legacy-projection-1',
      },
    ];
    fixture.syncStates.set('news.article', {
      last_started_at: null,
      last_succeeded_at: new Date().toISOString(),
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 1,
    });
    state.listSvaMainserverNews.mockResolvedValue({
      data: [
        {
          id: 'news-legacy-projection-1',
          title: 'Legacy Projection',
          contentType: 'news.article',
          payload: {},
          status: 'published',
          author: 'Redaktion',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
          contentBlocks: [],
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article'],
      force: false,
    });

    await expect(response.json()).resolves.toEqual({
      data: {
        status: 'completed',
        syncStates: [
          expect.objectContaining({
            contentType: 'news.article',
            hasSnapshot: true,
          }),
        ],
      },
      requestId: 'req-1',
    });
  });

  it('does not fail when the projection schema changes after a cached legacy mode', async () => {
    fixture.projectionScopeKeyColumnAvailable = false;
    fixture.syncScopeKeyColumnAvailable = false;

    await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article'],
      force: false,
    });

    fixture.projectionScopeKeyColumnAvailable = true;
    fixture.syncScopeKeyColumnAvailable = true;
    fixture.simulateLegacyProjectionSchemaMismatchOnce = true;
    state.listSvaMainserverNews.mockResolvedValue({
      data: [
        {
          id: 'news-schema-retry-1',
          title: 'Schema Retry',
          contentType: 'news.article',
          payload: { teaser: 'A' },
          status: 'published',
          author: 'Redaktion',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
          contentBlocks: [],
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article'],
      force: true,
    });

    expect(response.status).toBe(200);
  });

  it('re-detects the scoped sync-state schema after a cached legacy mode collides once', async () => {
    fixture.projectionScopeKeyColumnAvailable = false;
    fixture.syncScopeKeyColumnAvailable = false;

    await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article'],
      force: false,
    });

    fixture.projectionScopeKeyColumnAvailable = true;
    fixture.syncScopeKeyColumnAvailable = true;
    fixture.simulateLegacySyncStateSchemaMismatchOnce = true;
    state.listSvaMainserverNews.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article'],
      force: true,
    });
    const payload = (await response.json()) as {
      data: {
        syncStates: Array<{ contentType: string; hasSnapshot: boolean }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.syncStates).toEqual([
      expect.objectContaining({
        contentType: 'news.article',
        hasSnapshot: true,
      }),
    ]);
    expect(
      fixture.syncStates.get('news.article::de-musterhausen::account-1::org-1::news.article')
    ).toEqual(
      expect.objectContaining({
        sync_scope_key: 'de-musterhausen::account-1::org-1::news.article',
      })
    );
  });

  it('persists compatibility state and credential fingerprint without inventing ownership', async () => {
    state.listSvaMainserverNews.mockResolvedValue({
      credentialSource: 'user',
      data: [
        {
          id: 'news-1',
          title: 'Rathaus',
          contentType: 'news.article',
          payload: { teaser: 'A' },
          status: 'published',
          author: 'Redaktion',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
          contentBlocks: [],
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(fixture.projectionInsertArgs).not.toBeNull());
    const insertedRows = JSON.parse(String(fixture.projectionInsertArgs?.[0] ?? '[]')) as Array<
      Record<string, unknown>
    >;
    expect(insertedRows).toEqual([
      expect.objectContaining({
        organization_id: 'org-1',
        owner_organization_id: null,
        credential_source: 'user',
        credential_fingerprint: 'a'.repeat(64),
        authorization_mode: 'credential_visible_compatibility',
      }),
    ]);
  });

  it('derives exact projection owners only from current verified bindings', async () => {
    state.loadCurrentMainserverDataProviderBinding.mockImplementation(
      async (input: { principalType: 'organization' | 'user' }) => ({
        dataProviderId:
          input.principalType === 'organization' ? 'provider-organization' : 'provider-user',
      })
    );
    state.listSvaMainserverNews.mockResolvedValue({
      credentialSource: 'organization',
      data: [
        {
          id: 'news-organization',
          title: 'Organisation',
          contentType: 'news.article',
          payload: {},
          status: 'published',
          author: 'Redaktion',
          dataProvider: { id: 'provider-organization', name: 'Organisation' },
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
          contentBlocks: [],
        },
        {
          id: 'news-foreign',
          title: 'Fremd',
          contentType: 'news.article',
          payload: {},
          status: 'published',
          author: 'Redaktion',
          dataProvider: { id: 'provider-foreign', name: 'Fremd' },
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
          contentBlocks: [],
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article'],
      force: true,
    });

    expect(response.status).toBe(200);
    const insertedRows = JSON.parse(String(fixture.projectionInsertArgs?.[0] ?? '[]')) as Array<
      Record<string, unknown>
    >;
    expect(insertedRows).toEqual([
      expect.objectContaining({
        id: 'news-organization',
        owner_user_id: null,
        owner_organization_id: 'org-1',
        credential_fingerprint: 'b'.repeat(64),
        authorization_mode: 'exact',
      }),
      expect.objectContaining({
        id: 'news-foreign',
        owner_user_id: null,
        owner_organization_id: null,
        authorization_mode: 'exact',
      }),
    ]);
  });

  it('populates binding metadata in shadow mode without changing projected read ownership', async () => {
    process.env.SVA_MAINSERVER_SCOPE_RESOLVER_MODE = 'shadow';
    state.loadCurrentMainserverDataProviderBinding.mockImplementation(
      async (input: { principalType: 'organization' | 'user' }) => ({
        dataProviderId:
          input.principalType === 'organization' ? 'provider-organization' : 'provider-user',
      })
    );
    state.listSvaMainserverNews.mockResolvedValue({
      credentialSource: 'organization',
      data: [
        {
          id: 'news-shadow',
          title: 'Shadow',
          contentType: 'news.article',
          payload: {},
          status: 'published',
          author: 'Redaktion',
          dataProvider: { id: 'provider-organization', name: 'Organisation' },
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
          contentBlocks: [],
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article'],
      force: true,
    });

    expect(response.status).toBe(200);
    const insertedRows = JSON.parse(String(fixture.projectionInsertArgs?.[0] ?? '[]')) as Array<
      Record<string, unknown>
    >;
    expect(insertedRows).toEqual([
      expect.objectContaining({
        id: 'news-shadow',
        source_data_provider_id: 'provider-organization',
        credential_fingerprint: 'b'.repeat(64),
        authorization_mode: 'credential_visible_compatibility',
        owner_user_id: null,
        owner_organization_id: null,
      }),
    ]);
  });

  it('falls back to credential-visible ownership when binding resolution fails', async () => {
    state.loadCurrentMainserverDataProviderBinding.mockRejectedValueOnce(
      new Error('binding backend unavailable')
    );
    state.listSvaMainserverNews.mockResolvedValue({
      credentialSource: 'user',
      data: [
        {
          id: 'news-binding-failure',
          title: 'Binding fehlt',
          contentType: 'news.article',
          payload: {},
          status: 'published',
          author: 'Redaktion',
          dataProvider: { id: 'provider-user', name: 'Redaktion' },
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
          contentBlocks: [],
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article'],
      force: true,
    });

    expect(response.status).toBe(200);
    const insertedRows = JSON.parse(String(fixture.projectionInsertArgs?.[0] ?? '[]')) as Array<
      Record<string, unknown>
    >;
    expect(insertedRows).toEqual([
      expect.objectContaining({
        id: 'news-binding-failure',
        authorization_mode: 'credential_visible_compatibility',
        owner_user_id: null,
        owner_organization_id: null,
      }),
    ]);
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'mainserver_projection_binding_state_failed',
      expect.objectContaining({
        instance_id: 'de-musterhausen',
        content_type: 'news.article',
        error_code: 'Error',
      })
    );
  });
});
