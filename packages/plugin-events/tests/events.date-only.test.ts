import { describe, expect, it } from 'vitest';

import {
  formatDateOnlyForEditor,
  fromDateOnlyInputValue,
  isValidDateOnlyValue,
  toDateOnlyInputValue,
} from '../src/events.date-only.js';

describe('event date-only helpers', () => {
  it('rejects malformed and impossible calendar values', () => {
    expect(fromDateOnlyInputValue('')).toBe('');
    expect(fromDateOnlyInputValue('08.08.2026')).toBe('');
    expect(fromDateOnlyInputValue('2026-02-29')).toBe('');
    expect(isValidDateOnlyValue()).toBe(true);
    expect(isValidDateOnlyValue('2026-08-08')).toBe(true);
    expect(isValidDateOnlyValue('2026-13-08')).toBe(false);
  });

  it('normalizes date-only, ISO, invalid, and timestamp inputs for the editor', () => {
    expect(toDateOnlyInputValue()).toBe('');
    expect(toDateOnlyInputValue('2026-08-08')).toBe('2026-08-08');
    expect(toDateOnlyInputValue('2026-08-08T23:59:00.000Z')).toBe('2026-08-08');
    expect(toDateOnlyInputValue('invalid')).toBe('');
    expect(toDateOnlyInputValue('2026-08-08T00:00:00+02:00')).toMatch(/^2026-08-0[78]$/);
  });

  it('formats valid calendar days and preserves absent or invalid values', () => {
    expect(formatDateOnlyForEditor(undefined, 'de-DE')).toBeUndefined();
    expect(formatDateOnlyForEditor('invalid', 'de-DE')).toBe('invalid');
    expect(formatDateOnlyForEditor('2026-08-08', 'de-DE')).toBe('08.08.2026');
    expect(formatDateOnlyForEditor('2026-08-08', 'not_a_locale')).toBeTruthy();
  });
});
