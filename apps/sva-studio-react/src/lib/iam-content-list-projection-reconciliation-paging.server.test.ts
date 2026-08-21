import { describe, expect, it, vi } from 'vitest';

import {
  registerProjectionFixture,
  ctx,
  fixture,
  listProjectedContentsForTest as listProjectedContents,
  mapInsertedProjectionRow,
  refreshProjectedContentsForTest as refreshProjectedContents,
  getProjectionTestState,
} from './iam-content-list-projection.test-fixture.js';

const state = getProjectionTestState();

describe('content projection reconciliation paging', () => {
  registerProjectionFixture();

  it('continues mainserver pagination after an empty intermediate page', async () => {
    state.listSvaMainserverEvents.mockImplementation(async ({ page }: { page: number }) => ({
      data:
        page === 1
          ? [
              {
                id: 'event-page-1',
                title: 'Erste Seite',
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
            ]
          : page === 3
            ? [
                {
                  id: 'event-page-3',
                  title: 'Dritte Seite',
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
              ]
            : [],
      pagination: { page, pageSize: 25, hasNextPage: page < 3 },
    }));

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });

    expect(response.status).toBe(200);
    expect(state.listSvaMainserverEvents).toHaveBeenCalledTimes(3);
    expect(state.listSvaMainserverEvents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        page: 2,
        pageSize: 100,
      })
    );
    expect(fixture.projectionRows.map((row) => row.source_entity_id).sort()).toEqual([
      'event-page-1',
      'event-page-3',
    ]);
  });

  it('loads page 1 of every visible mainserver type with page size 100 before page 2', async () => {
    const calls: string[] = [];

    state.listSvaMainserverNews.mockImplementation(
      async ({ page, pageSize }: { page: number; pageSize: number }) => {
        calls.push(`news:${page}:${pageSize}`);
        return {
          data:
            page === 1
              ? [
                  {
                    id: 'news-page-1',
                    title: 'Neueste Nachricht',
                    contentType: 'news.article',
                    payload: { teaser: 'A' },
                    status: 'published',
                    author: 'Redaktion',
                    createdAt: '2026-06-20T10:00:00.000Z',
                    updatedAt: '2026-06-21T10:00:00.000Z',
                    publishedAt: '2026-06-21T09:00:00.000Z',
                    contentBlocks: [],
                  },
                ]
              : [],
          pagination: { page, pageSize, hasNextPage: page === 1 },
        };
      }
    );

    state.listSvaMainserverEvents.mockImplementation(
      async ({ page, pageSize }: { page: number; pageSize: number }) => {
        calls.push(`events:${page}:${pageSize}`);
        return {
          data:
            page === 1
              ? [
                  {
                    id: 'event-page-1',
                    title: 'Neuester Termin',
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
                ]
              : [],
          pagination: { page, pageSize, hasNextPage: page === 1 },
        };
      }
    );

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article', 'events.event-record'],
      force: true,
    });

    expect(response.status).toBe(200);
    expect(calls).toEqual(['news:1:100', 'events:1:100', 'news:2:100', 'events:2:100']);
  });

  it('loads 582 news entries with no more than six page requests', async () => {
    state.listSvaMainserverNews.mockImplementation(
      async ({ page, pageSize }: { page: number; pageSize: number }) => ({
        data: Array.from({ length: page < 6 ? 100 : 82 }, (_, index) => ({
          id: `news-${page}-${index}`,
          title: `News ${page}-${index}`,
          contentType: 'news.article',
          payload: {},
          status: 'published',
          author: 'Redaktion',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          contentBlocks: [],
        })),
        pagination: { page, pageSize, hasNextPage: page < 6 },
      })
    );

    await refreshProjectedContents(ctx, { visibleTypes: ['news.article'], force: true });

    expect(state.listSvaMainserverNews).toHaveBeenCalledTimes(6);
    expect(fixture.projectionRows).toHaveLength(582);
  });

  it('answers after the hot page while reconciliation continues', async () => {
    process.env.SVA_CONTENT_PROJECTION_HOT_COMPLETION_ENABLED = 'true';
    let resolvePageTwo:
      | ((value: {
          data: [];
          pagination: { page: number; pageSize: number; hasNextPage: false };
        }) => void)
      | undefined;
    state.listSvaMainserverNews
      .mockResolvedValueOnce({
        data: [
          {
            id: 'news-hot-1',
            title: 'Hot Page',
            contentType: 'news.article',
            payload: {},
            status: 'published',
            author: 'Redaktion',
            createdAt: '2026-06-20T10:00:00.000Z',
            updatedAt: '2026-06-21T10:00:00.000Z',
            contentBlocks: [],
          },
        ],
        pagination: { page: 1, pageSize: 100, hasNextPage: true },
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePageTwo = resolve;
          })
      );

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['news.article'],
      force: true,
    });
    const payload = (await response.json()) as { data: { status: string } };

    expect(payload.data.status).toBe('accepted');
    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({ source_entity_id: 'news-hot-1' }),
    ]);
    resolvePageTwo?.({ data: [], pagination: { page: 2, pageSize: 100, hasNextPage: false } });
    await vi.waitFor(() => expect(state.listSvaMainserverNews).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(
        fixture.syncStates.get('news.article::de-musterhausen::account-1::org-1::news.article')
          ?.last_succeeded_at
      ).toEqual(expect.any(String))
    );
  });

  it('persists slim projection rows without a fachliche payload', async () => {
    process.env.SVA_CONTENT_PROJECTION_ADAPTER_MODE = 'slim';
    state.listSvaMainserverProjection.mockResolvedValue({
      data: [
        {
          id: 'news-slim-1',
          contentType: 'news.article',
          title: 'Kompakt',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        },
      ],
      skippedInvalidCount: 0,
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    await refreshProjectedContents(ctx, { visibleTypes: ['news.article'], force: true });

    expect(state.listSvaMainserverProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        genericTypeOwnership: {
          FAQ: 'faq.faq',
          COCKPIT_CARD: 'cockpit-cards.cockpit-card',
          FeaturedProject: 'projects.project',
        },
      })
    );
    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({ source_entity_id: 'news-slim-1', payload_json: {} }),
    ]);
  });

  it('does not delete an existing projection when a slim upstream page skipped records', async () => {
    process.env.SVA_CONTENT_PROJECTION_ADAPTER_MODE = 'slim';
    fixture.projectionRows = [
      mapInsertedProjectionRow({
        id: 'news-legacy-1',
        instance_id: 'de-musterhausen',
        projection_scope_key: 'de-musterhausen::account-1::org-1::news.article',
        organization_id: 'org-1',
        owner_subject_id: null,
        owner_user_id: null,
        owner_organization_id: null,
        content_type: 'news.article',
        title: 'Bestehende News',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'mainserver',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'mainserver',
        author_display_mode: 'organization',
        author_display_name: 'Redaktion',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'mainserver:news.article:news-legacy-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_data_provider_id: null,
        source_data_provider_name: null,
        credential_source: 'organization',
        credential_fingerprint: null,
        authorization_mode: 'credential_visible_compatibility',
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-legacy-1',
      }),
    ];
    state.listSvaMainserverProjection.mockResolvedValue({
      data: [],
      skippedInvalidCount: 1,
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    await refreshProjectedContents(ctx, { visibleTypes: ['news.article'], force: true });

    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({ source_entity_id: 'news-legacy-1' }),
    ]);
  });

  it('continues slim GenericItem projection pages from the returned upstream scan offset', async () => {
    process.env.SVA_CONTENT_PROJECTION_ADAPTER_MODE = 'slim';
    state.listSvaMainserverProjection
      .mockResolvedValueOnce({
        data: [
          {
            id: 'generic-slim-1',
            contentType: 'generic-items.generic-item',
            title: 'Allgemein 1',
            createdAt: '2026-06-20T10:00:00.000Z',
            updatedAt: '2026-06-21T10:00:00.000Z',
          },
        ],
        skippedInvalidCount: 0,
        pagination: {
          page: 1,
          pageSize: 100,
          hasNextPage: true,
          nextGenericItemScanOffset: 237,
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'generic-slim-2',
            contentType: 'generic-items.generic-item',
            title: 'Allgemein 2',
            createdAt: '2026-06-20T10:00:00.000Z',
            updatedAt: '2026-06-21T10:00:00.000Z',
          },
        ],
        skippedInvalidCount: 0,
        pagination: { page: 2, pageSize: 100, hasNextPage: false },
      });

    await refreshProjectedContents(ctx, {
      visibleTypes: ['generic-items.generic-item'],
      force: true,
    });

    expect(state.listSvaMainserverProjection).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        page: 2,
        pageSize: 100,
        genericItemScanOffset: 237,
      })
    );
  });

  it('stops slim projection pagination at the local scan cap', async () => {
    process.env.SVA_CONTENT_PROJECTION_ADAPTER_MODE = 'slim';
    state.listSvaMainserverProjection.mockImplementation(
      async ({ page, pageSize }: { page: number; pageSize: number }) => ({
        data: [
          {
            id: `news-slim-${page}`,
            contentType: 'news.article',
            title: `Kompakt ${page}`,
            createdAt: '2026-06-20T10:00:00.000Z',
            updatedAt: '2026-06-21T10:00:00.000Z',
          },
        ],
        skippedInvalidCount: 0,
        pagination: { page: Math.min(page, 50), pageSize, hasNextPage: true },
      })
    );

    await refreshProjectedContents(ctx, { visibleTypes: ['news.article'], force: true });

    expect(state.listSvaMainserverProjection).toHaveBeenCalledTimes(50);
    expect(state.listSvaMainserverProjection).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 50, pageSize: 100 })
    );
  });

  it('does not mark a partially persisted progressive refresh as successful when a later page fails', async () => {
    state.listSvaMainserverNews
      .mockResolvedValueOnce({
        data: [
          {
            id: 'news-page-1',
            title: 'Seite 1',
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
        pagination: { page: 1, pageSize: 25, hasNextPage: true },
      })
      .mockRejectedValueOnce(Object.assign(new Error('page 2 failed'), { code: 'upstream_down' }));

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    const payload = (await response.json()) as {
      metadata: {
        mainserverSyncStates: Array<{
          contentType: string;
          hasSnapshot: boolean;
          lastSucceededAt?: string;
          lastErrorCode?: string;
        }>;
      };
    };

    expect(response.status).toBe(200);
    expect(fixture.projectionRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_entity_id: 'news-page-1',
          projection_scope_key: 'de-musterhausen::account-1::org-1::news.article',
        }),
      ])
    );
    expect(payload.metadata.mainserverSyncStates).toEqual([
      expect.objectContaining({
        contentType: 'news.article',
        hasSnapshot: false,
      }),
    ]);
    await vi.waitFor(() => {
      expect(
        fixture.syncStates.get('news.article::de-musterhausen::account-1::org-1::news.article')
      ).toEqual(
        expect.objectContaining({
          last_succeeded_at: null,
          last_failed_at: expect.any(String),
          last_error_code: 'internal_error',
        })
      );
    });
  });

  it('marks empty mainserver POI projections as successful snapshots', async () => {
    state.listSvaMainserverPoi.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['poi.point-of-interest'],
      force: true,
    });
    const payload = (await response.json()) as {
      data: {
        status: string;
        syncStates: Array<{ contentType: string; hasSnapshot: boolean }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('completed');
    expect(payload.data.syncStates).toEqual([
      expect.objectContaining({
        contentType: 'poi.point-of-interest',
        hasSnapshot: true,
      }),
    ]);
    expect(fixture.projectionRows).toEqual([]);
    expect(fixture.syncStates.get('poi.point-of-interest')).toEqual(
      expect.objectContaining({
        last_error_code: null,
        projected_count: 0,
      })
    );
  });
});
