import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import type {
  WasteAnnualTourTransferMappedTour,
  WasteAnnualTourTransferSource,
} from './waste-management-annual-tour-transfer.contract.js';
import {
  continueWasteAnnualTourCadence,
  replaceWasteAnnualYear,
} from './waste-management-annual-tour-transfer.dates.js';
import { deriveWasteAnnualTourTransferId } from './waste-management-annual-tour-transfer.identity.js';
import {
  findWasteAnnualRelationshipCollisions,
  mapWasteAnnualRelationships,
  wasteAnnualRelationshipsFor,
} from './waste-management-annual-tour-transfer.relationships.js';

export const wasteAnnualIntervalForTour = (tour: WasteTourRecord): number | null => {
  if (tour.customRecurrenceId) return tour.customRecurrenceIntervalDays ?? null;
  if (tour.recurrence === 'weekly') return 7;
  if (tour.recurrence === 'biweekly') return 14;
  if (tour.recurrence === 'fourweekly') return 28;
  return null;
};

const mapValidity = (input: {
  tour: WasteTourRecord;
  targetYear: number;
  replacements: ReadonlyMap<string, string>;
}) => {
  const interval = wasteAnnualIntervalForTour(input.tour);
  if (interval !== null) {
    if (!input.tour.firstDate) return null;
    return continueWasteAnnualTourCadence({
      sourceFirstDate: input.tour.firstDate,
      sourceEndDate: input.tour.endDate,
      targetYear: input.targetYear,
      intervalDays: interval,
    });
  }
  if (input.tour.recurrence !== 'yearly') return {};
  if (!input.tour.firstDate) return null;
  const firstDate =
    input.replacements.get(input.tour.id) ??
    replaceWasteAnnualYear(input.tour.firstDate, input.targetYear) ??
    undefined;
  const endDate = input.tour.endDate
    ? (replaceWasteAnnualYear(input.tour.endDate, input.targetYear) ?? undefined)
    : undefined;
  return firstDate && (!input.tour.endDate || endDate) ? { firstDate, endDate } : null;
};

type MapTourInput = Readonly<{
  instanceId: string;
  tour: WasteTourRecord;
  sourceYear: number;
  targetYear: number;
  source: WasteAnnualTourTransferSource;
  replacements: ReadonlyMap<string, string>;
}>;

type MapTourBlocker = Readonly<{
  blocker: 'invalid_planning_data' | 'replacement_date_required' | 'target_date_collision';
  replacementResourceIds: readonly string[];
}>;

const deriveMappedRelationships = async (
  targetTourId: string,
  mapped: ReturnType<typeof mapWasteAnnualRelationships>
) => ({
  locationTourPickupDates: await Promise.all(
    mapped.pickupDates.map(async (item) => ({
      id: await deriveWasteAnnualTourTransferId(targetTourId, 'pickup-date', item.source.id),
      locationId: item.source.locationId,
      tourId: targetTourId,
      pickupDate: item.mappedDate as string,
      note: item.source.note,
    }))
  ),
  tourAssignments: await Promise.all(
    mapped.assignments.map(async (item) => ({
      id: await deriveWasteAnnualTourTransferId(targetTourId, 'assignment', item.source.id),
      tourId: targetTourId,
      pickupDate: item.mappedDate as string,
      note: item.source.note,
      locationIds: [...item.source.locationIds],
    }))
  ),
  tourDateShifts: await Promise.all(
    mapped.shifts.map(async (item) => ({
      id: await deriveWasteAnnualTourTransferId(targetTourId, 'date-shift', item.source.id),
      tourId: targetTourId,
      originalDate: item.originalDate as string,
      actualDate: item.actualDate as string,
      hasYear: item.source.hasYear,
      reasonType: item.source.reasonType,
      reasonKey: item.source.reasonKey,
      followUpMode: item.source.followUpMode,
      description: item.source.description,
    }))
  ),
});

export const mapWasteAnnualTour = async (
  input: MapTourInput
): Promise<
  Readonly<{ mapped: WasteAnnualTourTransferMappedTour; excluded: number }> | MapTourBlocker
> => {
  const validity = mapValidity(input);
  if (!validity) {
    return {
      blocker:
        input.tour.recurrence === 'yearly' ? 'replacement_date_required' : 'invalid_planning_data',
      replacementResourceIds: input.tour.recurrence === 'yearly' ? [input.tour.id] : [],
    };
  }
  const relationships = mapWasteAnnualRelationships(input);
  if (relationships.missing.length > 0) {
    return { blocker: 'replacement_date_required', replacementResourceIds: relationships.missing };
  }
  const collisions = findWasteAnnualRelationshipCollisions(relationships);
  if (collisions.length > 0) {
    return { blocker: 'target_date_collision', replacementResourceIds: collisions };
  }
  const targetTourId = await deriveWasteAnnualTourTransferId(
    input.instanceId,
    input.tour.id,
    String(input.targetYear),
    'tour'
  );
  const links = wasteAnnualRelationshipsFor(input.source.locationTourLinks, input.tour.id);
  const mappedRelationships = await deriveMappedRelationships(targetTourId, relationships);
  const mapped: WasteAnnualTourTransferMappedTour = {
    sourceTourId: input.tour.id,
    targetTour: {
      id: targetTourId,
      name: input.tour.name,
      description: input.tour.description,
      wasteFractionIds: [...input.tour.wasteFractionIds],
      recurrence: input.tour.recurrence,
      customRecurrenceId: input.tour.customRecurrenceId,
      customRecurrenceName: input.tour.customRecurrenceName,
      customRecurrenceIntervalDays: input.tour.customRecurrenceIntervalDays,
      ...validity,
      customDates: relationships.customDates.map((item) => ({
        date: item.mappedDate as string,
        description: item.description,
      })),
      active: false,
      locationCount: links.length,
    },
    locationTourLinks: await Promise.all(
      links.map(async (item) => ({
        id: await deriveWasteAnnualTourTransferId(targetTourId, 'location-link', item.id),
        locationId: item.locationId,
        tourId: targetTourId,
      }))
    ),
    ...mappedRelationships,
  };
  const allDatedRelationships =
    (input.tour.customDates?.length ?? 0) +
    wasteAnnualRelationshipsFor(input.source.locationTourPickupDates, input.tour.id).length +
    wasteAnnualRelationshipsFor(input.source.tourAssignments, input.tour.id).length +
    wasteAnnualRelationshipsFor(input.source.tourDateShifts, input.tour.id).length;
  const included =
    relationships.customDates.length +
    relationships.pickupDates.length +
    relationships.assignments.length +
    relationships.shifts.length;
  return { mapped, excluded: allDatedRelationships - included };
};
