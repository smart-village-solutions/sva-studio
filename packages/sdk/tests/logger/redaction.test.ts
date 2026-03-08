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
});
