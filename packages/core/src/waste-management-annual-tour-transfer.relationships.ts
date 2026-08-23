import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import type { WasteAnnualTourTransferSource } from './waste-management-annual-tour-transfer.contract.js';
import {
  isWasteAnnualDateInYear,
  mapWasteAnnualConcreteDate,
  wasteAnnualYearOf,
} from './waste-management-annual-tour-transfer.dates.js';

export const wasteAnnualRelationshipsFor = <T extends { readonly tourId: string }>(
  items: readonly T[],
  tourId: string
): readonly T[] => items.filter((item) => item.tourId === tourId);

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

const mapShifts = (input: AnnualRelationshipMappingInput) =>
  wasteAnnualRelationshipsFor(input.source.tourDateShifts, input.tour.id)
    .filter((item) => !item.hasYear || isWasteAnnualDateInYear(item.originalDate, input.sourceYear))
    .map((source) => ({
      source,
      originalDate: source.hasYear
        ? mapDate(
            source.originalDate,
            `${source.id}:original`,
            input.targetYear,
            input.replacements
          )
        : source.originalDate,
      actualDate: source.hasYear
        ? mapDate(
            source.actualDate,
            `${source.id}:actual`,
            targetYearForShiftDate(source.actualDate, input),
            input.replacements
          )
        : source.actualDate,
    }));

type AnnualRelationshipMappingInput = Readonly<{
  tour: WasteTourRecord;
  sourceYear: number;
  targetYear: number;
  source: WasteAnnualTourTransferSource;
  replacements: ReadonlyMap<string, string>;
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
      key: `shift:${item.originalDate}:${item.actualDate}:${item.source.hasYear}`,
      resourceIds: [`${item.source.id}:original`, `${item.source.id}:actual`],
    })),
  ];
  const counts = new Map<string, number>();
  for (const item of targetKeys) counts.set(item.key, (counts.get(item.key) ?? 0) + 1);
  return targetKeys
    .filter((item) => (counts.get(item.key) ?? 0) > 1)
    .flatMap((item) => item.resourceIds);
};
