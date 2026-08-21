import { describe, expect, it } from 'vitest';

import {
  registerProjectionFixture,
  ctx,
  fixture,
  listProjectedContentsForTest as listProjectedContents,
  getProjectionTestState,
} from './iam-content-list-projection.test-fixture.js';

const state = getProjectionTestState();

describe('content projection snapshot reads', () => {
  registerProjectionFixture();

  it('returns sync metadata together with an existing snapshot', async () => {
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
        authorization_mode: 'credential_visible_compatibility',
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-1',
      },
    ];
    fixture.syncStates.set('news.article::de-musterhausen::account-1::org-1::news.article', {
      sync_scope_key: 'de-musterhausen::account-1::org-1::news.article',
      last_started_at: null,
      last_succeeded_at: '2020-06-20T10:00:00.000Z',
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 1,
    });
    state.listSvaMainserverNews.mockImplementation(() => new Promise(() => undefined));

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    const payload = (await response.json()) as {
      data: Array<{ id: string; title: string }>;
      metadata: {
        hasStaleMainserverContent: boolean;
        hasRunningMainserverSync: boolean;
        mainserverSyncStates: Array<{ contentType: string; isStale: boolean }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([expect.objectContaining({ id: 'news-1' })]);
    expect(payload.metadata.mainserverSyncStates).toEqual([
      expect.objectContaining({
        contentType: 'news.article',
        hasSnapshot: true,
      }),
    ]);
  });

  it('keeps pagination total aligned with organization-scoped read visibility', async () => {
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
        id: 'content-2',
        instance_id: 'de-musterhausen',
        organization_id: 'org-2',
        owner_subject_id: null,
        owner_user_id: 'account-2',
        owner_organization_id: 'org-2',
        content_type: 'generic',
        title: 'Hidden',
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
                {
                  action,
                  resourceType: 'content',
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
          action: 'content.read',
          resourceType: 'content',
          organizationId: 'org-1',
          accessScope: 'organization',
        },
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
      data: [expect.objectContaining({ id: 'content-1', title: 'Visible' })],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
      },
      requestId: 'req-1',
    });
  });

  it('rolls stale exact projection rows back to credential visibility outside automatic mode', async () => {
    process.env.SVA_MAINSERVER_SCOPE_RESOLVER_MODE = 'compatibility';
    fixture.projectionRows = [
      {
        id: 'news-stale-exact-1',
        instance_id: 'de-musterhausen',
        projection_scope_key: 'de-musterhausen::account-1::org-1::news.article',
        organization_id: 'org-2',
        owner_subject_id: null,
        owner_user_id: 'account-2',
        owner_organization_id: null,
        content_type: 'news.article',
        title: 'Mit Credential sichtbar',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'mainserver',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'mainserver',
        author_display_name: 'DataProvider',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-news-stale-exact-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        authorization_mode: 'exact',
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-stale-exact-1',
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
    const permissions = [
      { action: 'news.read', resourceType: 'news', accessScope: 'own' as const },
      { action: 'news.update', resourceType: 'news', accessScope: 'own' as const },
    ];
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'kc-user-1' },
      permissions,
    });
    state.resolveEffectivePermissions.mockResolvedValue({ ok: true, permissions });

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [
        expect.objectContaining({
          id: 'news-stale-exact-1',
          access: expect.objectContaining({ state: 'editable', canUpdate: true }),
        }),
      ],
      pagination: { total: 1 },
    });
  });
});
