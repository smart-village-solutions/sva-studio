import type { WasteAnnualTourTransferSource } from './waste-management-annual-tour-transfer.contract.js';
import { stableWasteAnnualSerialize } from './waste-management-annual-tour-transfer.identity.js';
import { wasteAnnualIntervalForTour } from './waste-management-annual-tour-transfer.mapping.js';
import type { WasteTourRecord } from './waste-management/master-data-tours.js';

export type IndexedWasteAnnualTargetTour = Readonly<{
  tour: WasteTourRecord;
  locationTourLinks: WasteAnnualTourTransferSource['locationTourLinks'];
  locationTourPickupDates: WasteAnnualTourTransferSource['locationTourPickupDates'];
  tourAssignments: WasteAnnualTourTransferSource['tourAssignments'];
  tourDateShifts: WasteAnnualTourTransferSource['tourDateShifts'];
  effectiveDates: readonly string[];
  signature: string;
}>;

export type WasteAnnualTourConflictIndex = Readonly<{
  byId: ReadonlyMap<string, IndexedWasteAnnualTargetTour>;
  bySignature: ReadonlyMap<string, readonly IndexedWasteAnnualTargetTour[]>;
}>;

export const wasteAnnualPlanningSignature = (
  wasteFractionIds: readonly string[],
  locations: readonly string[],
  intervalDays: number | null
): string =>
  stableWasteAnnualSerialize({
    wasteFractionIds: [...new Set(wasteFractionIds)].sort(),
    locations: [...new Set(locations)].sort(),
    intervalDays,
  });

const relationshipsByTour = <T extends { readonly tourId: string }>(
  items: readonly T[]
): ReadonlyMap<string, readonly T[]> => {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const current = grouped.get(item.tourId);
    if (current) current.push(item);
    else grouped.set(item.tourId, [item]);
  }
  return grouped;
};

export const createWasteAnnualTourConflictIndex = (
  target: WasteAnnualTourTransferSource
): WasteAnnualTourConflictIndex => {
  const links = relationshipsByTour(target.locationTourLinks);
  const pickupDates = relationshipsByTour(target.locationTourPickupDates);
  const assignments = relationshipsByTour(target.tourAssignments);
  const shifts = relationshipsByTour(target.tourDateShifts);
  const byId = new Map<string, IndexedWasteAnnualTargetTour>();
  const bySignature = new Map<string, IndexedWasteAnnualTargetTour[]>();
  for (const tour of target.tours) {
    const locationTourLinks = links.get(tour.id) ?? [];
    const locationTourPickupDates = pickupDates.get(tour.id) ?? [];
    const tourAssignments = assignments.get(tour.id) ?? [];
    const locations = locationTourLinks.map((item) => item.locationId);
    const indexed = {
      tour,
      locationTourLinks,
      locationTourPickupDates,
      tourAssignments,
      tourDateShifts: shifts.get(tour.id) ?? [],
      effectiveDates: [
        ...(tour.firstDate ? [tour.firstDate] : []),
        ...(tour.customDates ?? []).map((item) => item.date),
        ...locationTourPickupDates.map((item) => item.pickupDate),
        ...tourAssignments.map((item) => item.pickupDate),
      ],
      signature: wasteAnnualPlanningSignature(
        tour.wasteFractionIds,
        locations,
        wasteAnnualIntervalForTour(tour)
      ),
    } satisfies IndexedWasteAnnualTargetTour;
    byId.set(tour.id, indexed);
    const candidates = bySignature.get(indexed.signature);
    if (candidates) candidates.push(indexed);
    else bySignature.set(indexed.signature, [indexed]);
  }
  return { byId, bySignature };
};
