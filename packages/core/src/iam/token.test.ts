import { describe, expect, it, vi } from 'vitest';

import { parseJwtPayload } from './token.js';

describe('parseJwtPayload', () => {
  it('returns null when the token does not include a payload segment', () => {
    expect(parseJwtPayload('header-only')).toBeNull();
  });

  it('returns null when atob is unavailable', () => {
    const originalAtob = globalThis.atob;
    vi.stubGlobal('atob', undefined);

    expect(parseJwtPayload('header.payload.signature')).toBeNull();

    vi.stubGlobal('atob', originalAtob);
  });

  it('decodes base64url payloads into objects', () => {
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-1',
        preferred_username: 'max',
        scope: ['news.read'],
      }),
      'utf8'
    )
      .toString('base64url');

    expect(parseJwtPayload(`header.${payload}.signature`)).toEqual({
      sub: 'user-1',
      preferred_username: 'max',
      scope: ['news.read'],
    });
  });

  it('returns null for invalid base64 or non-object json payloads', () => {
    expect(parseJwtPayload('header.%%%invalid%%%.signature')).toBeNull();

    const primitivePayload = Buffer.from(JSON.stringify('text'), 'utf8').toString('base64url');
    expect(parseJwtPayload(`header.${primitivePayload}.signature`)).toBeNull();
  });
});
