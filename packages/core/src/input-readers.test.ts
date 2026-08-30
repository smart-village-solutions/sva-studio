import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  isUuid,
  readBoolean,
  readNumber,
  readNumberLike,
  readObject,
  readString,
} from './input-readers.js';

describe('input readers', () => {
  it('keeps string trimming and empty-value fallback stable', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const normalized = value.trim();

        expect(readString(value)).toBe(normalized.length > 0 ? normalized : undefined);
      })
    );
  });

  it('preserves finite number boundaries and permissive numeric-string parsing', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (value) => {
        const numericString = `  ${String(value)}  `;

        expect(readNumber(value)).toBe(value);
        expect(readNumberLike(value)).toBe(value);
        expect(readNumberLike(numericString)).toBe(Number(numericString));
      })
    );
  });

  it('preserves booleans and object records while rejecting incompatible types', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.dictionary(fc.string(), fc.anything()),
        fc.array(fc.anything()),
        (booleanValue, objectValue, arrayValue) => {
          expect(readBoolean(booleanValue)).toBe(booleanValue);
          expect(readObject(objectValue)).toBe(objectValue);
          expect(readObject(arrayValue)).toBeUndefined();
        }
      )
    );

    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)), (value) => {
        expect(readObject(value)).toBeUndefined();
      })
    );
  });

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
    expect(isUuid('22222222-2222-2222-2222-222222222222')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  it('supports permissive number parsing when callers allow numeric strings', () => {
    expect(readNumberLike(42)).toBe(42);
    expect(readNumberLike(' 42 ')).toBe(42);
    expect(readNumberLike(true)).toBeUndefined();
    expect(readNumberLike('')).toBeUndefined();
    expect(readNumberLike('abc')).toBeUndefined();
  });
});
