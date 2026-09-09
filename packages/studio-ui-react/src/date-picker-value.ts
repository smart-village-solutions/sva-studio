import { format, isValid, parse } from 'date-fns';

export type DatePickerLocale = 'de-DE' | 'en-GB' | 'en-US';
export type DatePickerError = 'invalid' | 'required' | 'min' | 'max';

const formats = {
  'de-DE': { pattern: 'dd.MM.yyyy', input: /^\d{1,2}\.\d{1,2}\.\d{4}$/ },
  'en-GB': { pattern: 'dd/MM/yyyy', input: /^\d{1,2}\/\d{1,2}\/\d{4}$/ },
  'en-US': { pattern: 'MM/dd/yyyy', input: /^\d{1,2}\/\d{1,2}\/\d{4}$/ },
} as const;
const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
const referenceDate = new Date(2000, 0, 1);

export const parseDatePickerValue = (value: string): Date | undefined => {
  if (!isoPattern.test(value)) return undefined;
  const date = parse(value, 'yyyy-MM-dd', referenceDate);
  return isValid(date) ? date : undefined;
};

export const toDatePickerValue = (date: Date): string => format(date, 'yyyy-MM-dd');

export const initialDatePickerMonth = (
  selected: Date | undefined,
  min?: string,
  max?: string
): Date => {
  const date = selected ?? new Date();
  const minimum = min ? parseDatePickerValue(min) : undefined;
  const maximum = max ? parseDatePickerValue(max) : undefined;
  if (minimum && date < minimum) return minimum;
  if (maximum && date > maximum) return maximum;
  return date;
};

export const formatDatePickerValue = (value: string | null, locale: DatePickerLocale): string => {
  const date = value ? parseDatePickerValue(value) : undefined;
  return date ? format(date, formats[locale].pattern) : '';
};

export const readDatePickerInput = (
  input: string,
  locale: DatePickerLocale,
  constraints: Readonly<{ required?: boolean; min?: string; max?: string }> = {}
): Readonly<{ value: string | null; error: DatePickerError | null }> => {
  const text = input.trim();
  if (!text) return { value: null, error: constraints.required ? 'required' : null };
  const local = formats[locale];
  const date = isoPattern.test(text)
    ? parseDatePickerValue(text)
    : local.input.test(text)
      ? parse(text, local.pattern, referenceDate)
      : undefined;
  if (!date || !isValid(date)) return { value: null, error: 'invalid' };
  const value = toDatePickerValue(date);
  if (constraints.min && value < constraints.min) return { value: null, error: 'min' };
  if (constraints.max && value > constraints.max) return { value: null, error: 'max' };
  return { value, error: null };
};
