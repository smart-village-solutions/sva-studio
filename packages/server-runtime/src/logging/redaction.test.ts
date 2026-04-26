import { describe, expect, it } from 'vitest';

import {
  redactLogMeta,
  redactLogString,
  serializeAndRedactLogValue,
  stringifyNonPlainValue,
} from './redaction.js';

describe('server-runtime log redaction', () => {
  it('redacts common secrets in strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature';
    const value = [
      'Authorization: Bearer secret-token',
      'https://example.test/callback?code=abc&client_secret=s3cr3t',
      `token=${jwt}`,
      'user max.mustermann@example.test',
      'password: open-sesame',
    ].join(' ');

    expect(redactLogString(value)).toContain('Authorization: [REDACTED]');
    expect(redactLogString(value)).toContain('client_secret=[REDACTED]');
    expect(redactLogString(value)).toContain('token=[REDACTED]');
    expect(redactLogString(value)).not.toContain('max.mustermann@example.test');
    expect(redactLogString(value)).toContain('password: [REDACTED]');
  });

  it('redacts sensitive object keys recursively and serializes safe values', () => {
    const error = new Error('failed for alice@example.test with token=abc');
    Object.assign(error, { user_id: 'user-1' });

    expect(
      redactLogMeta({
        ok: true,
        password: 'secret',
        nested: {
          email: 'alice@example.test',
          createdAt: new Date('2026-01-02T03:04:05.000Z'),
          error,
          list: ['Bearer token-value', 5, null],
        },
      })
    ).toMatchObject({
      ok: true,
      password: '[REDACTED]',
      nested: {
        email: '[REDACTED]',
        createdAt: '2026-01-02T03:04:05.000Z',
        error: {
          name: 'Error',
          message: 'failed for a***@example.test with token=[REDACTED]',
          user_id: 'user-1',
        },
        list: ['Bearer [REDACTED]', 5, null],
      },
    });
  });

  it('handles non-plain values defensively', () => {
    const invalidDate = new Date(Number.NaN);
    class CustomValue {
      public toString(): string {
        return 'custom token=abc';
      }
    }
    class BrokenValue {
      public toString(): string {
        throw new Error('nope');
      }
    }

    expect(serializeAndRedactLogValue(undefined)).toBeNull();
    expect(serializeAndRedactLogValue(invalidDate)).toBe('Invalid Date');
    expect(serializeAndRedactLogValue(new CustomValue())).toBe('custom token=[REDACTED]');
    expect(stringifyNonPlainValue(new BrokenValue())).toBe('[object Object]');
    expect(serializeAndRedactLogValue(Symbol('secret'))).toBe('Symbol(secret)');
  });
});
