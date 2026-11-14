/** Browser-safe temporal values and translation binding; no host operations. */
import { usePluginTranslation } from './plugin-translations.js';
import { compactOptionalString } from './content-ui-utils.js';

const editorTimeZone = 'Europe/Berlin';
const defaultEditorLocale = 'de-DE';
type DateTimeFormatOptionsWithFractionalSeconds = Intl.DateTimeFormatOptions & {
  fractionalSecondDigits?: 1 | 2 | 3;
};

const editorDateTimePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: editorTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const createDateTimeFormatter = (
  locale: string,
  options: Omit<DateTimeFormatOptionsWithFractionalSeconds, 'timeZone'>
) =>
  new Intl.DateTimeFormat(locale, {
    timeZone: editorTimeZone,
    ...options,
  });

const datetimeLocalPattern =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2})(?::(?<second>\d{2})(?:\.(?<fraction>\d{1,3}))?)?$/;

const parseDate = (value?: string): Date | null => {
  if (!value || !isInstant(value)) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatEditorDateTimeParts = (date: Date) => {
  const parts = editorDateTimePartsFormatter.formatToParts(date);
  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    year: readPart('year'),
    month: readPart('month'),
    day: readPart('day'),
    hour: readPart('hour'),
    minute: readPart('minute'),
  };
};

const inferEditorLocaleFromEnvironment = (): string | undefined => {
  if (typeof globalThis.document === 'undefined') {
    return undefined;
  }

  const documentLocale = compactOptionalString(globalThis.document.documentElement.lang);
  if (!documentLocale) {
    return undefined;
  }

  if (documentLocale === 'en') {
    return 'en-GB';
  }

  if (documentLocale === 'de') {
    return 'de-DE';
  }

  return documentLocale;
};

export const resolveEditorLocale = (locale?: string): string => {
  const candidate =
    compactOptionalString(locale) ?? inferEditorLocaleFromEnvironment() ?? defaultEditorLocale;

  try {
    return Intl.DateTimeFormat.supportedLocalesOf(candidate)[0] ?? defaultEditorLocale;
  } catch {
    return defaultEditorLocale;
  }
};

/** Calendar dates and wall-clock times have no time zone. Never parse them as instants. */
export const isCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const isTimeOfDay = (value: string): boolean =>
  /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.test(value);

export const isLocalDateTime = (value: string): boolean => {
  const [day, time, extra] = value.split('T');
  return extra === undefined && isCalendarDate(day ?? '') && isTimeOfDay(time ?? '');
};

/** An instant must carry an explicit offset; browser-local parsing is never a wire contract. */
export const isInstant = (value: string): boolean => {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?)(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (
    !match ||
    !isCalendarDate(match[1]!) ||
    !isTimeOfDay(match[2]!.replace(/(\.\d{3})\d+$/, '$1'))
  )
    return false;
  return Number.isFinite(Date.parse(value));
};

export const formatCalendarDate = (value?: string, locale?: string): string | undefined => {
  if (!value || !isCalendarDate(value)) return value;
  return new Intl.DateTimeFormat(resolveEditorLocale(locale), {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(`${value}T00:00:00.000Z`));
};

export const formatTimeOfDay = (value?: string, locale?: string): string | undefined => {
  if (!value || !isTimeOfDay(value)) return value;
  return new Intl.DateTimeFormat(resolveEditorLocale(locale), {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(value.length > 5 ? { second: '2-digit' as const } : {}),
    ...(value.includes('.') ? { fractionalSecondDigits: 3 as const } : {}),
  }).format(new Date(`2000-01-01T${value}Z`));
};

export const formatLocalDateTime = (value?: string, locale?: string): string | undefined => {
  if (!value || !isLocalDateTime(value)) return value;
  return `${formatCalendarDate(value.split('T')[0], locale)}, ${formatTimeOfDay(value.split('T')[1], locale)}`;
};

export const formatDateTimeInEditorTimeZone = (
  value?: string,
  locale?: string
): string | undefined => {
  const date = parseDate(value);
  return date
    ? createDateTimeFormatter(resolveEditorLocale(locale), {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(date)
    : value;
};

export const formatTechnicalDateTimeInEditorTimeZone = (
  value?: string,
  locale?: string
): string | undefined => {
  const date = parseDate(value);
  return date
    ? createDateTimeFormatter(resolveEditorLocale(locale), {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
        hourCycle: 'h23',
      }).format(date)
    : value;
};

export const toDatetimeLocalValue = (value?: string): string => {
  const date = parseDate(value);
  if (!date) {
    return '';
  }

  const parts = formatEditorDateTimeParts(date);
  const base = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  const seconds = date.getUTCSeconds();
  const milliseconds = date.getUTCMilliseconds();
  return seconds || milliseconds
    ? `${base}:${String(seconds).padStart(2, '0')}${milliseconds ? `.${String(milliseconds).padStart(3, '0')}` : ''}`
    : base;
};

export const fromDatetimeLocalValue = (value: string, referenceValue?: string): string => {
  if (value.length === 0) {
    return '';
  }

  if (!isLocalDateTime(value)) return '';
  const match = datetimeLocalPattern.exec(value);
  if (!match?.groups) {
    return '';
  }

  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  const hour = Number(match.groups.hour);
  const minute = Number(match.groups.minute);
  const second = Number(match.groups.second ?? 0);
  const millisecond = Number((match.groups.fraction ?? '').padEnd(3, '0'));
  const matchesInput = (date: Date) =>
    toDatetimeLocalValue(date.toISOString()).slice(0, 16) === value.slice(0, 16) &&
    (match.groups?.second === undefined ||
      (date.getUTCSeconds() === second && date.getUTCMilliseconds() === millisecond));

  if (referenceValue) {
    const referenceDate = parseDate(referenceValue);
    if (referenceDate && matchesInput(referenceDate)) {
      return referenceValue;
    }
  }

  const naiveUtcTime = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const searchWindowMs = 4 * 60 * 60 * 1000;

  for (
    let currentMs = naiveUtcTime - searchWindowMs;
    currentMs <= naiveUtcTime + searchWindowMs;
    currentMs += 60_000
  ) {
    const isoValue = new Date(currentMs).toISOString();
    if (matchesInput(new Date(isoValue))) {
      return isoValue;
    }
  }

  return '';
};

export const useTemporalTranslation = () => usePluginTranslation('shared');
