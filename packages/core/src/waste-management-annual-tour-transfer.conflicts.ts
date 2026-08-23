import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import type {
  WasteAnnualTourTransferConflict,
  WasteAnnualTourTransferMappedTour,
  WasteAnnualTourTransferSource,
} from './waste-management-annual-tour-transfer.contract.js';
import {
  parseWasteAnnualIsoDate,
  replaceWasteAnnualYear,
  wasteAnnualEndOfYear,
  wasteAnnualYearOf,
} from './waste-management-annual-tour-transfer.dates.js';
import { stableWasteAnnualSerialize } from './waste-management-annual-tour-transfer.identity.js';
import { wasteAnnualIntervalForTour } from './waste-management-annual-tour-transfer.mapping.js';
import { wasteAnnualRelationshipsFor } from './waste-management-annual-tour-transfer.relationships.js';

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

const sameSet = (left: readonly string[], right: readonly string[]): boolean =>
  JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());

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
  locations: sortWasteAnnualItems(mapped.locationTourLinks, (item) => item.locationId).map(
    (item) => item.locationId
  ),
  pickupDates: sortWasteAnnualItems(mapped.locationTourPickupDates, (item) => item.id).map(
    ({ locationId, pickupDate, note }) => ({ locationId, pickupDate, note })
  ),
  assignments: sortWasteAnnualItems(mapped.tourAssignments, (item) => item.id).map(
    ({ pickupDate, note, locationIds }) => ({
      pickupDate,
      note,
      locationIds: [...locationIds].sort(),
    })
  ),
  shifts: sortWasteAnnualItems(mapped.tourDateShifts, (item) => item.id).map(
    ({ originalDate, actualDate, hasYear, reasonType, reasonKey, followUpMode, description }) => ({
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

const comparableExistingTour = (tour: WasteTourRecord, source: WasteAnnualTourTransferSource) =>
  comparableMappedTour({
    sourceTourId: tour.id,
    targetTour: {
      id: tour.id,
      name: tour.name,
      description: tour.description,
      wasteFractionIds: tour.wasteFractionIds,
      recurrence: tour.recurrence,
      customRecurrenceId: tour.customRecurrenceId,
      customRecurrenceName: tour.customRecurrenceName,
      customRecurrenceIntervalDays: tour.customRecurrenceIntervalDays,
      firstDate: tour.firstDate,
      endDate: tour.endDate,
      customDates: tour.customDates,
      active: tour.active,
      locationCount: tour.locationCount,
    },
    locationTourLinks: wasteAnnualRelationshipsFor(source.locationTourLinks, tour.id),
    locationTourPickupDates: wasteAnnualRelationshipsFor(source.locationTourPickupDates, tour.id),
    tourAssignments: wasteAnnualRelationshipsFor(source.tourAssignments, tour.id),
    tourDateShifts: wasteAnnualRelationshipsFor(source.tourDateShifts, tour.id),
  });

const parallelPlanningConflict = (
  sourceTourId: string,
  mapped: WasteAnnualTourTransferMappedTour,
  tour: WasteTourRecord,
  target: WasteAnnualTourTransferSource
): WasteAnnualTourTransferConflict | null => {
  const locations = wasteAnnualRelationshipsFor(target.locationTourLinks, tour.id).map(
    (item) => item.locationId
  );
  const targetDates = [
    ...(tour.firstDate ? [tour.firstDate] : []),
    ...(tour.customDates ?? []).map((item) => item.date),
    ...wasteAnnualRelationshipsFor(target.locationTourPickupDates, tour.id).map(
      (item) => item.pickupDate
    ),
    ...wasteAnnualRelationshipsFor(target.tourAssignments, tour.id).map((item) => item.pickupDate),
  ];
  const mappedDates = wasteAnnualEffectiveDates(mapped);
  const interval = wasteAnnualIntervalForTour(mapped.targetTour as WasteTourRecord);
  const matches =
    sameSet(tour.wasteFractionIds, mapped.targetTour.wasteFractionIds) &&
    sameSet(
      locations,
      mapped.locationTourLinks.map((item) => item.locationId)
    ) &&
    wasteAnnualIntervalForTour(tour) === interval &&
    (targetDates.some((date) => mappedDates.includes(date)) ||
      recurringSchedulesIntersect(mapped.targetTour, tour, interval));
  return matches
    ? {
        kind: 'possible-parallel-planning',
        sourceTourId,
        targetTourId: tour.id,
        matchingFeatures: ['waste-fractions', 'locations', 'cadence', 'date'],
      }
    : null;
};

const tourHasEffectiveDateInYear = (
  tour: WasteTourRecord,
  year: number,
  target: WasteAnnualTourTransferSource
): boolean =>
  wasteAnnualTourOverlapsYear(tour, year) ||
  (tour.customDates ?? []).some((item) => wasteAnnualYearOf(item.date) === year) ||
  wasteAnnualRelationshipsFor(target.locationTourPickupDates, tour.id).some(
    (item) => wasteAnnualYearOf(item.pickupDate) === year
  ) ||
  wasteAnnualRelationshipsFor(target.tourAssignments, tour.id).some(
    (item) => wasteAnnualYearOf(item.pickupDate) === year
  );

export const findWasteAnnualTourConflicts = (
  sourceTourId: string,
  mapped: WasteAnnualTourTransferMappedTour,
  target: WasteAnnualTourTransferSource
): readonly WasteAnnualTourTransferConflict[] => {
  const stableTarget = target.tours.find((tour) => tour.id === mapped.targetTour.id);
  if (
    stableTarget &&
    stableWasteAnnualSerialize(comparableExistingTour(stableTarget, target)) !==
      stableWasteAnnualSerialize(comparableMappedTour(mapped))
  ) {
    return [
      {
        kind: 'target-identity-conflict',
        sourceTourId,
        targetTourId: stableTarget.id,
        matchingFeatures: ['stable-target-id'],
      },
    ];
  }
  const targetYear = wasteAnnualYearOf(wasteAnnualEffectiveDates(mapped)[0] ?? '') ?? 0;
  return target.tours
    .filter(
      (tour) =>
        tour.id !== mapped.targetTour.id && tourHasEffectiveDateInYear(tour, targetYear, target)
    )
    .map((tour) => parallelPlanningConflict(sourceTourId, mapped, tour, target))
    .filter((conflict): conflict is WasteAnnualTourTransferConflict => conflict !== null);
};
