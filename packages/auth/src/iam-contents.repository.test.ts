import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const queries: Array<{ text: string; values?: readonly unknown[] }> = [];
  const client = {
    query: vi.fn(async (text: string, values?: readonly unknown[]) => {
      queries.push({ text, values });
      return { rowCount: 0, rows: [] };
    }),
  };

  return {
    queries,
    client,
    withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (client: typeof client) => Promise<unknown>) => work(client)),
    emitActivityLog: vi.fn(),
  };
});

vi.mock('./iam-account-management/shared.js', () => ({
  emitActivityLog: (...args: Parameters<typeof state.emitActivityLog>) => state.emitActivityLog(...args),
  withInstanceScopedDb: (...args: Parameters<typeof state.withInstanceScopedDb>) => state.withInstanceScopedDb(...args),
}));

import {
  createContent,
  deleteContent,
  loadContentById,
  loadContentDetail,
  loadContentHistory,
  loadContentListItems,
  updateContent,
} from './iam-contents/repository.js';

const contentRow = {
  id: '11111111-1111-4111-8111-111111111111',
  content_type: 'generic',
  title: 'Startseite',
  published_at: null,
  created_at: '2026-03-22T10:00:00.000Z',
  updated_at: '2026-03-22T11:00:00.000Z',
  author_display_name: 'Editor',
  payload_json: { hero: 'Hallo' },
  status: 'draft',
} as const;

describe('iam-contents repository', () => {
  beforeEach(() => {
    state.queries.length = 0;
    state.client.query.mockReset();
    state.withInstanceScopedDb.mockClear();
    state.emitActivityLog.mockReset();
  });

  it('maps content list, single item and history rows including optional fields', async () => {
    state.client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [contentRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [contentRow] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'history-1',
            content_id: '11111111-1111-4111-8111-111111111111',
            action: 'updated',
            actor_display_name: 'Editor',
            changed_fields: null,
            previous_status: null,
            next_status: 'draft',
            created_at: '2026-03-22T12:00:00.000Z',
            summary: null,
          },
        ],
      });

    expect(await loadContentListItems('de-musterhausen')).toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111',
        contentType: 'generic',
        title: 'Startseite',
        createdAt: '2026-03-22T10:00:00.000Z',
        updatedAt: '2026-03-22T11:00:00.000Z',
        author: 'Editor',
        payload: { hero: 'Hallo' },
        status: 'draft',
      },
    ]);

    expect(await loadContentById('de-musterhausen', '11111111-1111-4111-8111-111111111111')).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      contentType: 'generic',
      title: 'Startseite',
      createdAt: '2026-03-22T10:00:00.000Z',
      updatedAt: '2026-03-22T11:00:00.000Z',
      author: 'Editor',
      payload: { hero: 'Hallo' },
      status: 'draft',
    });

    expect(await loadContentHistory('de-musterhausen', 'content-1')).toEqual([
      {
        id: 'history-1',
        contentId: '11111111-1111-4111-8111-111111111111',
        action: 'updated',
        actor: 'Editor',
        changedFields: [],
        toStatus: 'draft',
        createdAt: '2026-03-22T12:00:00.000Z',
      },
    ]);
  });

  it('returns undefined detail when no content exists and combines item plus history otherwise', async () => {
    state.client.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    expect(await loadContentDetail('de-musterhausen', '22222222-2222-4222-8222-222222222222')).toBeUndefined();

    state.client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...contentRow, published_at: '2026-03-22T12:00:00.000Z' }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'history-1',
            content_id: '11111111-1111-4111-8111-111111111111',
            action: 'status_changed',
            actor_display_name: 'Editor',
            changed_fields: ['status', 'publishedAt'],
            previous_status: 'draft',
            next_status: 'published',
            created_at: '2026-03-22T12:00:00.000Z',
            summary: 'Status geändert',
          },
        ],
      });

    expect(await loadContentDetail('de-musterhausen', 'content-1')).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      contentType: 'generic',
      title: 'Startseite',
      publishedAt: '2026-03-22T12:00:00.000Z',
      createdAt: '2026-03-22T10:00:00.000Z',
      updatedAt: '2026-03-22T11:00:00.000Z',
      author: 'Editor',
      payload: { hero: 'Hallo' },
      status: 'draft',
      history: [
        {
          id: 'history-1',
          contentId: '11111111-1111-4111-8111-111111111111',
          action: 'status_changed',
          actor: 'Editor',
          changedFields: ['status', 'publishedAt'],
          fromStatus: 'draft',
          toStatus: 'published',
          createdAt: '2026-03-22T12:00:00.000Z',
          summary: 'Status geändert',
        },
      ],
    });
  });

  it('creates content, writes history and activity log, and fails when no id is returned', async () => {
    state.client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'content-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const createdId = await createContent({
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      actorDisplayName: 'Editor',
      requestId: 'req-content',
      traceId: 'trace-content',
      contentType: 'generic',
      title: 'Startseite',
      payload: { hero: 'Hallo' },
      status: 'draft',
    });

    expect(createdId).toBe('content-1');
    expect(state.emitActivityLog).toHaveBeenCalledWith(
      state.client,
      expect.objectContaining({ eventType: 'iam.content.created', payload: expect.objectContaining({ content_id: 'content-1' }) })
    );

    state.client.query.mockReset();
    state.client.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(
      createContent({
        instanceId: 'de-musterhausen',
        actorAccountId: '33333333-3333-4333-8333-333333333333',
        actorDisplayName: 'Editor',
        contentType: 'generic',
        title: 'Startseite',
        payload: { hero: 'Hallo' },
        status: 'draft',
      })
    ).rejects.toThrow('content_create_failed');
  });

  it('covers update branches for missing rows, required publish date, updates and status changes', async () => {
    state.client.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    expect(
      await updateContent({
        instanceId: 'de-musterhausen',
        actorAccountId: '33333333-3333-4333-8333-333333333333',
        actorDisplayName: 'Editor',
        contentId: '22222222-2222-4222-8222-222222222222',
      })
    ).toBeUndefined();

    state.client.query.mockReset();
    state.client.query.mockResolvedValueOnce({ rowCount: 1, rows: [contentRow] });
    await expect(
      updateContent({
        instanceId: 'de-musterhausen',
        actorAccountId: '33333333-3333-4333-8333-333333333333',
        actorDisplayName: 'Editor',
        contentId: '11111111-1111-4111-8111-111111111111',
        status: 'published',
      })
    ).rejects.toThrow('content_published_at_required');

    state.client.query.mockReset();
    state.client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [contentRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    expect(
      await updateContent({
        instanceId: 'de-musterhausen',
        actorAccountId: '33333333-3333-4333-8333-333333333333',
        actorDisplayName: 'Editor',
        requestId: 'req-content',
        traceId: 'trace-content',
        contentId: '11111111-1111-4111-8111-111111111111',
        title: 'Neue Startseite',
        payload: { hero: 'Neu' },
      })
    ).toBe('11111111-1111-4111-8111-111111111111');

    expect(state.emitActivityLog).toHaveBeenCalledWith(
      state.client,
      expect.objectContaining({ eventType: 'iam.content.updated' })
    );

    state.client.query.mockReset();
    state.client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [contentRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    expect(
      await updateContent({
        instanceId: 'de-musterhausen',
        actorAccountId: '33333333-3333-4333-8333-333333333333',
        actorDisplayName: 'Editor',
        contentId: '11111111-1111-4111-8111-111111111111',
        status: 'archived',
      })
    ).toBe('11111111-1111-4111-8111-111111111111');

    expect(state.emitActivityLog).toHaveBeenCalledWith(
      state.client,
      expect.objectContaining({ eventType: 'iam.content.status_changed' })
    );
  });

  it('returns undefined for missing content deletes and emits an activity log before deleting existing rows', async () => {
    state.client.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      deleteContent({
        instanceId: 'de-musterhausen',
        actorAccountId: '33333333-3333-4333-8333-333333333333',
        actorDisplayName: 'Editor',
        contentId: '22222222-2222-4222-8222-222222222222',
      })
    ).resolves.toBeUndefined();

    state.client.query.mockReset();
    state.client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [contentRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await expect(
      deleteContent({
        instanceId: 'de-musterhausen',
        actorAccountId: '33333333-3333-4333-8333-333333333333',
        actorDisplayName: 'Editor',
        requestId: 'req-content',
        traceId: 'trace-content',
        contentId: '11111111-1111-4111-8111-111111111111',
      })
    ).resolves.toBe('11111111-1111-4111-8111-111111111111');

    expect(state.emitActivityLog).toHaveBeenCalledWith(
      state.client,
      expect.objectContaining({ eventType: 'iam.content.deleted' })
    );
  });
});
