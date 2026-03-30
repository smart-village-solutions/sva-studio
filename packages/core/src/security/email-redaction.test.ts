import { describe, expect, it } from 'vitest';

import { maskEmailAddresses } from './email-redaction.js';

describe('maskEmailAddresses', () => {
  it('masks valid email addresses', () => {
    expect(maskEmailAddresses('Kontakt: alice@example.org')).toBe('Kontakt: a***@example.org');
    expect(maskEmailAddresses('Mehrere: alice@example.org, bob@example.net')).toBe(
      'Mehrere: a***@example.org, b***@example.net'
    );
  });

  it('keeps invalid fragments unchanged', () => {
    expect(maskEmailAddresses('invalid@ localhost')).toBe('invalid@ localhost');
    expect(maskEmailAddresses('x@y.z')).toBe('x@y.z');
  });
});
