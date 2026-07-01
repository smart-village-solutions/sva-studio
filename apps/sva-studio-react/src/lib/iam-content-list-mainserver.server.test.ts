import { describe, expect, it } from 'vitest';

import { mapEventItem, mapNewsItem, mapPoiItem, mapSurveyItem } from './iam-content-list-mainserver.js';

const publishedTimestamps = {
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-02T10:00:00.000Z',
};

describe('iam content list mainserver mapping', () => {
  it('maps mainserver access from allow permissions', () => {
    expect(
      mapEventItem(
        {
          id: 'event-1',
          contentType: 'events.event-record',
          title: 'Stadtfest',
          description: 'Innenstadt',
          categoryName: 'Kultur',
          dates: [],
          addresses: [],
          contacts: [],
          urls: [],
          tags: [],
          ...publishedTimestamps,
        } as never,
        'instance-1',
        [
          { action: 'events.create' },
          { action: 'events.update' },
        ]
      ).access
    ).toEqual({
      state: 'editable',
      canRead: true,
      canCreate: true,
      canUpdate: true,
      organizationIds: [],
      sourceKinds: [],
    });
  });

  it('uses fallback titles and preserves serializable payloads for mainserver rows', () => {
    expect(
      mapNewsItem(
        {
          id: 'news-1',
          contentType: 'news.article',
          title: ' ',
          contentBlocks: [{ title: ' Block-Titel ' }],
          author: 'redaktion',
          payload: undefined,
          publishedAt: '2026-06-03T10:00:00.000Z',
          ...publishedTimestamps,
        } as never,
        'instance-1',
        [{ action: 'news.update' }]
      )
    ).toMatchObject({
      title: 'Block-Titel',
      createdBy: 'redaktion',
      payload: null,
      access: { state: 'editable', canCreate: false, canUpdate: true },
    });

    expect(
      mapPoiItem(
        {
          id: 'poi-1',
          contentType: 'poi.point-of-interest',
          name: '',
          description: 'Ort',
          active: true,
          payload: { legacy: true },
          addresses: [],
          webUrls: [],
          tags: [],
          ...publishedTimestamps,
        } as never,
        'instance-1',
        [{ action: 'poi.create' }, { action: 'poi.update' }]
      )
    ).toMatchObject({
      title: 'poi-1',
      historyRef: 'mainserver:poi:poi-1',
      payload: { description: 'Ort', active: true, payload: { legacy: true }, addresses: [], webUrls: [], tags: [] },
      access: { state: 'editable', canCreate: true, canUpdate: true },
    });
  });

  it('maps surveys into the shared content list shape with localized titles and publication windows', () => {
    expect(
      mapSurveyItem(
        {
          id: 'survey-1',
          contentType: 'surveys.survey',
          title: { de: 'Bürgerumfrage', en: 'Citizen Survey' },
          shortDescription: { de: 'Kurz' },
          description: { de: 'Lang' },
          status: 'ACTIVE',
          startAt: '2026-06-05T09:00:00.000Z',
          endAt: '2026-06-30T18:00:00.000Z',
          resultVisibility: 'AFTER_SURVEY_END',
          targetAreaIds: [],
          showResultsInApp: true,
          isAnonymous: true,
          questionCount: 4,
          participationCount: 120,
          submissionCount: 135,
          publishedAt: '2026-06-05T09:00:00.000Z',
          ...publishedTimestamps,
        },
        'instance-1',
        [{ action: 'surveys.create' }, { action: 'surveys.update' }]
      )
    ).toMatchObject({
      title: 'Bürgerumfrage',
      status: 'published',
      publishFrom: '2026-06-05T09:00:00.000Z',
      publishUntil: '2026-06-30T18:00:00.000Z',
      historyRef: 'mainserver:surveys:survey-1',
      payload: expect.objectContaining({
        questionCount: 4,
        participationCount: 120,
        submissionCount: 135,
      }),
      access: { state: 'editable', canCreate: true, canUpdate: true },
    });
  });
});
