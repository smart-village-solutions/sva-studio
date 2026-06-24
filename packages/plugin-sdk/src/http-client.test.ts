import { describe, expect, it, vi } from 'vitest';

import { mergeRequestHeaders, requestJson } from './http-client.js';

describe('http-client', () => {
  it('merges headers across plain objects, tuples and Headers instances with last-write-wins semantics', () => {
    expect(
      Object.fromEntries(
        mergeRequestHeaders(
          { Accept: 'application/json', Authorization: 'Bearer one' },
          [['authorization', 'Bearer two']],
          new Headers({ 'X-Test': 'yes' })
        ).entries()
      )
    ).toEqual({
      accept: 'application/json',
      authorization: 'Bearer two',
      'x-test': 'yes',
    });
  });

  it('requests json with include credentials and throws the default or custom error factory for non-ok responses', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { id: 'ok' } }), { status: 200 }));

    await expect(
      requestJson<{ data: { id: string } }>({
        fetch: fetchMock,
        url: '/api/test',
        init: {
          headers: { 'X-Test': 'yes' },
        },
      })
    ).resolves.toEqual({ data: { id: 'ok' } });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.any(Headers),
      })
    );

    const failingFetch = vi.fn(async () => new Response('kaputt', { status: 503 }));
    await expect(requestJson({ fetch: failingFetch, url: '/broken' })).rejects.toThrow('http_503');

    class CustomHttpError extends Error {
      public constructor(public readonly status: number) {
        super(`custom_${status}`);
      }
    }

    await expect(
      requestJson({
        fetch: failingFetch,
        url: '/broken',
        errorFactory: (response) => new CustomHttpError(response.status),
      })
    ).rejects.toMatchObject({
      message: 'custom_503',
      status: 503,
    });
  });
});
