import { describe, expect, it } from 'vitest';
import { redact, redactText } from './redaction.js';

describe('redaction', () => {
  it('redacts nested secret fields and bearer tokens', () => {
    expect(redact({ nested: { password: 'pw', value: 'Bearer abc.def.ghi' } })).toEqual({
      nested: { password: '[REDACTED]', value: 'Bearer [REDACTED]' },
    });
    expect(redactText('https://user:pw@example.org')).toBe('https://[REDACTED]@example.org');
    expect(redactText('postgres://db-user:pw@db.example/studio')).toBe(
      'postgres://[REDACTED]@db.example/studio'
    );
    expect(
      redact({
        databaseUrl: 'postgres://db-user:pw@db.example/studio',
        apiKey: 'provider-key',
        serviceRoleKey: 'service-role-key',
      })
    ).toEqual({
      databaseUrl: '[REDACTED]',
      apiKey: '[REDACTED]',
      serviceRoleKey: '[REDACTED]',
    });
    expect(
      redact({
        'x-confirmation-challenge-id': 'challenge',
        'x-confirmation-phrase': 'ARCHIVE demo',
      })
    ).toEqual({
      'x-confirmation-challenge-id': '[REDACTED]',
      'x-confirmation-phrase': '[REDACTED]',
    });
  });

  it('preserves only a public HTTPS OAuth endpoint across repeated redaction', () => {
    const oauthTokenUrl = 'https://id.example/realms/tenant/protocol/openid-connect/token';
    expect(redact(redact({ data: { oauthTokenUrl, accessToken: 'synthetic-token' } }))).toEqual({
      data: { oauthTokenUrl, accessToken: '[REDACTED]' },
    });
    for (const value of [
      'synthetic-secret',
      'http://id.example/token',
      'https://user:password@id.example/token',
      'https://id.example/token?secret=synthetic',
      'https://id.example/token#synthetic',
      { accessToken: 'synthetic-token' },
    ]) {
      expect(redact({ oauthTokenUrl: value })).toEqual({ oauthTokenUrl: '[REDACTED]' });
    }
  });

  it('preserves confirmation phrases and configured-state booleans in API payloads', () => {
    expect(
      redact({
        confirmationPhrase: 'ARCHIVE demo',
        authClientSecretConfigured: true,
        tenantAdminClient: { secretConfigured: false, secret: 'actual-secret' },
      })
    ).toEqual({
      confirmationPhrase: 'ARCHIVE demo',
      authClientSecretConfigured: true,
      tenantAdminClient: { secretConfigured: false, secret: '[REDACTED]' },
    });
  });
});
