import type { IamContentStatus } from '@sva/core';

export type ContentPublicationInvariantCode =
  | 'content_published_at_required'
  | 'content_publication_window_invalid';

const isoDateTimePattern =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.(?<fraction>\d{1,9}))?(?<offset>Z|[+-](?<offsetHour>\d{2}):(?<offsetMinute>\d{2}))$/;

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const resolveDaysInMonth = (year: number, month: number): number => {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
};

const resolveComparableTimestamp = (value: string): bigint | null => {
  const match = isoDateTimePattern.exec(value);

  if (!match?.groups) {
    return null;
  }

  const year = Number.parseInt(match.groups.year, 10);
  const month = Number.parseInt(match.groups.month, 10);
  const day = Number.parseInt(match.groups.day, 10);
  const hour = Number.parseInt(match.groups.hour, 10);
  const minute = Number.parseInt(match.groups.minute, 10);
  const second = Number.parseInt(match.groups.second, 10);
  const offsetHour = match.groups.offsetHour ? Number.parseInt(match.groups.offsetHour, 10) : 0;
  const offsetMinute = match.groups.offsetMinute ? Number.parseInt(match.groups.offsetMinute, 10) : 0;

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > resolveDaysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }

  const fraction = (match.groups.fraction ?? '').padEnd(9, '0');
  const fractionalNanoseconds = fraction ? Number.parseInt(fraction, 10) : 0;
  const millisecondFraction = Math.trunc(fractionalNanoseconds / 1_000_000);
  const remainingNanoseconds = fractionalNanoseconds % 1_000_000;
  const offsetMinutes =
    match.groups.offset === 'Z'
      ? 0
      : (match.groups.offset.startsWith('-') ? -1 : 1) * (offsetHour * 60 + offsetMinute);
  const epochMilliseconds =
    Date.UTC(year, month - 1, day, hour, minute, second, millisecondFraction) - offsetMinutes * 60_000;

  if (Number.isNaN(epochMilliseconds)) {
    return null;
  }

  return BigInt(epochMilliseconds) * 1_000_000n + BigInt(remainingNanoseconds);
};

export const resolveContentPublicationInvariant = (value: {
  readonly status?: IamContentStatus;
  readonly publishedAt?: string | null;
  readonly publishFrom?: string | null;
  readonly publishUntil?: string | null;
}): ContentPublicationInvariantCode | null => {
  if (value.status === 'published' && !value.publishedAt) {
    return 'content_published_at_required';
  }
  if (value.publishFrom && value.publishUntil) {
    const publishFrom = resolveComparableTimestamp(value.publishFrom);
    const publishUntil = resolveComparableTimestamp(value.publishUntil);

    if (publishFrom !== null && publishUntil !== null && publishFrom >= publishUntil) {
      return 'content_publication_window_invalid';
    }
  }
  return null;
};
