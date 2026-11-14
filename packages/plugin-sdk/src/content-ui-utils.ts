import type { HostMediaAssetListItem, HostMediaReferenceSelection } from './media-picker-client.js';

export type HostMediaFieldOption = Readonly<{
  assetId: string;
  label: string;
}>;

export type ContentMediaUploadPhase =
  'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';

const supportedContentMediaUploadMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

export const compactOptionalString = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
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

  if (
    [year, month, day, hour, minute].some((entry) => Number.isInteger(entry) === false) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second > 59
  ) {
    return '';
  }

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

export const toHostMediaFieldOptions = (
  assets: readonly HostMediaAssetListItem[]
): readonly HostMediaFieldOption[] => {
  const seenAssetIds = new Set<string>();

  return assets.flatMap((asset) => {
    if (seenAssetIds.has(asset.id)) {
      return [];
    }
    seenAssetIds.add(asset.id);
    return [
      {
        assetId: asset.id,
        label: String(asset.metadata?.title ?? asset.id),
      },
    ];
  });
};

export const isSupportedContentMediaUploadFile = (file: File): boolean =>
  supportedContentMediaUploadMimeTypes.has(file.type);

export const contentMediaUploadPhaseMessageKey = (
  phase: ContentMediaUploadPhase
): string | null => {
  switch (phase) {
    case 'initializing':
      return 'messages.mediaUploadInitializing';
    case 'uploading':
      return 'messages.mediaUploadUploading';
    case 'finalizing':
      return 'messages.mediaUploadFinalizing';
    case 'success':
      return 'messages.mediaUploadSuccess';
    case 'error':
      return 'messages.mediaUploadError';
    case 'idle':
      return null;
  }
};

export const readHostMediaAssetFileName = (asset: HostMediaAssetListItem): string =>
  asset.fileName?.trim() || asset.id;

export const readHostMediaAssetTitle = (asset: HostMediaAssetListItem): string => {
  const title = asset.metadata?.title;
  return typeof title === 'string' && title.trim().length > 0
    ? title.trim()
    : readHostMediaAssetFileName(asset);
};

export const readHostMediaAssetCopyright = (asset: HostMediaAssetListItem): string => {
  const copyright = asset.metadata?.copyright;
  return typeof copyright === 'string' ? copyright.trim() : '';
};

export const getHostMediaAssetPersistentUrl = (asset: HostMediaAssetListItem): string | null => {
  if (asset.visibility && asset.visibility !== 'public') {
    return null;
  }

  const url = asset.previewUrl?.trim();
  return url && url.length > 0 ? url : null;
};

export const findHostMediaReferenceAssetId = (
  references: readonly HostMediaReferenceSelection[],
  role: string
): string | null => references.find((reference) => reference.role === role)?.assetId ?? null;
