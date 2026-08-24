import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import type {
  WasteAnnualTourTransferConflict,
  WasteAnnualTourTransferMappedTour,
} from './waste-management-annual-tour-transfer.contract.js';
import {
  wasteAnnualPlanningSignature,
  type IndexedWasteAnnualTargetTour,
  type WasteAnnualTourConflictIndex,
} from './waste-management-annual-tour-transfer.conflict-index.js';
import {
  parseWasteAnnualIsoDate,
  replaceWasteAnnualYear,
  wasteAnnualEndOfYear,
  wasteAnnualYearOf,
} from './waste-management-annual-tour-transfer.dates.js';
import { stableWasteAnnualSerialize } from './waste-management-annual-tour-transfer.identity.js';
import { wasteAnnualIntervalForTour } from './waste-management-annual-tour-transfer.mapping.js';
import { resolveEffectiveWasteTourDateShiftsForYear } from './waste-management/master-data-tour-date-shifts.js';

export const sortWasteAnnualItems = <T>(
  items: readonly T[],
  key: (item: T) => string
): readonly T[] => [...items].sort((left, right) => key(left).localeCompare(key(right)));

export const wasteAnnualTourOverlapsYear = (tour: WasteTourRecord, year: number): boolean => {
  if (!tour.firstDate && !tour.endDate) return false;
  return (
    (tour.firstDate ?? `${year}-01-01`) <= wasteAnnualEndOfYear(year) &&
    (tour.endDate ?? wasteAnnualEndOfYear(year)) >= `${year}-01-01`
  );
};

export const wasteAnnualEffectiveDates = (
  mapped: WasteAnnualTourTransferMappedTour
): readonly string[] => [
  ...(mapped.targetTour.firstDate ? [mapped.targetTour.firstDate] : []),
  ...(mapped.targetTour.customDates ?? []).map((item) => item.date),
  ...mapped.locationTourPickupDates.map((item) => item.pickupDate),
  ...mapped.tourAssignments.map((item) => item.pickupDate),
];

const resolvedShifts = (
  shifts: WasteAnnualTourTransferMappedTour['tourDateShifts'],
  year: number
) => resolveEffectiveWasteTourDateShiftsForYear(shifts, year);

const resolvedShiftActualDates = (
  shifts: WasteAnnualTourTransferMappedTour['tourDateShifts'],
  year: number
): readonly string[] => resolvedShifts(shifts, year).map((shift) => shift.actualDate);

const effectiveShiftedDates = (
  baseDates: readonly string[],
  shifts: WasteAnnualTourTransferMappedTour['tourDateShifts'],
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

const yearlySchedulesIntersect = (
  left: WasteAnnualTourTransferMappedTour['targetTour'],
  right: WasteTourRecord
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
    rightOccurrence <= (right.endDate ?? targetYearEnd)
  );
};

const recurringSchedulesIntersect = (
  left: WasteAnnualTourTransferMappedTour['targetTour'],
  right: WasteTourRecord,
  intervalDays: number | null
): boolean => {
  if (left.recurrence === 'yearly' && right.recurrence === 'yearly')
    return yearlySchedulesIntersect(left, right);
  if (intervalDays === null || !left.firstDate || !right.firstDate) return false;
  const leftFirst = parseWasteAnnualIsoDate(left.firstDate);
  const rightFirst = parseWasteAnnualIsoDate(right.firstDate);
  if (!leftFirst || !rightFirst) return false;
  const phaseDifferenceDays = Math.abs(leftFirst.getTime() - rightFirst.getTime()) / 86_400_000;
  if (phaseDifferenceDays % intervalDays !== 0) return false;
  const targetYear = leftFirst.getUTCFullYear();
  const overlapStart = left.firstDate >= right.firstDate ? left.firstDate : right.firstDate;
  const leftEnd = left.endDate ?? wasteAnnualEndOfYear(targetYear);
  const rightEnd = right.endDate ?? wasteAnnualEndOfYear(targetYear);
  return overlapStart <= (leftEnd <= rightEnd ? leftEnd : rightEnd);
};

const comparableMappedTour = (mapped: WasteAnnualTourTransferMappedTour): unknown => ({
  tour: mapped.targetTour,
  locationTourLinks: sortWasteAnnualItems(mapped.locationTourLinks, (item) => item.id).map(
    ({ id, locationId, tourId }) => ({ id, locationId, tourId })
  ),
  pickupDates: sortWasteAnnualItems(mapped.locationTourPickupDates, (item) => item.id).map(
    ({ id, locationId, tourId, pickupDate, note }) => ({
      id,
      locationId,
      tourId,
      pickupDate,
      note,
    })
  ),
  assignments: sortWasteAnnualItems(mapped.tourAssignments, (item) => item.id).map(
    ({ id, tourId, pickupDate, note, locationIds }) => ({
      id,
      tourId,
      pickupDate,
      note,
      locationIds,
    })
  ),
  shifts: sortWasteAnnualItems(mapped.tourDateShifts, (item) => item.id).map(
    ({
      id,
      tourId,
      originalDate,
      actualDate,
      hasYear,
      reasonType,
      reasonKey,
      followUpMode,
      description,
    }) => ({
      id,
      tourId,
      originalDate,
      actualDate,
      hasYear,
      reasonType,
      reasonKey,
      followUpMode,
      description,
    })
  ),
});

const comparableExistingTour = (indexed: IndexedWasteAnnualTargetTour) =>
  comparableMappedTour({
    sourceTourId: indexed.tour.id,
    targetTour: {
      id: indexed.tour.id,
      name: indexed.tour.name,
      description: indexed.tour.description,
      wasteFractionIds: indexed.tour.wasteFractionIds,
      recurrence: indexed.tour.recurrence,
      customRecurrenceId: indexed.tour.customRecurrenceId,
      customRecurrenceName: indexed.tour.customRecurrenceName,
      customRecurrenceIntervalDays: indexed.tour.customRecurrenceIntervalDays,
      firstDate: indexed.tour.firstDate,
      endDate: indexed.tour.endDate,
      customDates: indexed.tour.customDates,
      active: indexed.tour.active,
      locationCount: indexed.tour.locationCount,
    },
    locationTourLinks: indexed.locationTourLinks,
    locationTourPickupDates: indexed.locationTourPickupDates,
    tourAssignments: indexed.tourAssignments,
    tourDateShifts: indexed.tourDateShifts,
  });

const parallelPlanningConflict = (
  sourceTourId: string,
  mapped: WasteAnnualTourTransferMappedTour,
  indexed: IndexedWasteAnnualTargetTour
): WasteAnnualTourTransferConflict | null => {
  const { tour } = indexed;
  const baseMappedDates = wasteAnnualEffectiveDates(mapped);
  const targetYear = wasteAnnualYearOf(baseMappedDates[0] ?? mapped.targetTour.firstDate ?? '');
  if (targetYear === null) return null;
  const mappedDates = effectiveShiftedDates(baseMappedDates, mapped.tourDateShifts, targetYear);
  const indexedDates = effectiveShiftedDates(
    indexed.effectiveDates,
    indexed.tourDateShifts,
    targetYear
  );
  const interval = wasteAnnualIntervalForTour(mapped.targetTour as WasteTourRecord);
  const matches =
    indexedDates.some((date) => mappedDates.includes(date)) ||
    recurringSchedulesIntersect(mapped.targetTour, tour, interval);
  return matches
    ? {
        kind: 'possible-parallel-planning',
        sourceTourId,
        targetTourId: tour.id,
        matchingFeatures: ['waste-fractions', 'locations', 'cadence', 'date'],
      }
    : null;
};

const tourHasEffectiveDateInYear = (indexed: IndexedWasteAnnualTargetTour, year: number): boolean =>
  wasteAnnualTourOverlapsYear(indexed.tour, year) ||
  indexed.effectiveDates.some((date) => wasteAnnualYearOf(date) === year) ||
  indexed.tourDateShifts.some(
    (shift) => shift.hasYear && wasteAnnualYearOf(shift.actualDate) === year
  );

export const findWasteAnnualTourConflicts = (
  sourceTourId: string,
  mapped: WasteAnnualTourTransferMappedTour,
  index: WasteAnnualTourConflictIndex
): readonly WasteAnnualTourTransferConflict[] => {
  const stableTarget = index.byId.get(mapped.targetTour.id);
  if (
    stableTarget &&
    stableWasteAnnualSerialize(comparableExistingTour(stableTarget)) !==
      stableWasteAnnualSerialize(comparableMappedTour(mapped))
  ) {
    return [
      {
        kind: 'target-identity-conflict',
        sourceTourId,
        targetTourId: stableTarget.tour.id,
        matchingFeatures: ['stable-target-id'],
      },
    ];
  }
  const targetYear = wasteAnnualYearOf(wasteAnnualEffectiveDates(mapped)[0] ?? '') ?? 0;
  const conflictYears = new Set([
    targetYear,
    ...resolvedShiftActualDates(mapped.tourDateShifts, targetYear)
      .map((date) => wasteAnnualYearOf(date))
      .filter((year): year is number => year !== null),
  ]);
  const signature = wasteAnnualPlanningSignature(
    mapped.targetTour.wasteFractionIds,
    mapped.locationTourLinks.map((item) => item.locationId),
    mapped.targetTour as WasteTourRecord
  );
  return (index.bySignature.get(signature) ?? [])
    .filter(
      (indexed) =>
        indexed.tour.id !== mapped.targetTour.id &&
        [...conflictYears].some((year) => tourHasEffectiveDateInYear(indexed, year))
    )
    .map((indexed) => parallelPlanningConflict(sourceTourId, mapped, indexed))
    .filter((conflict): conflict is WasteAnnualTourTransferConflict => conflict !== null);
};
