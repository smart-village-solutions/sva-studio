import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import {
  continueWasteAnnualTourCadence,
  formatWasteAnnualIsoDate,
  isWasteAnnualDateInYear,
  parseWasteAnnualIsoDate,
} from './waste-management-annual-tour-transfer.dates.js';

const addUtcDays = (value: Date, days: number): Date => {
  const result = new Date(value.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

export const wasteAnnualIntervalForTour = (tour: WasteTourRecord): number | null => {
  if (tour.customRecurrenceId) return tour.customRecurrenceIntervalDays ?? null;
  if (tour.recurrence === 'weekly') return 7;
  if (tour.recurrence === 'biweekly') return 14;
  if (tour.recurrence === 'fourweekly') return 28;
  return null;
};

export const isWasteAnnualCadenceOccurrence = (input: {
  readonly date: string;
  readonly firstDate: string;
  readonly endDate?: string;
  readonly year: number;
  readonly intervalDays: number;
}): boolean => {
  const date = parseWasteAnnualIsoDate(input.date);
  const first = parseWasteAnnualIsoDate(input.firstDate);
  if (!date || !first || !isWasteAnnualDateInYear(input.date, input.year)) return false;
  const elapsedDays = (date.getTime() - first.getTime()) / 86_400_000;
  return (
    Number.isInteger(elapsedDays) &&
    elapsedDays >= 0 &&
    elapsedDays % input.intervalDays === 0 &&
    (!input.endDate || input.date <= input.endDate)
  );
};

export const mapWasteAnnualCadenceOccurrence = (input: {
  readonly sourceDate: string;
  readonly sourceFirstDate: string;
  readonly sourceEndDate?: string;
  readonly sourceYear: number;
  readonly targetYear: number;
  readonly targetFirstDate: string;
  readonly targetEndDate?: string;
  readonly intervalDays: number;
}): string | null => {
  const sourceCadence = continueWasteAnnualTourCadence({
    sourceFirstDate: input.sourceFirstDate,
    sourceEndDate: input.sourceEndDate,
    sourceYear: input.sourceYear,
    targetYear: input.sourceYear,
    intervalDays: input.intervalDays,
  });
  const sourceDate = parseWasteAnnualIsoDate(input.sourceDate);
  const sourceFirst = parseWasteAnnualIsoDate(sourceCadence?.firstDate ?? '');
  const targetFirst = parseWasteAnnualIsoDate(input.targetFirstDate);
  if (!sourceDate || !sourceFirst || !targetFirst) return null;
  const elapsedDays = (sourceDate.getTime() - sourceFirst.getTime()) / 86_400_000;
  if (!Number.isInteger(elapsedDays) || elapsedDays < 0 || elapsedDays % input.intervalDays !== 0) {
    return null;
  }
  const targetDate = formatWasteAnnualIsoDate(addUtcDays(targetFirst, elapsedDays));
  if (!isWasteAnnualDateInYear(targetDate, input.targetYear)) return null;
  return input.targetEndDate && targetDate > input.targetEndDate ? null : targetDate;
};

export const mapWasteAnnualRelativeDate = (input: {
  readonly sourceOrigin: string;
  readonly sourceDate: string;
  readonly targetOrigin: string;
  readonly targetYear: number;
  readonly replacementDate?: string;
}): string | null => {
  if (input.replacementDate !== undefined) {
    return isWasteAnnualDateInYear(input.replacementDate, input.targetYear)
      ? input.replacementDate
      : null;
  }
  const sourceOrigin = parseWasteAnnualIsoDate(input.sourceOrigin);
  const sourceDate = parseWasteAnnualIsoDate(input.sourceDate);
  const targetOrigin = parseWasteAnnualIsoDate(input.targetOrigin);
  if (!sourceOrigin || !sourceDate || !targetOrigin) return null;
  const elapsedDays = (sourceDate.getTime() - sourceOrigin.getTime()) / 86_400_000;
  if (!Number.isInteger(elapsedDays)) return null;
  const targetDate = formatWasteAnnualIsoDate(addUtcDays(targetOrigin, elapsedDays));
  return isWasteAnnualDateInYear(targetDate, input.targetYear) ? targetDate : null;
};
