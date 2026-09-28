import { describe, expect, it } from 'vitest';
import { isUuid, readBoolean, readNumber, readObject, readString } from './input-readers.js';

describe('shared request helpers', () => {
  it('reads primitive input values defensively', () => {
    expect(readString(' value ')).toBe('value');
    expect(readString('   ')).toBeUndefined();
    expect(readString(1)).toBeUndefined();
    expect(readNumber(3)).toBe(3);
    expect(readNumber(Number.NaN)).toBeUndefined();
    expect(readNumber('3')).toBeUndefined();
    expect(readBoolean(false)).toBe(false);
    expect(readBoolean('false')).toBeUndefined();
    expect(readObject({ id: '1' })).toEqual({ id: '1' });
    expect(readObject([])).toBeUndefined();
    expect(readObject(null)).toBeUndefined();
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isUuid('22222222-2222-2222-2222-222222222222')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});
