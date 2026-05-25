import { describe, expect, it, vi } from 'vitest';

import { fetchIamContentHistory } from './content-history-client.js';
import { MainserverApiError } from './mainserver-client.js';

describe('content-history-client', () => {
  it('loads iam content history through the shared host endpoint', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'history-1',
              contentId: 'content-1',
              action: 'created',
              actor: 'Editor',
              changedFields: ['title'],
              createdAt: '2026-05-24T08:00:00.000Z',
              summary: 'Eintrag erstellt',
            },
          ],
        }),
        { status: 200 }
      )
    );

    await expect(fetchIamContentHistory('content-1', { fetch: fetchMock as typeof fetch })).resolves.toEqual([
      expect.objectContaining({
        id: 'history-1',
        contentId: 'content-1',
        action: 'created',
      }),
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/contents/content-1/history',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('encodes content ids when building the history endpoint url', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));

    await fetchIamContentHistory('content/with?#spaces', { fetch: fetchMock as typeof fetch });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/contents/content%2Fwith%3F%23spaces/history',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('returns an empty list for successful no-history responses', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));

    await expect(fetchIamContentHistory('content-empty', { fetch: fetchMock as typeof fetch })).resolves.toEqual([]);
  });

  it('surfaces forbidden and not-found errors as mainserver api errors', async () => {
    const forbiddenFetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'forbidden', message: 'Keine Rechte' }), { status: 403 })
    );
    const notFoundFetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'not_found', message: 'Nicht gefunden' }), { status: 404 })
    );

    await expect(
      fetchIamContentHistory('content-forbidden', { fetch: forbiddenFetchMock as typeof fetch })
    ).rejects.toEqual(new MainserverApiError('forbidden', 'Keine Rechte'));
    await expect(
      fetchIamContentHistory('content-missing', { fetch: notFoundFetchMock as typeof fetch })
    ).rejects.toEqual(new MainserverApiError('not_found', 'Nicht gefunden'));
  });
});
