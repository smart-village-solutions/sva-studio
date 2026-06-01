import { describe, expect, it } from 'vitest';

import { jsonResponse } from './db.js';

describe('jsonResponse', () => {
  it('marks auth runtime JSON responses as private and non-cacheable by default', () => {
    const response = jsonResponse(200, { ok: true });

    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Vary')).toBe('Cookie');
  });

  it('preserves explicit cache directives and appends Cookie to Vary once', () => {
    const response = jsonResponse(200, { ok: true }, {
      'Cache-Control': 'no-store',
      Vary: 'Origin, Cookie',
      'X-Request-Id': 'req-1',
    });

    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Vary')).toBe('Origin, Cookie');
    expect(response.headers.get('X-Request-Id')).toBe('req-1');
  });
});
