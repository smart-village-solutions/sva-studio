import { describe, expect, it } from 'vitest';

import { SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';

describe('toMainserverErrorResponse', () => {
  it('preserves the existing default 500 contract for mainserver errors without explicit status', async () => {
    const response = toMainserverErrorResponse(
      new SvaMainserverError({
        code: 'forbidden',
        message: 'Kein Zugriff.',
      }),
      'Fallback-Nachricht'
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'forbidden',
      message: 'Kein Zugriff.',
    });
  });

  it('prefers explicit status codes over default code mapping', async () => {
    const response = toMainserverErrorResponse(
      new SvaMainserverError({
        code: 'forbidden',
        message: 'Abweichender Status.',
        statusCode: 451,
      }),
      'Fallback-Nachricht'
    );

    expect(response.status).toBe(451);
    await expect(response.json()).resolves.toEqual({
      error: 'forbidden',
      message: 'Abweichender Status.',
    });
  });

  it('uses the shared code mapping when a mainserver error has no explicit status code', async () => {
    const error = new SvaMainserverError({
      code: 'forbidden',
      message: 'Kein Zugriff.',
    });
    Object.defineProperty(error, 'statusCode', { value: undefined });

    const response = toMainserverErrorResponse(error, 'Fallback-Nachricht');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'forbidden',
      message: 'Kein Zugriff.',
    });
  });

  it('falls back to 502 for unknown mainserver error codes without an explicit status code', async () => {
    const error = new SvaMainserverError({
      code: 'unexpected_upstream_code',
      message: 'Unbekannter Upstream-Fehler.',
    });
    Object.defineProperty(error, 'statusCode', { value: undefined });

    const response = toMainserverErrorResponse(error, 'Fallback-Nachricht');

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'unexpected_upstream_code',
      message: 'Unbekannter Upstream-Fehler.',
    });
  });

  it('returns a route-specific internal error response for non-mainserver errors', async () => {
    const response = toMainserverErrorResponse(new Error('boom'), 'Mainserver-News-Anfrage ist fehlgeschlagen.');

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'internal_error',
      message: 'Mainserver-News-Anfrage ist fehlgeschlagen.',
    });
  });
});
