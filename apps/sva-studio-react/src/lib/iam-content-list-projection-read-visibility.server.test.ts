import { describe, expect, it } from 'vitest';

import {
  registerProjectionFixture,
  ctx,
  fixture,
  listProjectedContentsForTest as listProjectedContents,
  getProjectionTestState,
} from './iam-content-list-projection.test-fixture.js';

const state = getProjectionTestState();

describe('content projection read visibility', () => {
  registerProjectionFixture();

  it('keeps own and organization scoped mainserver duplicates out of the visible result set', async () => {
    fixture.projectionRows = [
      {
        id: 'poi-org-1',
        instance_id: 'de-musterhausen',
        projection_scope_key: 'de-musterhausen::account-1::org-1::poi.point-of-interest',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: 'org-1',
        content_type: 'poi.point-of-interest',
        title: 'Haus der Familie e.V.',
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
        history_ref: 'history-poi-org',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'poi.point-of-interest',
        source_entity_id: 'poi-shared-1',
      },
      {
        id: 'poi-own-1',
        instance_id: 'de-musterhausen',
        projection_scope_key: 'de-musterhausen::account-1::org-1::poi.point-of-interest',
        organization_id: null,
        owner_subject_id: null,
        owner_user_id: 'account-1',
        owner_organization_id: null,
        content_type: 'poi.point-of-interest',
        title: 'Haus der Familie e.V.',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'mainserver',
        updated_at: '2026-06-22T10:00:00.000Z',
        updated_by: 'mainserver',
        author_display_name: 'Redaktion',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-poi-own',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'poi.point-of-interest',
        source_entity_id: 'poi-shared-1',
      },
    ];
    fixture.syncStates.set('poi.point-of-interest', {
      last_started_at: null,
      last_succeeded_at: '2026-06-20T10:00:00.000Z',
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 2,
    });
    state.authorizeContentPrimitiveForUser.mockImplementation(
      async ({ action }: { action: string }) =>
        action === 'poi.read'
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
                  resourceType: 'poi',
                  organizationId: 'org-1',
                  accessScope: 'organization',
                },
                {
                  action,
                  resourceType: 'poi',
                  accessScope: 'own',
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
          action: 'poi.read',
          resourceType: 'poi',
          organizationId: 'org-1',
          accessScope: 'organization',
        },
        {
          action: 'poi.read',
          resourceType: 'poi',
          accessScope: 'own',
        },
      ],
    });

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['poi.point-of-interest'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 0,
      },
      requestId: 'req-1',
    });
  });

  it('keeps legacy mainserver scope variants with disagreeing content types out of the visible result set', async () => {
    fixture.projectionRows = [
      {
        id: 'poi-org-legacy',
        instance_id: 'de-musterhausen',
        projection_scope_key: 'de-musterhausen::account-1::org-1::poi.point-of-interest',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: 'org-1',
        content_type: 'poi.point-of-interest',
        title: 'Schule 123',
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
        history_ref: 'history-poi-org-legacy',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'poi.point-of-interest',
        source_entity_id: 'poi-shared-legacy',
      },
      {
        id: 'poi-own-legacy',
        instance_id: 'de-musterhausen',
        projection_scope_key: 'de-musterhausen::account-1::org-1::poi.point-of-interest',
        organization_id: null,
        owner_subject_id: null,
        owner_user_id: 'account-1',
        owner_organization_id: null,
        content_type: 'poi.legacy-point-of-interest',
        title: 'Schule 123',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'mainserver',
        updated_at: '2026-06-22T10:00:00.000Z',
        updated_by: 'mainserver',
        author_display_name: 'Redaktion',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-poi-own-legacy',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'poi.point-of-interest',
        source_entity_id: 'poi-shared-legacy',
      },
    ];
    fixture.syncStates.set('poi.point-of-interest', {
      last_started_at: null,
      last_succeeded_at: '2026-06-20T10:00:00.000Z',
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 2,
    });
    state.authorizeContentPrimitiveForUser.mockImplementation(
      async ({ action }: { action: string }) =>
        action === 'poi.read'
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
                  resourceType: 'poi',
                  organizationId: 'org-1',
                  accessScope: 'organization',
                },
                {
                  action,
                  resourceType: 'poi',
                  accessScope: 'own',
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
          action: 'poi.read',
          resourceType: 'poi',
          organizationId: 'org-1',
          accessScope: 'organization',
        },
        {
          action: 'poi.read',
          resourceType: 'poi',
          accessScope: 'own',
        },
      ],
    });

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['poi.point-of-interest'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 0,
      },
      requestId: 'req-1',
    });
  });

  it('finds projected rows when the search term appears only in payload_json', async () => {
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
        payload_json: { teaser: 'Nur im Payload' },
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
      visibleTypes: ['generic'],
      q: 'payload',
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

  it('filters the complete FAQ projection by language before total and pagination', async () => {
    fixture.projectionRows = [
      ['faq-de-older', 'Deutsch alt', 'de', '2026-06-20T10:00:00.000Z'],
      ['faq-en', 'English', 'en', '2026-06-22T10:00:00.000Z'],
      ['faq-de-newer', 'Deutsch neu', 'DE', '2026-06-21T10:00:00.000Z'],
    ].map(([id, title, languageCode, updatedAt]) => ({
      id: id!,
      instance_id: 'de-musterhausen',
      projection_scope_key: 'de-musterhausen::account-1::org-1::faq.faq',
      organization_id: 'org-1',
      owner_subject_id: null,
      owner_user_id: 'account-1',
      owner_organization_id: 'org-1',
      content_type: 'faq.faq',
      title: title!,
      published_at: null,
      publish_from: null,
      publish_until: null,
      created_at: '2026-06-19T10:00:00.000Z',
      created_by: 'mainserver',
      updated_at: updatedAt!,
      updated_by: 'mainserver',
      author_display_name: 'Redaktion',
      payload_json: { languageCode },
      status: 'published' as const,
      validation_state: 'valid' as const,
      history_ref: `history-${id}`,
      current_revision_ref: null,
      last_audit_event_ref: null,
      source_system: 'mainserver' as const,
      source_entity_type: 'GenericItem',
      source_entity_id: id!,
    }));
    fixture.syncStates.set('faq.faq', {
      last_started_at: null,
      last_succeeded_at: new Date().toISOString(),
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 3,
    });
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [{ action: 'faq.read', resourceType: 'faq' }],
    });

    const response = await listProjectedContents(ctx, {
      page: 2,
      pageSize: 1,
      type: 'faq.faq',
      languageCode: 'de',
      visibleTypes: ['faq.faq'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    const payload = (await response.json()) as {
      data: Array<{ id: string }>;
      pagination: { page: number; pageSize: number; total: number };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([expect.objectContaining({ id: 'faq-de-older' })]);
    expect(payload.pagination).toEqual({ page: 2, pageSize: 1, total: 2 });
  });

  it('returns healthy snapshot rows while reporting unsynced mainserver types in metadata', async () => {
    fixture.projectionRows = [
      {
        id: 'news-1',
        instance_id: 'de-musterhausen',
        projection_scope_key: 'de-musterhausen::account-1::org-1::news.article',
        organization_id: 'org-1',
        owner_subject_id: null,
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
        history_ref: 'history-news',
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
    state.listSvaMainserverSurveys.mockRejectedValue(new Error('surveys projection failed'));

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article', 'surveys.survey'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    const payload = (await response.json()) as {
      data: Array<{ id: string }>;
      metadata: {
        hasBlockingSyncGap: boolean;
        mainserverSyncStates: Array<{ contentType: string; hasSnapshot: boolean }>;
      };
      pagination: {
        total: number;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'news-1' })])
    );
    expect(payload.pagination.total).toBe(1);
    expect(payload.metadata.hasBlockingSyncGap).toBe(true);
    expect(payload.metadata.mainserverSyncStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: 'news.article',
          hasSnapshot: true,
        }),
        expect.objectContaining({
          contentType: 'surveys.survey',
          hasSnapshot: false,
        }),
      ])
    );
    expect(state.listSvaMainserverSurveys).toHaveBeenCalledTimes(1);
  });
});
