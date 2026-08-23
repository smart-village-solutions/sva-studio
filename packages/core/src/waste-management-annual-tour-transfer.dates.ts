import { WasteAnnualTourTransferError } from './waste-management-annual-tour-transfer.contract.js';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseWasteAnnualIsoDate = (value: string): Date | null => {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
};

export const formatWasteAnnualIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
export const wasteAnnualYearOf = (value: string): number | null =>
  parseWasteAnnualIsoDate(value)?.getUTCFullYear() ?? null;
export const wasteAnnualStartOfYear = (year: number): string => `${year}-01-01`;
export const wasteAnnualEndOfYear = (year: number): string => `${year}-12-31`;
export const isWasteAnnualDateInYear = (value: string, year: number): boolean =>
  wasteAnnualYearOf(value) === year;

export const deriveWasteAnnualTourTransferTargetYear = (
  sourceYear: number,
  currentYear: number
): number => {
  if (!Number.isInteger(sourceYear) || ![currentYear - 1, currentYear].includes(sourceYear)) {
    throw new WasteAnnualTourTransferError('invalid_source_year');
  }
  return sourceYear + 1;
};

export const replaceWasteAnnualYear = (value: string, targetYear: number): string | null => {
  const source = parseWasteAnnualIsoDate(value);
  if (!source) return null;
  const target = new Date(Date.UTC(targetYear, source.getUTCMonth(), source.getUTCDate()));
  return target.getUTCMonth() === source.getUTCMonth() &&
    target.getUTCDate() === source.getUTCDate()
    ? formatWasteAnnualIsoDate(target)
    : null;
};

const addUtcDays = (value: Date, days: number): Date => {
  const result = new Date(value.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

export const mapWasteAnnualConcreteDate = (
  sourceDate: string,
  targetYear: number,
  replacementDate?: string
): string | null => {
  if (replacementDate !== undefined) {
    return isWasteAnnualDateInYear(replacementDate, targetYear) ? replacementDate : null;
  }
  const source = parseWasteAnnualIsoDate(sourceDate);
  if (!source) return null;
  const sameCalendarDate = replaceWasteAnnualYear(sourceDate, targetYear);
  if (!sameCalendarDate) return null;
  const target = parseWasteAnnualIsoDate(sameCalendarDate);
  if (!target) return null;
  const candidates = Array.from({ length: 13 }, (_, index) => index - 6)
    .map((offset) => addUtcDays(target, offset))
    .filter(
      (candidate) =>
        candidate.getUTCFullYear() === targetYear && candidate.getUTCDay() === source.getUTCDay()
    )
    .sort(
      (left, right) =>
        Math.abs(left.getTime() - target.getTime()) -
          Math.abs(right.getTime() - target.getTime()) || left.getTime() - right.getTime()
    );
  return candidates[0] ? formatWasteAnnualIsoDate(candidates[0]) : null;
};

export const continueWasteAnnualTourCadence = (input: {
  sourceFirstDate: string;
  sourceEndDate?: string;
  targetYear: number;
  intervalDays: number;
}): Readonly<{ firstDate: string; endDate?: string }> | null => {
  const sourceFirst = parseWasteAnnualIsoDate(input.sourceFirstDate);
  if (!sourceFirst || !Number.isInteger(input.intervalDays) || input.intervalDays <= 0) return null;
  const boundary = parseWasteAnnualIsoDate(
    replaceWasteAnnualYear(input.sourceFirstDate, input.targetYear) ?? ''
  );
  if (!boundary) return null;
  const elapsedDays = Math.floor((boundary.getTime() - sourceFirst.getTime()) / 86_400_000);
  const remainder = ((elapsedDays % input.intervalDays) + input.intervalDays) % input.intervalDays;
  const firstTarget = addUtcDays(boundary, remainder === 0 ? 0 : input.intervalDays - remainder);
  const mappedEnd = input.sourceEndDate
    ? replaceWasteAnnualYear(input.sourceEndDate, input.targetYear)
    : wasteAnnualEndOfYear(input.targetYear);
  if (!mappedEnd || formatWasteAnnualIsoDate(firstTarget) > mappedEnd) return null;
  return {
    firstDate: formatWasteAnnualIsoDate(firstTarget),
    ...(input.sourceEndDate ? { endDate: mappedEnd } : {}),
  };
};
