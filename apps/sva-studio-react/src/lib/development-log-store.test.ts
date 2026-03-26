import { beforeEach, describe, expect, it } from 'vitest';

import { appendBrowserDevelopmentLog, resetBrowserDevelopmentLogsForTests } from './development-log-store';

describe('development log store', () => {
  beforeEach(() => {
    resetBrowserDevelopmentLogsForTests();
  });

  it('redacts sensitive browser log messages and context values', () => {
    const entry = appendBrowserDevelopmentLog(
      'error',
      [
        'Authorization: Bearer secret-token-value',
        'https://issuer.example/logout?id_token_hint=eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.signature',
      ],
      {
        email: 'test@example.org',
        nested: {
          code: 'abc123',
          note: 'bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.signature',
        },
      }
    );

    expect(entry.message).toContain('Authorization: [REDACTED]');
    expect(entry.message).toContain('id_token_hint=[REDACTED]');
    expect(entry.context).toEqual({
      email: '[REDACTED]',
      nested: {
        code: 'abc123',
        note: 'bearer [REDACTED_JWT]',
      },
    });
  });
});