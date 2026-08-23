import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import type { WasteAnnualTourTransferSource } from './waste-management-annual-tour-transfer.contract.js';
import { wasteAnnualTourOverlapsYear } from './waste-management-annual-tour-transfer.conflicts.js';
import { isWasteAnnualDateInYear } from './waste-management-annual-tour-transfer.dates.js';
import { wasteAnnualIntervalForTour } from './waste-management-annual-tour-transfer.mapping.js';
import { wasteAnnualRelationshipsFor } from './waste-management-annual-tour-transfer.relationships.js';

export const isWasteAnnualTourRelevant = (
  tour: WasteTourRecord,
  year: number,
  source: WasteAnnualTourTransferSource
): boolean =>
  tour.active &&
  (wasteAnnualTourOverlapsYear(tour, year) ||
    (tour.customDates ?? []).some((item) => isWasteAnnualDateInYear(item.date, year)) ||
    wasteAnnualRelationshipsFor(source.locationTourPickupDates, tour.id).some((item) =>
      isWasteAnnualDateInYear(item.pickupDate, year)
    ) ||
    wasteAnnualRelationshipsFor(source.tourAssignments, tour.id).some((item) =>
      isWasteAnnualDateInYear(item.pickupDate, year)
    ));

export const wasteAnnualTourRelationshipCounts = (
  tour: WasteTourRecord,
  sourceYear: number,
  source: WasteAnnualTourTransferSource
) => ({
  wasteFractions: tour.wasteFractionIds.length,
  customDates: (tour.customDates ?? []).filter((item) =>
    isWasteAnnualDateInYear(item.date, sourceYear)
  ).length,
  locations: wasteAnnualRelationshipsFor(source.locationTourLinks, tour.id).length,
  pickupDates: wasteAnnualRelationshipsFor(source.locationTourPickupDates, tour.id).filter((item) =>
    isWasteAnnualDateInYear(item.pickupDate, sourceYear)
  ).length,
  assignments: wasteAnnualRelationshipsFor(source.tourAssignments, tour.id).filter((item) =>
    isWasteAnnualDateInYear(item.pickupDate, sourceYear)
  ).length,
  shifts: wasteAnnualRelationshipsFor(source.tourDateShifts, tour.id).filter(
    (item) => !item.hasYear || isWasteAnnualDateInYear(item.originalDate, sourceYear)
  ).length,
  excluded: 0,
});

export const isWasteAnnualTourAlreadyEffective = (
  tour: WasteTourRecord,
  targetYear: number,
  source: WasteAnnualTourTransferSource
): boolean =>
  wasteAnnualTourOverlapsYear(tour, targetYear) ||
  (tour.customDates ?? []).some((item) => isWasteAnnualDateInYear(item.date, targetYear)) ||
  wasteAnnualRelationshipsFor(source.locationTourPickupDates, tour.id).some((item) =>
    isWasteAnnualDateInYear(item.pickupDate, targetYear)
  ) ||
  wasteAnnualRelationshipsFor(source.tourAssignments, tour.id).some((item) =>
    isWasteAnnualDateInYear(item.pickupDate, targetYear)
  );

export const wasteAnnualTourHasMissingCadenceAnchor = (tour: WasteTourRecord): boolean =>
  !tour.firstDate && (tour.recurrence === 'yearly' || wasteAnnualIntervalForTour(tour) !== null);
