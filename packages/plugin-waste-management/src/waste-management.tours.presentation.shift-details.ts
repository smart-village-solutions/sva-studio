import type { WasteManagementSchedulingOverview, WasteTourRecord } from './waste-management.api.js';
import { calculateTourOccurrenceEntriesForYearInternal } from './waste-management.tours.presentation.calendar.js';
import { normalizeDateOnly } from './waste-management.tours.presentation.holidays.js';

type ManualTourShift = WasteManagementSchedulingOverview['tourDateShifts'][number];
type GlobalTourShift = WasteManagementSchedulingOverview['globalDateShifts'][number];

export type TourShiftDetail =
  | Readonly<{
      id: string;
      source: 'tour' | 'global';
      originalDate: string;
      actualDate: string;
      reasonType: ManualTourShift['reasonType'] | GlobalTourShift['reasonType'];
      reasonKey: string | undefined;
      description: string | undefined;
    }>
  | Readonly<{
      id: string;
      source: 'holiday';
      originalDate: string;
      actualDate: string;
      holidayNames: readonly string[];
    }>;

const resolveHolidayShiftDetails = (
  tour: WasteTourRecord,
  scheduling: WasteManagementSchedulingOverview
): readonly TourShiftDetail[] => {
  const holidayYears = Array.from(
    new Set(
      (scheduling.holidayRules ?? [])
        .map((rule) => normalizeDateOnly(rule.holidayDate))
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
        .map((value) => Number(value.slice(0, 4)))
        .filter((value) => Number.isInteger(value))
    )
  );

  return holidayYears.flatMap((year) =>
    calculateTourOccurrenceEntriesForYearInternal(tour, year, scheduling)
      .filter(
        (entry): entry is typeof entry & { readonly originalDate: string } =>
          entry.shiftedByHoliday && entry.originalDate !== null
      )
      .map((entry) => ({
        id: `holiday:${entry.originalDate}:${entry.date}`,
        source: 'holiday' as const,
        originalDate: entry.originalDate,
        actualDate: entry.date,
        holidayNames: entry.holidayNames,
      }))
  );
};

export const resolveTourShiftDetails = (
  tour: WasteTourRecord,
  scheduling: WasteManagementSchedulingOverview | null
): readonly TourShiftDetail[] => {
  if (!scheduling) {
    return [];
  }

  const tourShifts: readonly TourShiftDetail[] = (scheduling.tourDateShifts ?? [])
    .filter((shift) => shift.tourId === tour.id)
    .map((shift) => ({
      id: shift.id,
      source: 'tour',
      originalDate: shift.originalDate,
      actualDate: shift.actualDate,
      reasonType: shift.reasonType,
      reasonKey: shift.reasonKey,
      description: shift.description,
    }));
  const globalShifts: readonly TourShiftDetail[] = (scheduling.globalDateShifts ?? [])
    .filter(
      (shift) =>
        shift.tourIds == null || shift.tourIds.length === 0 || shift.tourIds.includes(tour.id)
    )
    .map((shift) => ({
      id: shift.id,
      source: 'global',
      originalDate: shift.originalDate,
      actualDate: shift.actualDate,
      reasonType: shift.reasonType,
      reasonKey: shift.reasonKey,
      description: shift.description,
    }));

  return [...tourShifts, ...globalShifts, ...resolveHolidayShiftDetails(tour, scheduling)].sort(
    (left, right) =>
      left.originalDate.localeCompare(right.originalDate) ||
      left.actualDate.localeCompare(right.actualDate)
  );
};
