import { describe, expect, it } from 'vitest';

import { decodeLoginStateCookie, encodeLoginStateCookie } from './login-state-cookie.js';

describe('login-state-cookie', () => {
  it('roundtrips platform payloads through the schema-backed cookie codec', () => {
    const payload = {
      kind: 'platform' as const,
      state: 'state-1',
      codeVerifier: 'verifier-1',
      nonce: 'nonce-1',
      createdAt: Date.now(),
      returnTo: '/admin',
      silent: true,
    };

    const encoded = encodeLoginStateCookie(payload, 'secret');

    expect(decodeLoginStateCookie(encoded, 'secret')).toEqual(payload);
  });

  it('rejects tampered signatures', () => {
    const encoded = encodeLoginStateCookie(
      {
        kind: 'instance' as const,
        instanceId: 'tenant-a',
        state: 'state-1',
        codeVerifier: 'verifier-1',
        nonce: 'nonce-1',
        createdAt: Date.now(),
      },
      'secret'
    );

    expect(decodeLoginStateCookie(`${encoded}tampered`, 'secret')).toBeNull();
  });
});
