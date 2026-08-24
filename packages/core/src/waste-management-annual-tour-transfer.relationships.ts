import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import type { WasteAnnualTourTransferSource } from './waste-management-annual-tour-transfer.contract.js';
import {
  isWasteAnnualDateInYear,
  mapWasteAnnualConcreteDate,
  wasteAnnualYearOf,
} from './waste-management-annual-tour-transfer.dates.js';
import { mapWasteAnnualRecurringShiftDates } from './waste-management-annual-tour-transfer.shift-cadence.js';

export const wasteAnnualRelationshipsFor = <T extends { readonly tourId: string }>(
  items: readonly T[],
  tourId: string
): readonly T[] => items.filter((item) => item.tourId === tourId);

const relationshipsByTour = <T extends { readonly tourId: string }>(items: readonly T[]) => {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const current = grouped.get(item.tourId);
    if (current) current.push(item);
    else grouped.set(item.tourId, [item]);
  }
  return grouped as ReadonlyMap<string, readonly T[]>;
};

export const createWasteAnnualSourceRelationshipIndex = (
  source: WasteAnnualTourTransferSource
) => ({
  locationTourLinks: relationshipsByTour(source.locationTourLinks),
  locationTourPickupDates: relationshipsByTour(source.locationTourPickupDates),
  tourAssignments: relationshipsByTour(source.tourAssignments),
  tourDateShifts: relationshipsByTour(source.tourDateShifts),
});

export const wasteAnnualSourceForTour = (
  source: WasteAnnualTourTransferSource,
  index: ReturnType<typeof createWasteAnnualSourceRelationshipIndex>,
  tourId: string
): WasteAnnualTourTransferSource => ({
  ...source,
  locationTourLinks: index.locationTourLinks.get(tourId) ?? [],
  locationTourPickupDates: index.locationTourPickupDates.get(tourId) ?? [],
  tourAssignments: index.tourAssignments.get(tourId) ?? [],
  tourDateShifts: index.tourDateShifts.get(tourId) ?? [],
});

export const createWasteAnnualSourceResolver = (source: WasteAnnualTourTransferSource) => {
  const index = createWasteAnnualSourceRelationshipIndex(source);
  const scopedSources = new Map(
    source.tours.map((tour) => [tour.id, wasteAnnualSourceForTour(source, index, tour.id)])
  );
  return (tour: WasteTourRecord): WasteAnnualTourTransferSource =>
    scopedSources.get(tour.id) ?? source;
};

const mapDate = (
  value: string,
  resourceId: string,
  targetYear: number,
  replacements: ReadonlyMap<string, string>
) => mapWasteAnnualConcreteDate(value, targetYear, replacements.get(resourceId));

const mapCustomDates = (input: AnnualRelationshipMappingInput) =>
  (input.tour.customDates ?? [])
    .filter((item) => isWasteAnnualDateInYear(item.date, input.sourceYear))
    .map((item, index) => {
      const resourceId = `${input.tour.id}:custom-date:${index}:${item.date}`;
      return {
        resourceId,
        mappedDate: mapDate(item.date, resourceId, input.targetYear, input.replacements),
        description: item.description,
      };
    });

const mapPickupDates = (input: AnnualRelationshipMappingInput) =>
  wasteAnnualRelationshipsFor(input.source.locationTourPickupDates, input.tour.id)
    .filter((item) => isWasteAnnualDateInYear(item.pickupDate, input.sourceYear))
    .map((source) => ({
      source,
      mappedDate: mapDate(source.pickupDate, source.id, input.targetYear, input.replacements),
    }));

const mapAssignments = (input: AnnualRelationshipMappingInput) =>
  wasteAnnualRelationshipsFor(input.source.tourAssignments, input.tour.id)
    .filter((item) => isWasteAnnualDateInYear(item.pickupDate, input.sourceYear))
    .map((source) => ({
      source,
      mappedDate: mapDate(source.pickupDate, source.id, input.targetYear, input.replacements),
    }));

const targetYearForShiftDate = (value: string, input: AnnualRelationshipMappingInput): number =>
  input.targetYear + ((wasteAnnualYearOf(value) ?? input.sourceYear) - input.sourceYear);

const mapYearSpecificShift = (
  source: WasteAnnualTourTransferSource['tourDateShifts'][number],
  input: AnnualRelationshipMappingInput
): Readonly<{ originalDate: string | null; actualDate: string | null }> => {
  const recurring = mapWasteAnnualRecurringShiftDates({
    source,
    tour: input.tour,
    sourceYear: input.sourceYear,
    targetYear: input.targetYear,
    targetFirstDate: input.targetValidity?.firstDate,
    targetEndDate: input.targetValidity?.endDate,
    replacements: input.replacements,
  });
  if (recurring) return recurring;
  if (input.tour.customRecurrenceId) return { originalDate: null, actualDate: null };
  return {
    originalDate: mapDate(
      source.originalDate,
      `${source.id}:original`,
      input.targetYear,
      input.replacements
    ),
    actualDate: mapDate(
      source.actualDate,
      `${source.id}:actual`,
      targetYearForShiftDate(source.actualDate, input),
      input.replacements
    ),
  };
};

const mapShifts = (input: AnnualRelationshipMappingInput) =>
  wasteAnnualRelationshipsFor(input.source.tourDateShifts, input.tour.id)
    .filter((item) => !item.hasYear || isWasteAnnualDateInYear(item.originalDate, input.sourceYear))
    .map((source) => {
      const mapped = source.hasYear
        ? mapYearSpecificShift(source, input)
        : { originalDate: source.originalDate, actualDate: source.actualDate };
      return {
        source,
        ...mapped,
      };
    });

type AnnualRelationshipMappingInput = Readonly<{
  tour: WasteTourRecord;
  sourceYear: number;
  targetYear: number;
  source: WasteAnnualTourTransferSource;
  replacements: ReadonlyMap<string, string>;
  targetValidity?: Readonly<{ firstDate?: string; endDate?: string }>;
}>;

export const mapWasteAnnualRelationships = (input: AnnualRelationshipMappingInput) => {
  const customDates = mapCustomDates(input);
  const pickupDates = mapPickupDates(input);
  const assignments = mapAssignments(input);
  const shifts = mapShifts(input);
  const missing = [
    ...customDates.filter((item) => !item.mappedDate).map((item) => item.resourceId),
    ...pickupDates.filter((item) => !item.mappedDate).map((item) => item.source.id),
    ...assignments.filter((item) => !item.mappedDate).map((item) => item.source.id),
    ...shifts.flatMap((item) => [
      ...(item.originalDate ? [] : [`${item.source.id}:original`]),
      ...(item.actualDate ? [] : [`${item.source.id}:actual`]),
    ]),
  ];
  return { customDates, pickupDates, assignments, shifts, missing } as const;
};

export const findWasteAnnualRelationshipCollisions = (
  mapped: ReturnType<typeof mapWasteAnnualRelationships>
): readonly string[] => {
  const targetKeys = [
    ...mapped.customDates.map((item) => ({
      key: `custom:${item.mappedDate}`,
      resourceIds: [item.resourceId],
    })),
    ...mapped.pickupDates.map((item) => ({
      key: `pickup:${item.source.locationId}:${item.mappedDate}`,
      resourceIds: [item.source.id],
    })),
    ...mapped.assignments.map((item) => ({
      key: `assignment:${[...item.source.locationIds].sort().join(',')}:${item.mappedDate}`,
      resourceIds: [item.source.id],
    })),
    ...mapped.shifts.map((item) => ({
      key: item.source.hasYear
        ? `shift:specific:${item.originalDate}`
        : `shift:annual:${item.originalDate?.slice(5)}`,
      resourceIds: [`${item.source.id}:original`, `${item.source.id}:actual`],
    })),
  ];
  const counts = new Map<string, number>();
  for (const item of targetKeys) counts.set(item.key, (counts.get(item.key) ?? 0) + 1);
  return targetKeys
    .filter((item) => (counts.get(item.key) ?? 0) > 1)
    .flatMap((item) => item.resourceIds);
};
