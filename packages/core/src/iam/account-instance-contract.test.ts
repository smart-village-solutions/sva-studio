/** UTC date contract shared by browser previews and server validation. */
import { describe, expect, it } from 'vitest';
import { instanceBusKeyExpiresAt } from './account-instance-contract.js';

describe('inclusive Bus key date', () => {
  it.each([
    ['2026-12-31', '2027-01-01T00:00:00.000Z'],
    ['2027-03-15', '2027-03-16T00:00:00.000Z'],
    ['2028-02-29', '2028-03-01T00:00:00.000Z'],
    ['2027-03-28', '2027-03-29T00:00:00.000Z'],
    ['2027-10-31', '2027-11-01T00:00:00.000Z'],
  ])('converts %s with UTC calendar arithmetic', (input, expected) => {
    expect(instanceBusKeyExpiresAt(input)).toBe(expected);
  });
  it.each([
    '2027-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-1-01',
    'invalid',
    '9999-12-31',
    '2026-12-31T00:00:00Z',
  ])('rejects invalid date %s', (input) => {
    expect(instanceBusKeyExpiresAt(input)).toBeUndefined();
  });
});
