import { describe, expect, it } from 'vitest';

import { createApiError } from './api-error.js';

describe('createApiError', () => {
  it('uses hardened json response headers for cache-sensitive auth payloads', async () => {
    const response = createApiError(400, 'invalid_request', 'Ungültig.', 'request-1', {
      field: 'title',
    });

    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Vary')).toBe('Cookie');
    expect(response.headers.get('X-Request-Id')).toBe('request-1');
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        details: { field: 'title' },
      },
      requestId: 'request-1',
    });
  });
});
