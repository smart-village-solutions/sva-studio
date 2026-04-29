import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildMainserverListUrl,
  createMainserverCrudClient,
  createMainserverJsonRequestHeaders,
} from './index.js';

class TestApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'TestApiError';
  }
}

describe('mainserver client helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'uuid-1'),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds canonical list urls and default json headers', () => {
    expect(buildMainserverListUrl('/api/v1/mainserver/news', { page: 2, pageSize: 50 })).toBe(
      '/api/v1/mainserver/news?page=2&pageSize=50'
    );
    expect(createMainserverJsonRequestHeaders({ 'Idempotency-Key': 'uuid-1' })).toEqual({
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Idempotency-Key': 'uuid-1',
    });
  });

  it('creates canonical CRUD clients with overridable request behavior', async () => {
    const client = createMainserverCrudClient<
      { readonly id: string; readonly title: string; readonly pushNotification?: boolean },
      { readonly title: string; readonly pushNotification?: boolean },
      { readonly data: readonly { readonly id: string; readonly title: string }[]; readonly pagination: { readonly page: number; readonly pageSize: number; readonly hasNextPage: boolean } },
      { readonly data: readonly { readonly id: string; readonly title: string }[]; readonly pagination: { readonly page: number; readonly pageSize: number; readonly hasNextPage: boolean } },
      TestApiError
    >({
      basePath: '/api/v1/mainserver/news',
      errorFactory: (code, message) => new TestApiError(code, message),
      mapListResponse: (response) => response,
      createBody: (input) => ({ title: input.title, pushNotification: input.pushNotification ?? false }),
      updateBody: (input) => ({ title: input.title }),
      createHeaders: () => createMainserverJsonRequestHeaders({ 'Idempotency-Key': crypto.randomUUID() }),
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        Response.json({
          data: [{ id: 'news-1', title: 'News' }],
          pagination: { page: 1, pageSize: 25, hasNextPage: false },
        })
      )
      .mockResolvedValueOnce(Response.json({ data: { id: 'news-1', title: 'Created' } }))
      .mockResolvedValueOnce(Response.json({ data: { id: 'news-1', title: 'Updated' } }))
      .mockResolvedValueOnce(Response.json({ data: { id: 'news-1' } }))
      .mockResolvedValueOnce(
        Response.json({ error: 'forbidden', message: 'Nope' }, { status: 403 })
      );

    await expect(client.list({ page: 1, pageSize: 25 })).resolves.toEqual({
      data: [{ id: 'news-1', title: 'News' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    await expect(client.create({ title: 'Created', pushNotification: true })).resolves.toEqual({
      id: 'news-1',
      title: 'Created',
    });
    await expect(client.update('news-1', { title: 'Updated', pushNotification: true })).resolves.toEqual({
      id: 'news-1',
      title: 'Updated',
    });
    await expect(client.remove('news-1')).resolves.toBeUndefined();
    await expect(client.get('news-1')).rejects.toMatchObject({
      name: 'TestApiError',
      code: 'forbidden',
      message: 'Nope',
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/mainserver/news?page=1&pageSize=25',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/mainserver/news',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Idempotency-Key': 'uuid-1' }),
        body: JSON.stringify({ title: 'Created', pushNotification: true }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/v1/mainserver/news/news-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated' }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      '/api/v1/mainserver/news/news-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});
