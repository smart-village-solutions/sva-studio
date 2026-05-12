import { describe, expect, it, vi } from 'vitest';

import {
  createMethodNotAllowedHandler,
  dispatchRouteRequest,
  resolveRoutePathForRequestPath,
  verifyRouteHandlerCoverage,
} from './auth.route-runtime.server.js';

describe('auth.route-runtime.server', () => {
  it('resolves exact and parameterized route paths deterministically', () => {
    const paths = ['/auth/login', '/api/v1/users/$userId'] as const;

    expect(resolveRoutePathForRequestPath(paths, '/auth/login')).toBe('/auth/login');
    expect(resolveRoutePathForRequestPath(paths, '/api/v1/users/user-1')).toBe('/api/v1/users/$userId');
    expect(resolveRoutePathForRequestPath(paths, '/api/v1/groups/user-1')).toBeNull();
    expect(resolveRoutePathForRequestPath(paths, '/api/v1/users')).toBeNull();
  });

  it('returns null for unmatched requests and emits a stable 405 response for unsupported methods', async () => {
    const getHandler = vi.fn(async () => new Response('ok', { status: 200 }));

    await expect(
      dispatchRouteRequest({
        request: new Request('http://localhost/unknown', { method: 'GET' }),
        resolveRoutePathForRequestPath: () => null,
        resolveHandlers: () => ({ GET: getHandler }),
      })
    ).resolves.toBeNull();

    const response = await dispatchRouteRequest({
      request: new Request('http://localhost/auth/login', { method: 'POST' }),
      resolveRoutePathForRequestPath: () => '/auth/login',
      resolveHandlers: () => ({ GET: getHandler }),
      suppressMethodNotAllowedLogging: () => true,
    });

    expect(response?.status).toBe(405);
    expect(response?.headers.get('Allow')).toBe('GET');
    await expect(response?.json()).resolves.toEqual({
      error: 'method_not_allowed',
      message: 'HTTP-Methode nicht erlaubt.',
    });
  });

  it('validates coverage mappings and creates dedicated method-not-allowed handlers', async () => {
    const logger = { warn: vi.fn() };

    expect(() =>
      verifyRouteHandlerCoverage(['/auth/login'], {
        '/auth/login': { GET: async () => new Response('ok') },
        '/auth/logout': { POST: async () => new Response('ok') },
      }, logger)
    ).not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      'Auth route mapping differs from declared auth route paths',
      expect.objectContaining({
        missing_paths: '',
        extra_paths: '/auth/logout',
      })
    );

    const handler = createMethodNotAllowedHandler('/auth/login', 'GET');
    const response = await handler({
      request: new Request('http://localhost/auth/login', { method: 'POST' }),
    });

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
  });

  it('treats undefined handler maps as empty coverage entries instead of crashing', () => {
    const logger = { warn: vi.fn() };

    expect(() =>
      verifyRouteHandlerCoverage(
        ['/auth/login'],
        {
          '/auth/login': undefined as never,
        },
        logger
      )
    ).not.toThrow();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('includes the request id in generated method-not-allowed responses when available', async () => {
    const handler = createMethodNotAllowedHandler('/auth/login', 'GET');
    const response = await handler({
      request: new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: {
          'x-request-id': 'req-123',
        },
      }),
    });

    expect(response.headers.get('X-Request-Id')).toBe('req-123');
    await expect(response.json()).resolves.toEqual({
      error: 'method_not_allowed',
      message: 'HTTP-Methode nicht erlaubt.',
      requestId: 'req-123',
    });
  });
});
