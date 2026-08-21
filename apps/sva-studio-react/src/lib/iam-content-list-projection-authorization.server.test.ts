import { describe, expect, it } from 'vitest';

import {
  registerProjectionFixture,
  ctx,
  fixture,
  listProjectedContentsForTest as listProjectedContents,
  getProjectionTestState,
} from './iam-content-list-projection.test-fixture.js';

const state = getProjectionTestState();

describe('content projection authorization and blocking', () => {
  registerProjectionFixture();

  it('derives row access from the resolved permissions without per-item reauthorization calls', async () => {
    fixture.projectionRows = [
      {
        id: 'content-1',
        instance_id: 'de-musterhausen',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: 'account-1',
        owner_organization_id: 'org-1',
        content_type: 'generic',
        title: 'Visible',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'account-1',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'account-1',
        author_display_name: 'Alice',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'iam',
        source_entity_type: 'iam.contents',
        source_entity_id: 'content-1',
      },
    ];
    state.authorizeContentPrimitiveForUser.mockImplementation(
      async ({ action }: { action: string }) =>
        action === 'content.read'
          ? {
              ok: true,
              actor: {
                instanceId: 'de-musterhausen',
                keycloakSubject: 'kc-user-1',
              },
              permissions: [
                { action: 'content.read', resourceType: 'content' },
                { action: 'content.create', resourceType: 'content' },
                { action: 'content.updateMetadata', resourceType: 'content' },
              ],
            }
          : {
              ok: false,
              status: 403,
              error: 'forbidden',
              message: 'forbidden',
            }
    );
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [
        { action: 'content.read', resourceType: 'content' },
        { action: 'content.create', resourceType: 'content' },
        { action: 'content.updateMetadata', resourceType: 'content' },
      ],
    });

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['generic'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [
        expect.objectContaining({
          id: 'content-1',
          access: expect.objectContaining({
            state: 'editable',
            canCreate: true,
            canUpdate: true,
          }),
        }),
      ],
    });
    expect(state.authorizeContentPrimitiveForUser).not.toHaveBeenCalled();
  });

  it('keeps own-scoped readers on the list and filters rows by creator later', async () => {
    fixture.projectionRows = [
      {
        id: 'content-1',
        instance_id: 'de-musterhausen',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: 'account-1',
        owner_organization_id: 'org-1',
        content_type: 'generic',
        title: 'Own Row',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'account-1',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'account-1',
        author_display_name: 'Alice',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'iam',
        source_entity_type: 'iam.contents',
        source_entity_id: 'content-1',
      },
      {
        id: 'content-2',
        instance_id: 'de-musterhausen',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: 'account-9',
        owner_organization_id: 'org-1',
        content_type: 'generic',
        title: 'Other Row',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'account-9',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'account-9',
        author_display_name: 'Bob',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-2',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'iam',
        source_entity_type: 'iam.contents',
        source_entity_id: 'content-2',
      },
    ];
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [{ action: 'content.read', resourceType: 'content', accessScope: 'own' }],
    });

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['generic'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'content-1', title: 'Own Row' })],
      pagination: {
        total: 1,
      },
    });
  });

  it('returns sync metadata instead of failing the full list when the mainserver refresh fails', async () => {
    state.listSvaMainserverNews.mockRejectedValue(
      Object.assign(new Error('upstream down'), { code: 'database_unavailable' })
    );

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    const payload = (await response.json()) as {
      data: Array<{ id: string }>;
      pagination: {
        page: number;
        pageSize: number;
        total: number;
      };
      metadata: {
        hasStaleMainserverContent: boolean;
        hasBlockingSyncGap: boolean;
        mainserverSyncStates: Array<{
          contentType: string;
          hasSnapshot: boolean;
          isStale: boolean;
          lastErrorCode?: string;
        }>;
      };
      requestId: string;
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([]);
    expect(payload.pagination).toEqual({
      page: 1,
      pageSize: 25,
      total: 0,
    });
    expect(payload.metadata.hasStaleMainserverContent).toBe(true);
    expect(payload.metadata.hasBlockingSyncGap).toBe(true);
    expect(payload.metadata.mainserverSyncStates).toEqual([
      expect.objectContaining({
        contentType: 'news.article',
        hasSnapshot: false,
        isStale: true,
      }),
    ]);
    expect(payload.requestId).toBe('req-1');
  });

  it('keeps mainserver rows visible for organization-scoped plugin read permissions', async () => {
    fixture.projectionRows = [
      {
        id: 'news-1',
        instance_id: 'de-musterhausen',
        projection_scope_key: 'de-musterhausen::account-1::org-1::news.article',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: 'org-1',
        content_type: 'news.article',
        title: 'Rathaus',
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
        history_ref: 'history-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-1',
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
    state.authorizeContentPrimitiveForUser.mockImplementation(
      async ({ action }: { action: string }) =>
        action === 'news.read'
          ? {
              ok: true,
              actor: {
                instanceId: 'de-musterhausen',
                keycloakSubject: 'kc-user-1',
                organizationId: 'org-1',
              },
              permissions: [
                {
                  action,
                  resourceType: 'news',
                  organizationId: 'org-1',
                  accessScope: 'organization',
                },
              ],
            }
          : {
              ok: false,
              status: 403,
              error: 'forbidden',
              message: 'forbidden',
            }
    );
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [
        {
          action: 'news.read',
          resourceType: 'news',
          organizationId: 'org-1',
          accessScope: 'organization',
        },
      ],
    });

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'news-1', organizationId: 'org-1' })],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
      },
      requestId: 'req-1',
    });
  });

  it('keeps own mainserver rows visible when no active organization is set', async () => {
    fixture.projectionRows = [
      {
        id: 'news-1',
        instance_id: 'de-musterhausen',
        projection_scope_key: 'de-musterhausen::account-1::no-organization::news.article',
        organization_id: null,
        owner_subject_id: null,
        owner_user_id: 'account-1',
        owner_organization_id: null,
        content_type: 'news.article',
        title: 'Rathaus',
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
        history_ref: 'history-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-1',
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
          id: 'news-1',
          title: 'Rathaus',
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
    state.authorizeContentPrimitiveForUser.mockImplementation(
      async ({ action }: { action: string }) =>
        action === 'news.read'
          ? {
              ok: true,
              actor: {
                instanceId: 'de-musterhausen',
                keycloakSubject: 'kc-user-1',
              },
              permissions: [
                {
                  action,
                  resourceType: 'news',
                  organizationId: 'org-1',
                  accessScope: 'organization',
                },
              ],
            }
          : {
              ok: false,
              status: 403,
              error: 'forbidden',
              message: 'forbidden',
            }
    );
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [
        {
          action: 'news.read',
          resourceType: 'news',
          organizationId: 'org-1',
          accessScope: 'organization',
        },
      ],
    });

    const response = await listProjectedContents(
      {
        ...ctx,
        activeOrganizationId: undefined,
      },
      {
        page: 1,
        pageSize: 25,
        visibleTypes: ['news.article'],
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      }
    );

    await expect(response.json()).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ id: 'news-1' })]),
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
      },
    });
  });

  it('does not fail the full list for stale legacy org-less mainserver rows in organization-scoped views', async () => {
    fixture.projectionRows = [
      {
        id: 'news-legacy',
        instance_id: 'de-musterhausen',
        organization_id: null,
        owner_subject_id: null,
        content_type: 'news.article',
        title: 'Legacy',
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
        history_ref: 'history-legacy',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-legacy',
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
    state.authorizeContentPrimitiveForUser.mockImplementation(
      async ({ action }: { action: string }) =>
        action === 'news.read'
          ? {
              ok: true,
              actor: {
                instanceId: 'de-musterhausen',
                keycloakSubject: 'kc-user-1',
                organizationId: 'org-1',
              },
              permissions: [
                {
                  action,
                  resourceType: 'news',
                  organizationId: 'org-1',
                  accessScope: 'organization',
                },
              ],
            }
          : {
              ok: false,
              status: 403,
              error: 'forbidden',
              message: 'forbidden',
            }
    );
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [
        {
          action: 'news.read',
          resourceType: 'news',
          organizationId: 'org-1',
          accessScope: 'organization',
        },
      ],
    });

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    expect(response.status).toBe(200);
  });

  it('does not block unfiltered lists when another scope is missing a mainserver snapshot', async () => {
    fixture.projectionRows = [
      {
        id: 'content-1',
        instance_id: 'de-musterhausen',
        organization_id: 'org-1',
        owner_subject_id: null,
        content_type: 'generic',
        title: 'Visible',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'account-9',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'account-9',
        author_display_name: 'Alice',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'iam',
        source_entity_type: 'iam.contents',
        source_entity_id: 'content-1',
      },
      {
        id: 'news-foreign',
        instance_id: 'de-musterhausen',
        organization_id: 'org-2',
        owner_subject_id: null,
        content_type: 'news.article',
        title: 'Foreign',
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
        history_ref: 'history-news',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-foreign',
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

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ id: 'content-1' })]),
      pagination: {
        page: 1,
        pageSize: 25,
      },
      requestId: 'req-1',
    });
  });

  it('returns a blocking 503 when an explicitly requested mainserver type has no snapshot yet', async () => {
    state.listSvaMainserverNews.mockRejectedValueOnce(
      Object.assign(new Error('upstream down'), { code: 'database_unavailable' })
    );

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      type: 'news.article',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message:
          'Für mindestens einen angefragten Mainserver-Inhaltstyp liegt noch kein synchronisierter Snapshot vor.',
      },
      requestId: 'req-1',
    });
  });

  it('treats the empty visible type sentinel as an empty list instead of forbidden', async () => {
    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['__no_readable_content__'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 0,
      },
      requestId: 'req-1',
    });
    expect(state.authorizeContentPrimitiveForUser).not.toHaveBeenCalled();
  });

  it('preserves unfiltered list semantics when neither type nor visibleTypes are supplied', async () => {
    fixture.projectionRows = [
      {
        id: 'content-1',
        instance_id: 'de-musterhausen',
        organization_id: 'org-1',
        owner_subject_id: null,
        content_type: 'generic',
        title: 'Visible',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'account-9',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'account-9',
        author_display_name: 'Alice',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'iam',
        source_entity_type: 'iam.contents',
        source_entity_id: 'content-1',
      },
    ];

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'content-1' })],
      pagination: {
        total: 1,
      },
    });
  });
});
