import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import type {
  WasteAnnualTourTransferMappedTour,
  WasteAnnualTourTransferSource,
} from './waste-management-annual-tour-transfer.contract.js';
import {
  continueWasteAnnualTourCadence,
  replaceWasteAnnualYear,
  wasteAnnualEndOfYear,
  wasteAnnualStartOfYear,
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

type ValidityMappingResult =
  | Readonly<{ ok: true; validity: Readonly<{ firstDate?: string; endDate?: string }> }>
  | Readonly<{
      ok: false;
      blocker: 'invalid_planning_data' | 'replacement_date_required';
      replacementResourceIds: readonly string[];
    }>;

type ValidityMappingInput = Readonly<{
  tour: WasteTourRecord;
  sourceYear: number;
  targetYear: number;
  replacements: ReadonlyMap<string, string>;
}>;

type ValidityBoundaries = Readonly<{
  targetStart: string;
  targetEnd: string;
}>;

const resolveValidityBoundaries = (
  input: ValidityMappingInput
): ValidityBoundaries | ValidityMappingResult => {
  const sourceYearStart = wasteAnnualStartOfYear(input.sourceYear);
  const sourceYearEnd = wasteAnnualEndOfYear(input.sourceYear);
  const sourceStart =
    input.tour.recurrence === 'yearly' && input.tour.firstDate
      ? input.tour.firstDate
      : input.tour.firstDate && input.tour.firstDate > sourceYearStart
        ? input.tour.firstDate
        : sourceYearStart;
  const sourceEnd =
    input.tour.endDate && input.tour.endDate < sourceYearEnd ? input.tour.endDate : sourceYearEnd;
  const startResourceId = `${input.tour.id}:validity:start`;
  const endResourceId = `${input.tour.id}:validity:end`;
  const targetStart =
    input.replacements.get(startResourceId) ??
    replaceWasteAnnualYear(sourceStart, input.targetYear);
  const targetEnd =
    input.replacements.get(endResourceId) ?? replaceWasteAnnualYear(sourceEnd, input.targetYear);
  const missing = [
    ...(targetStart ? [] : [startResourceId]),
    ...(targetEnd ? [] : [endResourceId]),
  ];
  return targetStart && targetEnd
    ? { targetStart, targetEnd }
    : {
        ok: false,
        blocker: 'replacement_date_required',
        replacementResourceIds: missing,
      };
};

const mapIntervalValidity = (
  input: ValidityMappingInput,
  intervalDays: number,
  boundaries: ValidityBoundaries
): ValidityMappingResult => {
  if (!input.tour.firstDate) {
    return { ok: false, blocker: 'invalid_planning_data', replacementResourceIds: [] };
  }
  const cadence = continueWasteAnnualTourCadence({
    sourceFirstDate: input.tour.firstDate,
    sourceEndDate: input.tour.endDate,
    sourceYear: input.sourceYear,
    targetYear: input.targetYear,
    intervalDays,
    targetSliceStart: boundaries.targetStart,
    targetSliceEnd: boundaries.targetEnd,
  });
  return cadence
    ? { ok: true, validity: cadence }
    : { ok: false, blocker: 'invalid_planning_data', replacementResourceIds: [] };
};

const mapValidity = (input: ValidityMappingInput): ValidityMappingResult => {
  const boundaries = resolveValidityBoundaries(input);
  if ('ok' in boundaries) return boundaries;
  const interval = wasteAnnualIntervalForTour(input.tour);
  if (interval !== null) return mapIntervalValidity(input, interval, boundaries);
  if (input.tour.recurrence !== 'yearly') return { ok: true, validity: {} };
  if (!input.tour.firstDate) {
    return { ok: false, blocker: 'invalid_planning_data', replacementResourceIds: [] };
  }
  if (boundaries.targetStart > boundaries.targetEnd) {
    return { ok: false, blocker: 'invalid_planning_data', replacementResourceIds: [] };
  }
  return {
    ok: true,
    validity: { firstDate: boundaries.targetStart, endDate: boundaries.targetEnd },
  };
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

export const findWasteAnnualTourReplacementResourceIds = (
  input: Omit<MapTourInput, 'replacements'>
) => {
  const withoutReplacements = { ...input, replacements: new Map<string, string>() };
  const validity = mapValidity(withoutReplacements);
  const relationships = mapWasteAnnualRelationships(withoutReplacements);
  return [
    ...(!validity.ok ? validity.replacementResourceIds : []),
    ...relationships.missing,
    ...findWasteAnnualRelationshipCollisions(relationships),
  ];
};

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
  if (!validity.ok) {
    return {
      blocker: validity.blocker,
      replacementResourceIds: validity.replacementResourceIds,
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
      ...validity.validity,
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
