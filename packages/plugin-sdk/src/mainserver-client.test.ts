import { describe, expect, it, vi } from 'vitest';

import {
  buildMainserverListUrl,
  createMainserverCrudClient,
  createMainserverJsonRequestHeaders,
  MainserverApiError,
  requestMainserverJson,
} from './mainserver-client.js';

describe('mainserver-client', () => {
  const readHeaders = (headers: HeadersInit | undefined): Record<string, string> =>
    Object.fromEntries(new Headers(headers).entries());

  it('builds canonical list urls and json request headers', () => {
    expect(buildMainserverListUrl('/api/v1/news', { page: 2, pageSize: 50 })).toBe(
      '/api/v1/news?page=2&pageSize=50'
    );
    expect(readHeaders(createMainserverJsonRequestHeaders({ Authorization: 'Bearer test' }))).toEqual({
      authorization: 'Bearer test',
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    });
  });

  it('uses deterministic fallback errors when fetch is unavailable or error envelopes are missing', async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', undefined);

    await expect(requestMainserverJson({ url: '/api/v1/news' })).rejects.toThrow('mainserver_fetch_unavailable');

    vi.stubGlobal('fetch', originalFetch);

    const fetchMock = vi.fn(async () => new Response('kaputt', { status: 500 }));
    await expect(requestMainserverJson({ url: '/api/v1/news', fetch: fetchMock as typeof fetch })).rejects.toMatchObject({
      code: 'http_500',
      message: 'http_500',
      name: 'MainserverApiError',
    });

    vi.unstubAllGlobals();
  });

  it('parses error envelopes and exercises the default CRUD mapping branches', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/list?page=1&pageSize=10')) {
        return new Response(JSON.stringify({ data: [{ id: 'news-1', title: 'Erste' }] }), { status: 200 });
      }
      if (url.endsWith('/list/news-1')) {
        return new Response(JSON.stringify({ data: { id: 'news-1', title: 'Erste' } }), { status: 200 });
      }
      if (url.endsWith('/list') && init?.method === 'POST') {
        return new Response(JSON.stringify({ data: { id: 'news-2', title: 'Zweite' } }), { status: 200 });
      }
      if (url.endsWith('/list/news-2') && init?.method === 'PATCH') {
        return new Response(JSON.stringify({ data: { id: 'news-2', title: 'Aktualisiert' } }), { status: 200 });
      }
      if (url.endsWith('/list/news-2') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ data: { id: 'news-2' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'forbidden', message: 'Keine Rechte' }), { status: 403 });
    });

    const client = createMainserverCrudClient<
      { id: string; title: string },
      { title: string },
      { readonly data: readonly { id: string; title: string }[] },
      readonly { id: string; title: string }[]
    >({
      basePath: '/list',
      fetch: fetchMock as typeof fetch,
      errorFactory: (code, message) => new MainserverApiError(code, message),
      mapListResponse: (response, mapItem) => response.data.map(mapItem),
      createBody: (input) => ({ ...input, created: true }),
      updateBody: (input) => ({ ...input, updated: true }),
      createHeaders: () => ({ 'X-Create': 'yes' }),
      updateHeaders: () => ({ 'X-Update': 'yes' }),
    });

    await expect(client.list({ page: 1, pageSize: 10 })).resolves.toEqual([{ id: 'news-1', title: 'Erste' }]);
    await expect(client.get('news-1')).resolves.toEqual({ id: 'news-1', title: 'Erste' });
    await expect(client.create({ title: 'Zweite' })).resolves.toEqual({ id: 'news-2', title: 'Zweite' });
    await expect(client.update('news-2', { title: 'Aktualisiert' })).resolves.toEqual({
      id: 'news-2',
      title: 'Aktualisiert',
    });
    await expect(client.remove('news-2')).resolves.toBeUndefined();

    await expect(requestMainserverJson({ url: '/forbidden', fetch: fetchMock as typeof fetch })).rejects.toMatchObject({
      code: 'forbidden',
      message: 'Keine Rechte',
    });

    expect(fetchMock.mock.calls[2]).toEqual([
      '/list',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
        body: JSON.stringify({ title: 'Zweite', created: true }),
      }),
    ]);
    expect(readHeaders(fetchMock.mock.calls[2]?.[1]?.headers)).toEqual({
      accept: 'application/json',
      'x-create': 'yes',
    });
    expect(fetchMock.mock.calls[3]).toEqual([
      '/list/news-2',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.any(Headers),
        body: JSON.stringify({ title: 'Aktualisiert', updated: true }),
      }),
    ]);
    expect(readHeaders(fetchMock.mock.calls[3]?.[1]?.headers)).toEqual({
      accept: 'application/json',
      'x-update': 'yes',
    });
  });

  it('preserves tuple and Headers instances when merging request headers', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { id: 'news-1', title: 'Erste' } }), { status: 200 }));
    const headerClient = createMainserverCrudClient<
      { id: string; title: string },
      { title: string },
      { readonly data: readonly { id: string; title: string }[] },
      readonly { id: string; title: string }[]
    >({
      basePath: '/headers',
      fetch: fetchMock as typeof fetch,
      errorFactory: (code, message) => new MainserverApiError(code, message),
      mapListResponse: (response, mapItem) => response.data.map(mapItem),
      createHeaders: () => new Headers([['X-From-Headers', 'one']]),
      updateHeaders: () => [['X-From-Tuples', 'two']],
    });

    await headerClient.create({ title: 'Neu' });
    await headerClient.update('news-1', { title: 'Update' });

    expect(readHeaders(fetchMock.mock.calls[0]?.[1]?.headers)).toEqual({
      accept: 'application/json',
      'x-from-headers': 'one',
    });
    expect(readHeaders(fetchMock.mock.calls[1]?.[1]?.headers)).toEqual({
      accept: 'application/json',
      'x-from-tuples': 'two',
    });
  });
});
