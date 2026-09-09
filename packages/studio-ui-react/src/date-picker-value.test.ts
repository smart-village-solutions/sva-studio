import { describe, expect, it } from 'vitest';

import { formatDatePickerValue, readDatePickerInput } from './date-picker-value.js';

describe('date-only input contract', () => {
  it.each([
    ['9.9.2026', 'de-DE', '2026-09-09'],
    ['29.02.2024', 'de-DE', '2024-02-29'],
    ['2026-03-29', 'de-DE', '2026-03-29'],
    ['10/25/2026', 'en-US', '2026-10-25'],
    ['25/10/2026', 'en-GB', '2026-10-25'],
  ] as const)('reads %s in %s without shifting the day', (input, locale, value) => {
    expect(readDatePickerInput(input, locale)).toEqual({ value, error: null });
    expect(readDatePickerInput(formatDatePickerValue(value, locale), locale).value).toBe(value);
  });

  it.each(['31.04.2026', '29.02.2026', '9.', '09.09.26', '2026-02-30', 'tomorrow'])(
    'rejects %s',
    (input) => {
      expect(readDatePickerInput(input, 'de-DE')).toEqual({ value: null, error: 'invalid' });
    }
  );

  it('distinguishes empty, required and date bounds', () => {
    expect(readDatePickerInput(' ', 'de-DE')).toEqual({ value: null, error: null });
    expect(readDatePickerInput('', 'de-DE', { required: true }).error).toBe('required');
    expect(readDatePickerInput('08.09.2026', 'de-DE', { min: '2026-09-09' }).error).toBe('min');
    expect(readDatePickerInput('10.09.2026', 'de-DE', { max: '2026-09-09' }).error).toBe('max');
    expect(
      readDatePickerInput('09.09.2026', 'de-DE', { min: '2026-09-09', max: '2026-09-09' }).error
    ).toBeNull();
    expect(formatDatePickerValue(null, 'de-DE')).toBe('');
  });
});
