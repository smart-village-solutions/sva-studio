import { beforeEach, describe, expect, it, vi } from 'vitest';

const events = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
const genericItems = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
const news = vi.hoisted(() => ({ setVisibility: vi.fn() }));
const poi = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
const surveys = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));

vi.mock('@sva/plugin-events', () => ({ getEvent: events.get, updateEvent: events.update }));
vi.mock('@sva/plugin-generic-items', () => ({
  getGenericItem: genericItems.get,
  updateGenericItem: genericItems.update,
}));
vi.mock('@sva/plugin-news', () => ({ setNewsVisibility: news.setVisibility }));
vi.mock('@sva/plugin-poi', () => ({ getPoi: poi.get, updatePoi: poi.update }));
vi.mock('@sva/plugin-surveys', () => ({ getSurvey: surveys.get, updateSurvey: surveys.update }));

import {
  getSupportedQuickStatuses,
  updateMainserverContentStatus,
} from './content-status-mutation';

describe('content status mutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes and hides news through the dedicated visibility contract', async () => {
    await updateMainserverContentStatus({ id: 'news-1', contentType: 'news.article' }, 'draft');
    await updateMainserverContentStatus({ id: 'news-1', contentType: 'news.article' }, 'published');

    expect(news.setVisibility).toHaveBeenNthCalledWith(1, 'news-1', false);
    expect(news.setVisibility).toHaveBeenNthCalledWith(2, 'news-1', true);
  });

  it('preserves event, generic-item, and POI fields while changing visibility', async () => {
    events.get.mockResolvedValue({ id: 'event-1', title: 'Fest', visible: true });
    genericItems.get.mockResolvedValue({
      id: 'generic-1',
      title: 'FAQ',
      genericType: 'faq',
      visible: true,
    });
    poi.get.mockResolvedValue({ id: 'poi-1', name: 'Rathaus', active: true });

    await updateMainserverContentStatus(
      { id: 'event-1', contentType: 'events.event-record' },
      'draft'
    );
    await updateMainserverContentStatus(
      { id: 'generic-1', contentType: 'generic-items.generic-item' },
      'draft'
    );
    await updateMainserverContentStatus(
      { id: 'poi-1', contentType: 'poi.point-of-interest' },
      'draft'
    );

    expect(events.update).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({ title: 'Fest', visible: false })
    );
    expect(genericItems.update).toHaveBeenCalledWith(
      'generic-1',
      expect.objectContaining({ genericType: 'faq', visible: false })
    );
    expect(poi.update).toHaveBeenCalledWith(
      'poi-1',
      expect.objectContaining({ name: 'Rathaus', active: false })
    );
  });

  it('maps the shared status to the survey contract and preserves localized data', async () => {
    const current = {
      id: 'survey-1',
      title: { de: 'Befragung', en: 'Survey' },
      shortDescription: { en: 'Short' },
      status: 'DRAFT',
      resultVisibility: 'NONE',
      targetAreaIds: ['area-1'],
      showResultsInApp: false,
      isAnonymous: true,
      questions: [],
    };
    surveys.get.mockResolvedValue(current);

    await updateMainserverContentStatus(
      { id: 'survey-1', contentType: 'surveys.survey' },
      'archived'
    );

    expect(surveys.update).toHaveBeenCalledWith(
      'survey-1',
      expect.objectContaining({
        title: 'Befragung',
        shortDescription: 'Short',
        status: 'ARCHIVED',
      }),
      current
    );
  });

  it('exposes only supported transitions and rejects invalid combinations', async () => {
    expect(getSupportedQuickStatuses('news.article')).toEqual(['draft', 'published']);
    expect(getSupportedQuickStatuses('surveys.survey')).toEqual(['draft', 'published', 'archived']);
    expect(getSupportedQuickStatuses('unknown.type')).toEqual([]);

    await expect(
      updateMainserverContentStatus({ id: 'news-1', contentType: 'news.article' }, 'archived')
    ).rejects.toThrow('unsupported_content_status:news.article:archived');
  });
});
