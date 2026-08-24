import type { WasteAnnualTourTransferMappedTour } from './waste-management-annual-tour-transfer.contract.js';
import {
  formatWasteAnnualIsoDate,
  parseWasteAnnualIsoDate,
  replaceWasteAnnualYear,
  wasteAnnualEndOfYear,
  wasteAnnualYearOf,
} from './waste-management-annual-tour-transfer.dates.js';
import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import { resolveEffectiveWasteTourDateShiftsForYear } from './waste-management/master-data-tour-date-shifts.js';

type MappedShifts = WasteAnnualTourTransferMappedTour['tourDateShifts'];

const resolvedShifts = (shifts: MappedShifts, year: number) =>
  resolveEffectiveWasteTourDateShiftsForYear(shifts, year);

export const resolvedWasteAnnualShiftActualDates = (
  shifts: MappedShifts,
  year: number
): readonly string[] => resolvedShifts(shifts, year).map((shift) => shift.actualDate);

export const effectiveWasteAnnualShiftedDates = (
  baseDates: readonly string[],
  shifts: MappedShifts,
  year: number
): readonly string[] => {
  const effectiveShifts = resolvedShifts(shifts, year);
  const shiftedOrigins = new Set(effectiveShifts.map((shift) => shift.originalDate));
  return [
    ...new Set([
      ...baseDates.filter((date) => !shiftedOrigins.has(date)),
      ...effectiveShifts.map((shift) => shift.actualDate),
    ]),
  ];
};

const shiftedOriginsFor = (shifts: MappedShifts, year: number) =>
  new Set(resolvedShifts(shifts, year).map((shift) => shift.originalDate));

const yearlySchedulesIntersect = (
  left: WasteTourRecord,
  right: WasteTourRecord,
  leftShifts: MappedShifts,
  rightShifts: MappedShifts
): boolean => {
  if (!left.firstDate || !right.firstDate) return false;
  const targetYear = wasteAnnualYearOf(left.firstDate);
  if (targetYear === null) return false;
  const leftOccurrence = replaceWasteAnnualYear(left.firstDate, targetYear);
  const rightOccurrence = replaceWasteAnnualYear(right.firstDate, targetYear);
  if (!leftOccurrence || leftOccurrence !== rightOccurrence) return false;
  const targetYearEnd = wasteAnnualEndOfYear(targetYear);
  return (
    leftOccurrence >= left.firstDate &&
    leftOccurrence <= (left.endDate ?? targetYearEnd) &&
    rightOccurrence >= right.firstDate &&
    rightOccurrence <= (right.endDate ?? targetYearEnd) &&
    !shiftedOriginsFor(leftShifts, targetYear).has(leftOccurrence) &&
    !shiftedOriginsFor(rightShifts, targetYear).has(rightOccurrence)
  );
};

export const wasteAnnualDateOccursOnRecurringTour = (
  date: string,
  tour: WasteTourRecord,
  intervalDays: number | null
): boolean => {
  if (intervalDays === null || !tour.firstDate) return false;
  const occurrence = parseWasteAnnualIsoDate(date);
  const first = parseWasteAnnualIsoDate(tour.firstDate);
  if (!occurrence || !first || date < tour.firstDate || (tour.endDate && date > tour.endDate))
    return false;
  const elapsedDays = (occurrence.getTime() - first.getTime()) / 86_400_000;
  return Number.isInteger(elapsedDays) && elapsedDays % intervalDays === 0;
};

export const wasteAnnualDateOccursOnEffectiveRecurringTour = (
  date: string,
  tour: WasteTourRecord,
  intervalDays: number | null,
  shifts: MappedShifts,
  year: number
): boolean =>
  wasteAnnualDateOccursOnRecurringTour(date, tour, intervalDays) &&
  !shiftedOriginsFor(shifts, year).has(date);

const recurringOverlap = (input: {
  left: WasteTourRecord;
  right: WasteTourRecord;
  intervalDays: number | null;
}) => {
  if (input.intervalDays === null || !input.left.firstDate || !input.right.firstDate) return null;
  const targetYear = wasteAnnualYearOf(input.left.firstDate);
  if (targetYear === null) return null;
  const start = input.left.firstDate >= input.right.firstDate
    ? input.left.firstDate
    : input.right.firstDate;
  const leftEnd = input.left.endDate ?? wasteAnnualEndOfYear(targetYear);
  const rightEnd = input.right.endDate ?? wasteAnnualEndOfYear(targetYear);
  const end = leftEnd <= rightEnd ? leftEnd : rightEnd;
  return start <= end ? { start, end, targetYear } : null;
};

const hasUnshiftedSharedOccurrence = (input: {
  left: WasteTourRecord;
  right: WasteTourRecord;
  intervalDays: number;
  start: string;
  end: string;
  leftOrigins: ReadonlySet<string>;
  rightOrigins: ReadonlySet<string>;
}): boolean => {
  const start = parseWasteAnnualIsoDate(input.start);
  if (!start) return false;
  for (let date = start; formatWasteAnnualIsoDate(date) <= input.end; ) {
    const value = formatWasteAnnualIsoDate(date);
    const shared =
      wasteAnnualDateOccursOnRecurringTour(value, input.left, input.intervalDays) &&
      wasteAnnualDateOccursOnRecurringTour(value, input.right, input.intervalDays);
    if (shared && !input.leftOrigins.has(value) && !input.rightOrigins.has(value)) return true;
    date = new Date(date.getTime() + input.intervalDays * 86_400_000);
  }
  return false;
};

export const wasteAnnualRecurringSchedulesIntersect = (input: {
  left: WasteTourRecord;
  right: WasteTourRecord;
  intervalDays: number | null;
  leftShifts: MappedShifts;
  rightShifts: MappedShifts;
}): boolean => {
  if (input.left.recurrence === 'yearly' && input.right.recurrence === 'yearly') {
    return yearlySchedulesIntersect(input.left, input.right, input.leftShifts, input.rightShifts);
  }
  const overlap = recurringOverlap(input);
  if (!overlap || input.intervalDays === null) return false;
  return hasUnshiftedSharedOccurrence({
    left: input.left,
    right: input.right,
    intervalDays: input.intervalDays,
    start: overlap.start,
    end: overlap.end,
    leftOrigins: shiftedOriginsFor(input.leftShifts, overlap.targetYear),
    rightOrigins: shiftedOriginsFor(input.rightShifts, overlap.targetYear),
  });
};
