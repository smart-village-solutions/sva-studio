import { describe, expect, it, vi } from 'vitest';

import {
  createMainserverJsonRequestHeaders,
  MainserverApiError,
  requestMainserverJson,
} from './mainserver-request.js';

describe('mainserver-request', () => {
  const readHeaders = (headers: HeadersInit | undefined): Record<string, string> =>
    Object.fromEntries(new Headers(headers).entries());

  it('builds canonical json request headers', () => {
    expect(readHeaders(createMainserverJsonRequestHeaders({ Authorization: 'Bearer test' }))).toEqual({
      authorization: 'Bearer test',
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    });
  });

  it('covers fetch resolution, structured errors, fallback errors and default timeout wrapping', async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', undefined);
    await expect(requestMainserverJson({ url: '/missing' })).rejects.toThrow('mainserver_fetch_unavailable');
    vi.stubGlobal('fetch', originalFetch);

    const fallbackFetch = vi.fn(async () => new Response('kaputt', { status: 500 }));
    await expect(requestMainserverJson({ url: '/fallback', fetch: fallbackFetch as typeof fetch })).rejects.toMatchObject({
      code: 'http_500',
      message: 'http_500',
      name: 'MainserverApiError',
    });

    const structuredFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: { code: 'database_unavailable', message: 'db down' },
        }),
        { status: 503 }
      )
    );
    await expect(requestMainserverJson({ url: '/structured', fetch: structuredFetch as typeof fetch })).rejects.toMatchObject({
      code: 'database_unavailable',
      message: 'db down',
      name: 'MainserverApiError',
    });
  });

  it('supports custom error factories and preserves caller abort errors', async () => {
    class CustomMainserverError extends Error {
      public constructor(public readonly code: string, message: string) {
        super(message);
      }
    }

    const customFailureFetch = vi.fn(async () => new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }));
    await expect(
      requestMainserverJson({
        url: '/custom-error',
        fetch: customFailureFetch as typeof fetch,
        errorFactory: (code, message) => new CustomMainserverError(code, message),
      })
    ).rejects.toMatchObject({
      code: 'forbidden',
      message: 'forbidden',
    });

    const originalAbortSignalAny = AbortSignal.any;
    Object.defineProperty(AbortSignal, 'any', { configurable: true, value: undefined });
    const callerAbort = new AbortController();
    const callerAbortFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      callerAbort.abort(new DOMException('caller_cancelled', 'AbortError'));
      await Promise.resolve();
      throw init?.signal?.reason ?? new DOMException('caller_cancelled', 'AbortError');
    });

    try {
      await expect(
        requestMainserverJson({
          url: '/caller-abort',
          fetch: callerAbortFetch as typeof fetch,
          init: { signal: callerAbort.signal },
        })
      ).rejects.toMatchObject({
        name: 'AbortError',
        message: 'caller_cancelled',
      });
    } finally {
      Object.defineProperty(AbortSignal, 'any', { configurable: true, value: originalAbortSignalAny });
    }
  });

  it('maps timeouts during fetch and response parsing into stable mainserver timeout errors', async () => {
    vi.useFakeTimers();
    try {
      const fetchTimeoutMock = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(init.signal?.reason ?? new DOMException('mainserver_timeout', 'TimeoutError')),
              { once: true }
            );
          })
      );
      const fetchTimeoutPromise = requestMainserverJson({
        url: '/timeout-fetch',
        fetch: fetchTimeoutMock as typeof fetch,
        timeoutMs: 50,
      }).catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(51);

      await expect(fetchTimeoutPromise).resolves.toMatchObject({
        code: 'mainserver_timeout',
        message: 'mainserver_timeout',
        name: 'MainserverApiError',
      });

      const bodyTimeoutMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => ({
        ok: true,
        status: 200,
        json: () =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(init.signal?.reason ?? new DOMException('mainserver_timeout', 'TimeoutError')),
              { once: true }
            );
          }),
      })) as typeof fetch;

      const bodyTimeoutPromise = requestMainserverJson({
        url: '/timeout-body',
        fetch: bodyTimeoutMock,
        timeoutMs: 50,
      }).catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(51);

      await expect(bodyTimeoutPromise).resolves.toMatchObject({
        code: 'mainserver_timeout',
        message: 'mainserver_timeout',
        name: 'MainserverApiError',
      });

      const errorBodyTimeoutMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => ({
        ok: false,
        status: 503,
        json: () =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('mainserver_timeout', 'AbortError')),
              { once: true }
            );
          }),
      })) as typeof fetch;

      const errorBodyTimeoutPromise = requestMainserverJson({
        url: '/timeout-error-body',
        fetch: errorBodyTimeoutMock,
        timeoutMs: 50,
      }).catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(51);

      await expect(errorBodyTimeoutPromise).resolves.toMatchObject({
        code: 'mainserver_timeout',
        message: 'mainserver_timeout',
        name: 'MainserverApiError',
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
