import { describe, expect, it } from 'vitest';

import {
  ctx,
  fixture,
  getProjectionTestState,
  refreshProjectedContentsForTest as refreshProjectedContents,
  registerProjectionFixture,
} from './iam-content-list-projection.test-fixture.js';

const state = getProjectionTestState();

describe('content list projection sync and persistence', () => {
  registerProjectionFixture();

  it('refreshes requested mainserver projections synchronously', async () => {
    state.listSvaMainserverEvents.mockResolvedValue({
      data: [
        {
          id: 'event-refresh-1',
          title: 'Aktuelle Veranstaltung',
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
    const payload = (await response.json()) as {
      data: {
        status: string;
        syncStates: Array<{
          contentType: string;
          hasSnapshot: boolean;
          isStale: boolean;
        }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('completed');
    expect(payload.data.syncStates).toEqual([
      expect.objectContaining({
        contentType: 'events.event-record',
        hasSnapshot: true,
        isStale: false,
      }),
    ]);
    expect(fixture.projectionInsertArgs).toHaveLength(1);
    expect(fixture.projectionRows).toEqual([
      expect.objectContaining({
        content_type: 'events.event-record',
        organization_id: 'org-1',
        source_entity_id: 'event-refresh-1',
        source_system: 'mainserver',
      }),
    ]);
  });

  it('requests invisible mainserver records during projection refresh', async () => {
    state.listSvaMainserverEvents.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });

    expect(state.listSvaMainserverEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        includeInvisible: true,
        page: 1,
        pageSize: 100,
      })
    );
  });

  it('requests invisible generic items during projection refresh', async () => {
    state.listSvaMainserverGenericItems.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    await refreshProjectedContents(ctx, {
      visibleTypes: ['generic-items.generic-item'],
      force: true,
    });

    expect(state.listSvaMainserverGenericItems).toHaveBeenCalledWith(
      expect.objectContaining({
        includeInvisible: true,
        page: 1,
        pageSize: 100,
      })
    );
  });

  it('keeps projection paging on the unfiltered generic-item upstream result', async () => {
    state.listSvaMainserverGenericItems
      .mockResolvedValueOnce({
        data: [
          {
            id: 'faq-1',
            title: 'FAQ',
            contentType: 'generic-items.generic-item',
            genericType: 'FAQ',
            teaser: null,
            keywords: [],
            payload: { languageCode: 'de', sortWeight: 0 },
            categories: [],
            contacts: [],
            webUrls: [],
            addresses: [],
            contentBlocks: [{ body: 'Antwort' }],
            openingHours: [],
            mediaContents: [],
            locations: [],
            dates: [],
            accessibilityInformations: [],
            priceInformations: [],
            visible: true,
            author: null,
            createdAt: '2026-06-20T10:00:00.000Z',
            updatedAt: '2026-06-21T10:00:00.000Z',
          },
        ],
        pagination: { page: 1, pageSize: 25, hasNextPage: true },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'generic-2',
            title: 'Später Generic',
            contentType: 'generic-items.generic-item',
            genericType: 'INFO',
            teaser: null,
            keywords: [],
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
            author: null,
            createdAt: '2026-06-20T10:00:00.000Z',
            updatedAt: '2026-06-21T10:00:00.000Z',
          },
        ],
        pagination: { page: 2, pageSize: 25, hasNextPage: false },
      });

    await refreshProjectedContents(ctx, {
      visibleTypes: ['generic-items.generic-item'],
      force: true,
    });

    expect(state.listSvaMainserverGenericItems).toHaveBeenCalledTimes(2);
    expect(fixture.projectionRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content_type: 'generic-items.generic-item',
          source_entity_id: 'generic-2',
        }),
      ])
    );
  });

  it('keeps only unclaimed discriminators in the legacy generic-item projection', async () => {
    state.listSvaMainserverGenericItems.mockResolvedValue({
      data: [
        ['featured-project-1', 'Featured Project', 'FeaturedProject'],
        ['faq-1', 'FAQ', 'FAQ'],
        ['card-1', 'Kachel', 'COCKPIT_CARD'],
        ['future-1', 'Zukünftiger Typ', 'FUTURE_TYPE'],
      ].map(([id, title, genericType]) => ({
        id: id!,
        title: title!,
        contentType: 'generic-items.generic-item',
        genericType: genericType!,
        teaser: null,
        keywords: [],
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
        author: null,
        createdAt: '2026-08-04T10:00:00.000Z',
        updatedAt: '2026-08-04T11:00:00.000Z',
      })),
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    await refreshProjectedContents(ctx, {
      visibleTypes: ['generic-items.generic-item'],
      force: true,
    });

    expect(fixture.projectionRows.map((row) => row.source_entity_id)).toEqual(['future-1']);
    expect(
      fixture.projectionRows.every((row) => row.content_type === 'generic-items.generic-item')
    ).toBe(true);
  });

  it('persists only the registered specialized projection for the same mainserver item', async () => {
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [
        { action: 'generic-items.read', resourceType: 'generic-items' },
        { action: 'faq.read', resourceType: 'faq' },
      ],
    });
    const faqItem = {
      id: 'faq-shared-1',
      title: 'Gemeinsame FAQ',
      contentType: 'generic-items.generic-item',
      genericType: 'FAQ',
      teaser: null,
      keywords: [],
      payload: { languageCode: 'de', sortWeight: 0 },
      categories: [],
      contacts: [],
      webUrls: [],
      addresses: [],
      contentBlocks: [{ body: 'Antwort' }],
      openingHours: [],
      mediaContents: [],
      locations: [],
      dates: [],
      accessibilityInformations: [],
      priceInformations: [],
      visible: true,
      author: null,
      createdAt: '2026-08-04T10:00:00.000Z',
      updatedAt: '2026-08-04T11:00:00.000Z',
    };
    state.listSvaMainserverGenericItems.mockResolvedValue({
      data: [faqItem],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    await refreshProjectedContents(ctx, {
      visibleTypes: ['generic-items.generic-item', 'faq.faq'],
      force: true,
    });

    expect(
      fixture.projectionRows
        .filter((row) => row.source_entity_id === 'faq-shared-1')
        .map((row) => row.content_type)
        .sort()
    ).toEqual(['faq.faq']);
  });

  it('upserts only the latest loaded page during progressive batch refreshes', async () => {
    state.listSvaMainserverEvents
      .mockResolvedValueOnce({
        data: [
          {
            id: 'event-page-1',
            title: 'Seite 1',
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
        pagination: { page: 1, pageSize: 25, hasNextPage: true },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'event-page-2',
            title: 'Seite 2',
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
        pagination: { page: 2, pageSize: 25, hasNextPage: false },
      });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });

    expect(response.status).toBe(200);
    expect(fixture.projectionInsertPayloadSizes).toEqual([1, 1, 2]);
    expect(fixture.projectionRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source_entity_id: 'event-page-1' }),
        expect.objectContaining({ source_entity_id: 'event-page-2' }),
      ])
    );
  });

  it('loads surveys once with the projection sync page size before replacing the projection snapshot', async () => {
    state.listSvaMainserverSurveys.mockResolvedValue({
      data: Array.from({ length: 101 }, (_, index) => ({
        id: `survey-${index + 1}`,
        contentType: 'surveys.survey' as const,
        title: { de: `Umfrage ${index + 1}` },
        status: 'ACTIVE' as const,
        resultVisibility: 'NONE' as const,
        targetAreaIds: [],
        showResultsInApp: false,
        isAnonymous: true,
        questions: [],
        questionCount: 0,
        participationCount: 0,
        submissionCount: 0,
        createdAt: '2026-06-20T10:00:00.000Z',
        updatedAt: '2026-06-21T10:00:00.000Z',
      })),
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['surveys.survey'],
      force: true,
    });

    expect(state.resolveEffectivePermissions).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(state.listSvaMainserverSurveys).toHaveBeenCalledTimes(1);
    expect(state.listSvaMainserverSurveys).toHaveBeenCalledWith(
      expect.objectContaining({ includeArchived: true, page: 1, pageSize: 100 })
    );
    expect(fixture.projectionRows).toHaveLength(101);
    expect(fixture.projectionRows.at(-1)).toEqual(
      expect.objectContaining({
        content_type: 'surveys.survey',
        source_entity_id: 'survey-101',
        source_system: 'mainserver',
      })
    );
  });

  it('accepts refresh requests without mainserver-backed visible types', async () => {
    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['generic'],
      force: true,
    });

    await expect(response.json()).resolves.toEqual({
      data: {
        status: 'accepted',
        syncStates: [],
      },
      requestId: 'req-1',
    });
    expect(state.listSvaMainserverNews).not.toHaveBeenCalled();
    expect(state.listSvaMainserverEvents).not.toHaveBeenCalled();
    expect(state.listSvaMainserverPoi).not.toHaveBeenCalled();
  });
});
