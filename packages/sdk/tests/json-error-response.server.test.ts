import { describe, expect, it } from 'vitest';
import { toJsonErrorResponse } from '../src/server/json-error-response.server';

describe('toJsonErrorResponse', () => {
  it('returns the flat IAM error shape and request id header', async () => {
    const response = toJsonErrorResponse(500, 'internal_error', 'Ein Fehler ist aufgetreten.', {
      requestId: 'req-123',
    });

    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('X-Request-Id')).toBe('req-123');
    await expect(response.json()).resolves.toEqual({
      error: 'internal_error',
      message: 'Ein Fehler ist aufgetreten.',
      requestId: 'req-123',
    });
  });

  it('preserves existing headers and omits the message when not provided', async () => {
    const response = toJsonErrorResponse(401, 'unauthorized', undefined, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-Id': 'req-from-header',
      },
    });

    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Request-Id')).toBe('req-from-header');
    await expect(response.json()).resolves.toEqual({
      error: 'unauthorized',
      requestId: 'req-from-header',
    });
  });

  it('never serializes raw exception messages unless explicitly provided', async () => {
    const internalMessage = 'provider stack: super-secret-token';
    const response = toJsonErrorResponse(500, 'internal_error');
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload.message).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain(internalMessage);
  });

  it('reuses a custom request id header when no explicit request id is passed', async () => {
    const response = toJsonErrorResponse(429, 'rate_limited', 'Zu viele Anfragen.', {
      headers: {
        'x-correlation-id': 'corr-123',
      },
      requestIdHeaderName: 'x-correlation-id',
    });

    expect(response.headers.get('x-correlation-id')).toBe('corr-123');
    await expect(response.json()).resolves.toEqual({
      error: 'rate_limited',
      message: 'Zu viele Anfragen.',
      requestId: 'corr-123',
    });
  });

  it('prefers an explicit request id over an existing header value', async () => {
    const response = toJsonErrorResponse(403, 'forbidden', 'Verboten.', {
      headers: {
        'X-Request-Id': 'stale-id',
      },
      requestId: 'req-override',
    });

    expect(response.headers.get('X-Request-Id')).toBe('req-override');
    await expect(response.json()).resolves.toEqual({
      error: 'forbidden',
      message: 'Verboten.',
      requestId: 'req-override',
    });
  });
});
