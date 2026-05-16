import type { HostMediaAssetListItem, HostMediaReferenceSelection } from './media-picker-client.js';

export type HostMediaFieldOption = Readonly<{
  assetId: string;
  label: string;
}>;

const editorLocale = 'de-DE';
const editorTimeZone = 'Europe/Berlin';

const editorDateTimeFormatter = new Intl.DateTimeFormat(editorLocale, {
  timeZone: editorTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const editorDateTimePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: editorTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const datetimeLocalPattern = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2})$/;

const parseDate = (value?: string): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatEditorDateTimeParts = (date: Date) => {
  const parts = editorDateTimePartsFormatter.formatToParts(date);
  const readPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';

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

export const formatDateTimeInEditorTimeZone = (value?: string): string | undefined => {
  const date = parseDate(value);
  return date ? editorDateTimeFormatter.format(date) : value;
};

export const toDatetimeLocalValue = (value?: string): string => {
  const date = parseDate(value);
  if (!date) {
    return '';
  }

  const parts = formatEditorDateTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
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

  if (
    [year, month, day, hour, minute].some((entry) => Number.isInteger(entry) === false) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return '';
  }

  if (referenceValue) {
    const referenceDate = parseDate(referenceValue);
    if (referenceDate && toDatetimeLocalValue(referenceDate.toISOString()) === value) {
      return referenceDate.toISOString();
    }
  }

  const naiveUtcTime = Date.UTC(year, month - 1, day, hour, minute);
  const searchWindowMs = 4 * 60 * 60 * 1000;

  for (let currentMs = naiveUtcTime - searchWindowMs; currentMs <= naiveUtcTime + searchWindowMs; currentMs += 60_000) {
    const isoValue = new Date(currentMs).toISOString();
    if (toDatetimeLocalValue(isoValue) === value) {
      return isoValue;
    }
  }

  return '';
};

export const toHostMediaFieldOptions = (assets: readonly HostMediaAssetListItem[]): readonly HostMediaFieldOption[] =>
  assets.map((asset) => ({
    assetId: asset.id,
    label: String(asset.metadata?.title ?? asset.id),
  }));

export const findHostMediaReferenceAssetId = (
  references: readonly HostMediaReferenceSelection[],
  role: string
): string | null => references.find((reference) => reference.role === role)?.assetId ?? null;
