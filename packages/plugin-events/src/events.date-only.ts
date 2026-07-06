const dateOnlyPattern = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/;
const isoDatePrefixPattern = /^(?<date>\d{4}-\d{2}-\d{2})(?:T|$)/;
const defaultEditorLocale = 'de-DE';

const editorDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const formatDateOnlyParts = (date: Date): string => {
  const parts = editorDateFormatter.formatToParts(date);
  const readPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';

  return `${readPart('year')}-${readPart('month')}-${readPart('day')}`;
};

const isValidDateOnlyParts = (year: number, month: number, day: number): boolean => {
  if (
    [year, month, day].some((entry) => Number.isInteger(entry) === false) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
};

const resolveDateOnlyLocale = (locale?: string): string => {
  const candidate = locale?.trim() || globalThis.document?.documentElement.lang?.trim() || defaultEditorLocale;

  try {
    return Intl.DateTimeFormat.supportedLocalesOf(candidate)[0] ?? defaultEditorLocale;
  } catch {
    return defaultEditorLocale;
  }
};

const extractIsoDatePrefix = (value: string): string => {
  const match = isoDatePrefixPattern.exec(value);
  return match?.groups?.date ?? '';
};

export const fromDateOnlyInputValue = (value: string): string => {
  if (value.length === 0) {
    return '';
  }

  const match = dateOnlyPattern.exec(value);
  if (!match?.groups) {
    return '';
  }

  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);

  return isValidDateOnlyParts(year, month, day) ? value : '';
};

export const isValidDateOnlyValue = (value?: string): boolean => {
  if (!value) {
    return true;
  }

  return fromDateOnlyInputValue(value).length > 0;
};

export const toDateOnlyInputValue = (value?: string): string => {
  if (!value) {
    return '';
  }

  const normalizedDateOnly = fromDateOnlyInputValue(value);
  if (normalizedDateOnly) {
    return normalizedDateOnly;
  }

  const normalizedIsoDatePrefix = fromDateOnlyInputValue(extractIsoDatePrefix(value));
  if (normalizedIsoDatePrefix) {
    return normalizedIsoDatePrefix;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : formatDateOnlyParts(parsed);
};

export const formatDateOnlyForEditor = (value?: string, locale?: string): string | undefined => {
  const normalizedDateOnly = value ? fromDateOnlyInputValue(value) : '';
  if (!normalizedDateOnly) {
    return value;
  }

  const [year, month, day] = normalizedDateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(resolveDateOnlyLocale(locale), {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};
