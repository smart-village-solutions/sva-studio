import { describe, expect, it } from 'vitest';

import {
  ctx,
  fixture,
  getProjectionTestState,
  listProjectedContentsForTest as listProjectedContents,
  refreshProjectedContentsForTest as refreshProjectedContents,
  refreshProjectedContentsForMainserverMutationForTest as refreshProjectedContentsForMainserverMutation,
  registerProjectionFixture,
} from './iam-content-list-projection.test-fixture.js';

const state = getProjectionTestState();

describe('content projection mutation recovery and audit', () => {
  registerProjectionFixture();

  it('removes only the targeted mainserver projection row after delete mutations', async () => {
    fixture.projectionRows = [
      {
        id: 'poi-delete-1',
        instance_id: 'de-musterhausen',
        projection_scope_key:
          'de-musterhausen::account-1::org-1::organization::poi.point-of-interest',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: 'org-1',
        content_type: 'poi.point-of-interest',
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
        history_ref: 'history-delete-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'poi.point-of-interest',
        source_entity_id: 'poi-delete-1',
      },
      {
        id: 'poi-keep-1',
        instance_id: 'de-musterhausen',
        projection_scope_key:
          'de-musterhausen::account-1::org-1::organization::poi.point-of-interest',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: 'org-1',
        content_type: 'poi.point-of-interest',
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
        history_ref: 'history-keep-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'poi.point-of-interest',
        source_entity_id: 'poi-keep-1',
      },
    ];
    fixture.syncStates.set(
      'poi.point-of-interest::de-musterhausen::account-1::org-1::organization::poi.point-of-interest',
      {
        sync_scope_key: 'de-musterhausen::account-1::org-1::organization::poi.point-of-interest',
        last_started_at: null,
        last_succeeded_at: new Date().toISOString(),
        last_failed_at: null,
        last_error_code: null,
        last_error_message: null,
        projected_count: 2,
      }
    );

    await refreshProjectedContentsForMainserverMutation({
      contentType: 'poi.point-of-interest',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      organizationId: 'org-1',
      operation: 'delete',
      entityId: 'poi-delete-1',
    });

    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        source_entity_id: 'poi-keep-1',
      }),
    ]);
  });

  it('runs targeted mutation refreshes independently from the automatic batch scope', async () => {
    const releaseBatchList = { current: null as (() => void) | null };
    const batchListRelease = new Promise<void>((resolve) => {
      releaseBatchList.current = resolve;
    });
    const markBatchListStarted = { current: null as (() => void) | null };
    const batchListStarted = new Promise<void>((resolve) => {
      markBatchListStarted.current = resolve;
    });

    state.listSvaMainserverPoi.mockImplementation(async () => {
      markBatchListStarted.current?.();
      await batchListRelease;
      return {
        data: [
          {
            id: 'poi-batch-1',
            name: 'Batch POI',
            contentType: 'poi.point-of-interest' as const,
            status: 'published' as const,
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
          },
        ],
        pagination: { page: 1, pageSize: 25, hasNextPage: false },
      };
    });
    state.getSvaMainserverPoi.mockResolvedValue({
      id: 'poi-mutation-queued-1',
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

    const batchRefreshPromise = refreshProjectedContents(ctx, {
      visibleTypes: ['poi.point-of-interest'],
      force: true,
    });

    await batchListStarted;

    const mutationRefreshPromise = refreshProjectedContentsForMainserverMutation({
      contentType: 'poi.point-of-interest',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      organizationId: 'org-1',
      operation: 'update',
      entityId: 'poi-mutation-queued-1',
    });

    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
    }
    expect(state.getSvaMainserverPoi).toHaveBeenCalledTimes(1);

    releaseBatchList.current?.();

    await expect(batchRefreshPromise).resolves.toBeInstanceOf(Response);
    await expect(mutationRefreshPromise).resolves.toBeUndefined();
    expect(fixture.projectionRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source_entity_id: 'poi-batch-1' }),
        expect.objectContaining({ source_entity_id: 'poi-mutation-queued-1' }),
      ])
    );
  });

  it('keeps stale snapshots visible after a targeted mutation refresh fails and leaves reconciliation responsible', async () => {
    const staleSucceededAt = '2026-06-20T10:00:00.000Z';
    fixture.projectionRows = [
      {
        id: 'poi-stale-1',
        instance_id: 'de-musterhausen',
        projection_scope_key:
          'de-musterhausen::account-1::org-1::organization::poi.point-of-interest',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: 'org-1',
        authorization_mode: 'credential_visible_compatibility',
        content_type: 'poi.point-of-interest',
        title: 'Alter Snapshot',
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
        history_ref: 'history-stale-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'poi.point-of-interest',
        source_entity_id: 'poi-stale-1',
      },
    ];
    fixture.syncStates.set(
      'poi.point-of-interest::de-musterhausen::account-1::org-1::organization::poi.point-of-interest',
      {
        sync_scope_key: 'de-musterhausen::account-1::org-1::organization::poi.point-of-interest',
        last_started_at: null,
        last_succeeded_at: staleSucceededAt,
        last_failed_at: null,
        last_error_code: null,
        last_error_message: null,
        projected_count: 1,
      }
    );
    fixture.syncStates.set(
      'poi.point-of-interest::de-musterhausen::account-1::org-1::poi.point-of-interest',
      {
        sync_scope_key: 'de-musterhausen::account-1::org-1::poi.point-of-interest',
        last_started_at: null,
        last_succeeded_at: staleSucceededAt,
        last_failed_at: null,
        last_error_code: null,
        last_error_message: null,
        projected_count: 0,
      }
    );
    state.getSvaMainserverPoi.mockRejectedValue(new Error('detail failed'));
    state.listSvaMainserverPoi.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    await expect(
      refreshProjectedContentsForMainserverMutation({
        contentType: 'poi.point-of-interest',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
        actorAccountId: 'account-1',
        organizationId: 'org-1',
        operation: 'update',
        entityId: 'poi-stale-1',
      })
    ).resolves.toBeUndefined();

    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        source_entity_id: 'poi-stale-1',
        title: 'Alter Snapshot',
      }),
    ]);
    expect(
      fixture.syncStates.get(
        'poi.point-of-interest::de-musterhausen::account-1::org-1::organization::poi.point-of-interest'
      )
    ).toEqual(
      expect.objectContaining({
        last_succeeded_at: staleSucceededAt,
        last_failed_at: expect.any(String),
        last_error_message: 'detail failed',
      })
    );

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['poi.point-of-interest'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    const payload = (await response.json()) as {
      data: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([expect.objectContaining({ id: 'poi-stale-1' })]);
    expect(state.listSvaMainserverPoi).toHaveBeenCalled();
  });

  it('logs projection trigger, scope, page depth, and mutation follow-up failures distinctly', async () => {
    fixture.syncStates.set(
      'events.event-record::de-musterhausen::account-1::org-1::events.event-record',
      {
        sync_scope_key: 'de-musterhausen::account-1::org-1::events.event-record',
        last_started_at: null,
        last_succeeded_at: '2026-06-20T10:00:00.000Z',
        last_failed_at: null,
        last_error_code: null,
        last_error_message: null,
        projected_count: 0,
      }
    );
    state.listSvaMainserverEvents.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    state.getSvaMainserverPoi.mockRejectedValue(new Error('mutation detail failed'));

    await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['events.event-record'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await refreshProjectedContentsForMainserverMutation({
      contentType: 'poi.point-of-interest',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      organizationId: 'org-1',
      operation: 'update',
      entityId: 'poi-log-1',
    });

    expect(state.loggerDebug).toHaveBeenCalledWith(
      'mainserver_projection_page_loaded',
      expect.objectContaining({
        content_type: 'events.event-record',
        page: 1,
        page_size: 100,
        refresh_trigger: 'reconciliation',
        projection_scope_key: 'de-musterhausen::account-1::org-1::events.event-record',
      })
    );
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'mainserver_projection_mutation_refresh_failed',
      expect.objectContaining({
        content_type: 'poi.point-of-interest',
        entity_id: 'poi-log-1',
        operation: 'update',
        refresh_trigger: 'mutation_follow_up',
        projection_scope_key:
          'de-musterhausen::account-1::org-1::organization::poi.point-of-interest',
      })
    );
  });
});
