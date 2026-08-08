import { describe, expect, it } from 'vitest';

import { readFieldError } from './form-errors.js';

describe('readFieldError', () => {
  it.each([null, undefined, false, 'invalid', [], {}])(
    'rejects values without a field-error shape (%j)',
    (value) => {
      expect(readFieldError(value)).toBeUndefined();
    }
  );

  it.each([
    { message: 'Required' },
    { type: 'required' },
    { message: undefined, type: undefined },
  ])('preserves supported field-error objects (%j)', (value) => {
    expect(readFieldError(value)).toBe(value);
  });
});
