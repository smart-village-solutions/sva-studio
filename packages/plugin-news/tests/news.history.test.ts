import { describe, expect, it } from 'vitest';

import {
  createNewsHistoryEntries,
  type NewsHistoryEntry,
} from '../src/news.history.js';

describe('news.history', () => {
  it('maps api list responses into descending timeline entries', () => {
    const entries = createNewsHistoryEntries([
      {
        id: 'history-older',
        contentId: 'news-1',
        action: 'updated',
        actor: 'Editor',
        changedFields: ['title'],
        createdAt: '2026-05-24T08:00:00.000Z',
        summary: 'Titel angepasst',
      },
      {
        id: 'history-newer',
        contentId: 'news-1',
        action: 'status_changed',
        actor: 'Reviewer',
        changedFields: ['status'],
        fromStatus: 'draft',
        toStatus: 'published',
        createdAt: '2026-05-24T10:00:00.000Z',
        summary: 'Freigabe erteilt',
      },
    ]);

    expect(entries.map((entry) => entry.id)).toEqual(['history-newer', 'history-older']);
    expect(entries[0]).toMatchObject<Partial<NewsHistoryEntry>>({
      actionLabelKey: 'history.actions.statusChanged',
      actor: 'Reviewer',
      changedFields: ['status'],
      fromStatus: 'draft',
      toStatus: 'published',
    });
  });

  it('preserves empty changed field lists and optional summaries', () => {
    const [entry] = createNewsHistoryEntries([
      {
        id: 'history-created',
        contentId: 'news-1',
        action: 'created',
        actor: 'Editor',
        changedFields: [],
        createdAt: '2026-05-24T08:00:00.000Z',
      },
    ]);

    expect(entry).toMatchObject({
      id: 'history-created',
      actionLabelKey: 'history.actions.created',
      changedFields: [],
      summary: undefined,
    });
  });
});
