import { describe, expect, it } from 'vitest';
import { redactObject } from '../../src/logger/index.server';

describe('logger redaction', () => {
  it('redacts extended sensitive keys', () => {
    const sanitized = redactObject({
      cookie: 'session=value',
      'set-cookie': 'session=value',
      session: 'abc',
      csrf: 'csrf-token',
      refresh_token: 'refresh-token',
      access_token: 'access-token',
      'x-api-key': 'api-key',
      'x-csrf-token': 'csrf-header',
      safe: 'ok',
    });

    expect(sanitized.cookie).toBe('[REDACTED]');
    expect(sanitized['set-cookie']).toBe('[REDACTED]');
    expect(sanitized.session).toBe('[REDACTED]');
    expect(sanitized.csrf).toBe('[REDACTED]');
    expect(sanitized.refresh_token).toBe('[REDACTED]');
    expect(sanitized.access_token).toBe('[REDACTED]');
    expect(sanitized['x-api-key']).toBe('[REDACTED]');
    expect(sanitized['x-csrf-token']).toBe('[REDACTED]');
    expect(sanitized.safe).toBe('ok');
  });

  it('redacts sensitive query params, jwt payloads and inline bearer tokens in strings', () => {
    const sanitized = redactObject({
      redirect_target:
        'https://issuer.example/logout?id_token_hint=eyJhbGciOiJub25lIn0.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5vcmcifQ.signature&post_logout_redirect_uri=http://localhost:3000',
      authorization_header: 'Authorization: Bearer secret-token-value',
      note: 'callback failed for bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.signature and code=abc123',
    });

    expect(sanitized.redirect_target).toContain('id_token_hint=[REDACTED]');
    expect(sanitized.redirect_target).not.toContain('test@example.org');
    expect(sanitized.authorization_header).toContain('Authorization: [REDACTED]');
    expect(sanitized.note).toContain('[REDACTED_JWT]');
    expect(sanitized.note).toContain('code=[REDACTED]');
  });
});
