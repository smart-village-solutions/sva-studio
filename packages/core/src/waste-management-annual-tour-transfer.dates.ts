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

type WasteAnnualCadenceInput = Readonly<{
  sourceFirstDate: string;
  sourceEndDate?: string;
  sourceYear?: number;
  targetYear: number;
  intervalDays: number;
  targetSliceStart?: string;
  targetSliceEnd?: string;
}>;

const resolveWasteAnnualSourceSlice = (
  input: WasteAnnualCadenceInput
): Readonly<{ start: string; end?: string }> => {
  if (input.sourceYear === undefined) {
    return { start: input.sourceFirstDate, end: input.sourceEndDate };
  }
  const yearStart = wasteAnnualStartOfYear(input.sourceYear);
  const yearEnd = wasteAnnualEndOfYear(input.sourceYear);
  return {
    start: input.sourceFirstDate > yearStart ? input.sourceFirstDate : yearStart,
    end: input.sourceEndDate && input.sourceEndDate < yearEnd ? input.sourceEndDate : yearEnd,
  };
};

const resolveWasteAnnualTargetSliceEnd = (
  input: WasteAnnualCadenceInput,
  sourceSliceEnd: string | undefined
): string | null => {
  if (input.targetSliceEnd) return input.targetSliceEnd;
  if (sourceSliceEnd) return replaceWasteAnnualYear(sourceSliceEnd, input.targetYear);
  return wasteAnnualEndOfYear(input.targetYear);
};

export const continueWasteAnnualTourCadence = (
  input: WasteAnnualCadenceInput
): Readonly<{ firstDate: string; endDate?: string }> | null => {
  const sourceFirst = parseWasteAnnualIsoDate(input.sourceFirstDate);
  if (!sourceFirst || !Number.isInteger(input.intervalDays) || input.intervalDays <= 0) return null;
  const sourceSlice = resolveWasteAnnualSourceSlice(input);
  if (sourceSlice.end && sourceSlice.start > sourceSlice.end) return null;
  const boundary = parseWasteAnnualIsoDate(
    input.targetSliceStart ?? replaceWasteAnnualYear(sourceSlice.start, input.targetYear) ?? ''
  );
  if (!boundary) return null;
  const elapsedDays = Math.floor((boundary.getTime() - sourceFirst.getTime()) / 86_400_000);
  const remainder = ((elapsedDays % input.intervalDays) + input.intervalDays) % input.intervalDays;
  const firstTarget = addUtcDays(boundary, remainder === 0 ? 0 : input.intervalDays - remainder);
  const mappedEnd = resolveWasteAnnualTargetSliceEnd(input, sourceSlice.end);
  if (!mappedEnd || formatWasteAnnualIsoDate(firstTarget) > mappedEnd) return null;
  return {
    firstDate: formatWasteAnnualIsoDate(firstTarget),
    ...(sourceSlice.end ? { endDate: mappedEnd } : {}),
  };
};
