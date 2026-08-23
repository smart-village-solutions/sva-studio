import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import type {
  WasteAnnualTourTransferMappedTour,
  WasteAnnualTourTransferSource,
} from './waste-management-annual-tour-transfer.contract.js';
import { isWasteAnnualDateInYear } from './waste-management-annual-tour-transfer.dates.js';
import { wasteAnnualRelationshipsFor } from './waste-management-annual-tour-transfer.relationships.js';

export const wasteAnnualConcreteDateExamples = (
  tour: WasteTourRecord,
  sourceYear: number,
  source: WasteAnnualTourTransferSource,
  mapped: WasteAnnualTourTransferMappedTour
): readonly Readonly<{ sourceDate: string; targetDate: string }>[] => {
  const customDates = (tour.customDates ?? []).filter((item) =>
    isWasteAnnualDateInYear(item.date, sourceYear)
  );
  const pickupDates = wasteAnnualRelationshipsFor(source.locationTourPickupDates, tour.id).filter(
    (item) => isWasteAnnualDateInYear(item.pickupDate, sourceYear)
  );
  const assignments = wasteAnnualRelationshipsFor(source.tourAssignments, tour.id).filter((item) =>
    isWasteAnnualDateInYear(item.pickupDate, sourceYear)
  );
  return [
    ...customDates.map((item, index) => ({
      sourceDate: item.date,
      targetDate: mapped.targetTour.customDates?.[index]?.date,
    })),
    ...pickupDates.map((item, index) => ({
      sourceDate: item.pickupDate,
      targetDate: mapped.locationTourPickupDates[index]?.pickupDate,
    })),
    ...assignments.map((item, index) => ({
      sourceDate: item.pickupDate,
      targetDate: mapped.tourAssignments[index]?.pickupDate,
    })),
  ]
    .filter(
      (item): item is Readonly<{ sourceDate: string; targetDate: string }> =>
        item.targetDate !== undefined
    )
    .slice(0, 5);
};

export const countWasteAnnualMappedRelationships = (
  item: import('./waste-management-annual-tour-transfer.internal.js').WasteAnnualTourTransferInternalTourPreview
): number => {
  const mapped = item.mappedTour;
  return mapped
    ? mapped.targetTour.wasteFractionIds.length +
        (mapped.targetTour.customDates?.length ?? 0) +
        mapped.locationTourLinks.length +
        mapped.locationTourPickupDates.length +
        mapped.tourAssignments.length +
        mapped.tourDateShifts.length
    : 0;
};
