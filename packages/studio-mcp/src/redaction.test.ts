import { describe, expect, it } from 'vitest';
import { redact, redactText } from './redaction.js';

describe('redaction', () => {
  it('redacts nested secret fields and bearer tokens', () => {
    expect(redact({ nested: { password: 'pw', value: 'Bearer abc.def.ghi' } })).toEqual({
      nested: { password: '[REDACTED]', value: 'Bearer [REDACTED]' },
    });
    expect(redactText('https://user:pw@example.org')).toBe('https://[REDACTED]@example.org');
    expect(redact({
      'x-confirmation-challenge-id': 'challenge',
      'x-confirmation-phrase': 'ARCHIVE demo',
    })).toEqual({
      'x-confirmation-challenge-id': '[REDACTED]',
      'x-confirmation-phrase': '[REDACTED]',
    });
  });
});
