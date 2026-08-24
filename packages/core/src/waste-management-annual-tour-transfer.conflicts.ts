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
  effectiveWasteAnnualShiftedDates,
  resolvedWasteAnnualShiftActualDates,
  wasteAnnualDateOccursOnRecurringTour,
  wasteAnnualRecurringSchedulesIntersect,
} from './waste-management-annual-tour-transfer.conflict-dates.js';
import {
  wasteAnnualEndOfYear,
  wasteAnnualYearOf,
} from './waste-management-annual-tour-transfer.dates.js';
import { stableWasteAnnualSerialize } from './waste-management-annual-tour-transfer.identity.js';
import { wasteAnnualIntervalForTour } from './waste-management-annual-tour-transfer.mapping.js';

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
  const mappedDates = effectiveWasteAnnualShiftedDates(
    baseMappedDates,
    mapped.tourDateShifts,
    targetYear
  );
  const indexedDates = effectiveWasteAnnualShiftedDates(
    indexed.effectiveDates,
    indexed.tourDateShifts,
    targetYear
  );
  const interval = wasteAnnualIntervalForTour(mapped.targetTour as WasteTourRecord);
  const mappedShiftDates = resolvedWasteAnnualShiftActualDates(mapped.tourDateShifts, targetYear);
  const indexedShiftDates = resolvedWasteAnnualShiftActualDates(
    indexed.tourDateShifts,
    targetYear
  );
  const matches =
    indexedDates.some((date) => mappedDates.includes(date)) ||
    mappedShiftDates.some((date) =>
      wasteAnnualDateOccursOnRecurringTour(date, tour, interval)
    ) ||
    indexedShiftDates.some((date) =>
      wasteAnnualDateOccursOnRecurringTour(date, mapped.targetTour as WasteTourRecord, interval)
    ) ||
    wasteAnnualRecurringSchedulesIntersect({
      left: mapped.targetTour as WasteTourRecord,
      right: tour,
      intervalDays: interval,
      leftShifts: mapped.tourDateShifts,
      rightShifts: indexed.tourDateShifts,
    });
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
    ...resolvedWasteAnnualShiftActualDates(mapped.tourDateShifts, targetYear)
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
