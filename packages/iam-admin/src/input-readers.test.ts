import { describe, expect, it } from 'vitest';

import { isUuid, readBoolean, readNumber, readObject, readString } from './input-readers.js';

describe('input readers', () => {
  it('normalizes primitive request values safely', () => {
    expect(readString(' value ')).toBe('value');
    expect(readString('   ')).toBeUndefined();
    expect(readString(123)).toBeUndefined();
    expect(readNumber(42)).toBe(42);
    expect(readNumber(Number.NaN)).toBeUndefined();
    expect(readNumber('42')).toBeUndefined();
    expect(readBoolean(false)).toBe(false);
    expect(readBoolean('false')).toBeUndefined();
  });

  it('accepts only plain object-like records and UUID strings', () => {
    const value = { ok: true };

    expect(readObject(value)).toBe(value);
    expect(readObject(null)).toBeUndefined();
    expect(readObject([])).toBeUndefined();
    expect(isUuid('00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});
