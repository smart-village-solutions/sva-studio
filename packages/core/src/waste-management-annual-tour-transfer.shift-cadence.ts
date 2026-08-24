import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import {
  continueWasteAnnualTourCadence,
  formatWasteAnnualIsoDate,
  isWasteAnnualDateInYear,
  parseWasteAnnualIsoDate,
  replaceWasteAnnualYear,
  wasteAnnualYearOf,
} from './waste-management-annual-tour-transfer.dates.js';
import type { WasteAnnualTourTransferSource } from './waste-management-annual-tour-transfer.contract.js';

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

const isWasteAnnualCadenceOccurrence = (input: {
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

const mapWasteAnnualCadenceOccurrence = (input: {
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

const mapWasteAnnualRelativeDate = (input: {
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

type Shift = WasteAnnualTourTransferSource['tourDateShifts'][number];

const mapIntervalShiftOrigin = (input: {
  readonly source: Shift;
  readonly tour: WasteTourRecord;
  readonly sourceYear: number;
  readonly targetYear: number;
  readonly targetFirstDate: string;
  readonly targetEndDate?: string;
  readonly intervalDays: number;
  readonly replacementDate?: string;
}): string | null | undefined => {
  if (!input.tour.firstDate) return undefined;
  const mappedOccurrence = mapWasteAnnualCadenceOccurrence({
    sourceDate: input.source.originalDate,
    sourceFirstDate: input.tour.firstDate,
    sourceEndDate: input.tour.endDate,
    sourceYear: input.sourceYear,
    targetYear: input.targetYear,
    targetFirstDate: input.targetFirstDate,
    targetEndDate: input.targetEndDate,
    intervalDays: input.intervalDays,
  });
  if (!mappedOccurrence) return undefined;
  if (input.replacementDate === undefined) return mappedOccurrence;
  return isWasteAnnualCadenceOccurrence({
    date: input.replacementDate,
    firstDate: input.targetFirstDate,
    endDate: input.targetEndDate,
    year: input.targetYear,
    intervalDays: input.intervalDays,
  })
    ? input.replacementDate
    : null;
};

const mapYearlyShiftOrigin = (input: {
  readonly source: Shift;
  readonly tour: WasteTourRecord;
  readonly sourceYear: number;
  readonly targetYear: number;
  readonly targetFirstDate: string;
  readonly replacementDate?: string;
}): string | null | undefined => {
  if (input.tour.recurrence !== 'yearly' || !input.tour.firstDate) return undefined;
  const sourceOccurrence = replaceWasteAnnualYear(input.tour.firstDate, input.sourceYear);
  if (
    !sourceOccurrence ||
    sourceOccurrence !== input.source.originalDate ||
    (input.tour.endDate && sourceOccurrence > input.tour.endDate)
  ) {
    return undefined;
  }
  if (input.replacementDate === undefined) return input.targetFirstDate;
  return input.replacementDate === input.targetFirstDate &&
    isWasteAnnualDateInYear(input.replacementDate, input.targetYear)
    ? input.replacementDate
    : null;
};

export const mapWasteAnnualRecurringShiftDates = (input: {
  readonly source: Shift;
  readonly tour: WasteTourRecord;
  readonly sourceYear: number;
  readonly targetYear: number;
  readonly targetFirstDate?: string;
  readonly targetEndDate?: string;
  readonly replacements: ReadonlyMap<string, string>;
}): Readonly<{ originalDate: string | null; actualDate: string | null }> | undefined => {
  if (!input.targetFirstDate) return undefined;
  const originalResourceId = `${input.source.id}:original`;
  const originalReplacement = input.replacements.get(originalResourceId);
  const intervalDays = wasteAnnualIntervalForTour(input.tour);
  const originalDate =
    intervalDays === null
      ? mapYearlyShiftOrigin({
          ...input,
          targetFirstDate: input.targetFirstDate,
          replacementDate: originalReplacement,
        })
      : mapIntervalShiftOrigin({
          ...input,
          targetFirstDate: input.targetFirstDate,
          intervalDays,
          replacementDate: originalReplacement,
        });
  if (originalDate === undefined) return undefined;
  if (originalDate === null) return { originalDate: null, actualDate: null };
  const actualYear =
    input.targetYear +
    ((wasteAnnualYearOf(input.source.actualDate) ?? input.sourceYear) - input.sourceYear);
  return {
    originalDate,
    actualDate: mapWasteAnnualRelativeDate({
      sourceOrigin: input.source.originalDate,
      sourceDate: input.source.actualDate,
      targetOrigin: originalDate,
      targetYear: actualYear,
      replacementDate: input.replacements.get(`${input.source.id}:actual`),
    }),
  };
};
