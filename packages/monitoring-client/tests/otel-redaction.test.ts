import { describe, expect, it } from 'vitest';

import { maskEmailAddresses } from '../src/otel.server.js';

describe('otel redaction', () => {
  it('masks email addresses without relying on backtracking-heavy patterns', () => {
    expect(maskEmailAddresses('Kontakt: alice@example.org')).toBe('Kontakt: a***@example.org');
    expect(maskEmailAddresses('Mehrere: alice@example.org, bob@example.net')).toBe(
      'Mehrere: a***@example.org, b***@example.net'
    );
    expect(maskEmailAddresses('Kein Treffer: invalid@ localhost')).toBe('Kein Treffer: invalid@ localhost');
  });
});
