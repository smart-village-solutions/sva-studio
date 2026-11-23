import { randomUUID } from 'node:crypto';

import {
  normalizeWasteImportPickupDate,
  planWasteLocationTourPickupDateImport,
  type WasteLocationTourPickupDateImportPlan,
  type WasteLocationTourPickupDateImportParseResult,
  type WasteLocationTourPickupDateImportPlanningSnapshot,
  type WasteLocationTourPickupDateImportPreview,
} from '@sva/waste-management-contracts';
import type { createWasteMasterDataRepository } from '@sva/waste-management-runtime/repositories';

export type WasteRepository = Pick<
  ReturnType<typeof createWasteMasterDataRepository>,
  | 'listWasteFractions'
  | 'listWasteRegions'
  | 'listWasteCities'
  | 'listWasteStreets'
  | 'listWasteHouseNumbers'
  | 'listWasteCollectionLocations'
  | 'listWasteTours'
  | 'listWasteLocationTourLinks'
  | 'upsertWasteLocationTourPickupDate'
  | 'upsertWasteTourAssignment'
  | 'upsertWasteRegion'
  | 'upsertWasteCity'
  | 'upsertWasteStreet'
  | 'upsertWasteHouseNumber'
  | 'upsertWasteCollectionLocation'
  | 'upsertWasteFraction'
  | 'upsertWasteTour'
  | 'upsertWasteLocationTourLink'
  | 'upsertWasteTourDateShift'
  | 'upsertWasteGlobalDateShift'
>;

export type ImportedTourAssignment = Parameters<WasteRepository['upsertWasteTourAssignment']>[0];

type StopGroup = {
  readonly id: string;
  readonly tourId: string;
  readonly pickupDate: string;
  readonly note: string | null;
  readonly explicitId: boolean;
  readonly locationIds: Set<string>;
  readonly rows: Set<number>;
  conflict: boolean;
};

export const loadPlanningSnapshot = async (
  repository: WasteRepository
): Promise<WasteLocationTourPickupDateImportPlanningSnapshot> => {
  const [fractions, regions, cities, streets, houseNumbers, locations, tours, assignments] =
    await Promise.all([
      repository.listWasteFractions(),
      repository.listWasteRegions(),
      repository.listWasteCities(),
      repository.listWasteStreets(),
      repository.listWasteHouseNumbers(),
      repository.listWasteCollectionLocations(),
      repository.listWasteTours(),
      repository.listWasteLocationTourLinks(),
    ]);

  return {
    fractions,
    regions,
    cities,
    streets,
    houseNumbers,
    locations,
    tours,
    assignments,
  };
};

const collectTourAssignments = (plan: WasteLocationTourPickupDateImportPlan) => {
  const groups = new Map<string, StopGroup>();
  const issues = new Map(plan.issues.map((issue) => [issue.rowNumber, issue] as const));
  for (const { row, locationId, tourIds } of plan.resolvedPickupDates) {
    const pickupDate = normalizeWasteImportPickupDate(row.pickupDate ?? '');
    if (!pickupDate || tourIds.length === 0) {
      issues.set(row.rowNumber, {
        rowNumber: row.rowNumber,
        column: 'Abholdatum',
        message: 'Der Abholtermin konnte keinem Abholort und keiner Tour zugeordnet werden.',
      });
      continue;
    }

    const assignmentId = row.assignmentId?.toLowerCase();
    const note = row.note?.trim() || null;
    for (const tourId of tourIds) {
      const key = assignmentId
        ? `id::${assignmentId}`
        : `legacy::${locationId}::${tourId}::${pickupDate}`;
      const group = groups.get(key);
      if (group) {
        group.rows.add(row.rowNumber);
        group.locationIds.add(locationId);
        group.conflict ||=
          group.tourId !== tourId || group.pickupDate !== pickupDate || group.note !== note;
      } else {
        groups.set(key, {
          id: assignmentId ?? randomUUID(),
          tourId,
          pickupDate,
          note,
          explicitId: Boolean(assignmentId),
          locationIds: new Set([locationId]),
          rows: new Set([row.rowNumber]),
          conflict: false,
        });
      }
    }
  }

  const assignments: ImportedTourAssignment[] = [];
  for (const group of groups.values()) {
    if (group.conflict) {
      const message = group.explicitId
        ? 'Zeilen mit derselben Einsatz-ID müssen dieselbe Tour, dasselbe Abholdatum und denselben Hinweis haben.'
        : 'Halte am selben Abholort, für dieselbe Tour und am selben Datum benötigen bei unterschiedlichen Hinweisen jeweils eine eigene Einsatz-ID.';
      for (const rowNumber of group.rows) {
        issues.set(rowNumber, { rowNumber, column: 'Einsatz-ID', message });
      }
      continue;
    }
    assignments.push({
      id: group.id,
      tourId: group.tourId,
      pickupDate: group.pickupDate,
      note: group.note,
      locationIds: [...group.locationIds],
    });
  }
  return { assignments, issues: [...issues.values()] };
};

export const planLocationTourPickupDateImport = async (
  repository: WasteRepository,
  parsed: WasteLocationTourPickupDateImportParseResult
) => {
  const snapshot = await loadPlanningSnapshot(repository);
  const plan = planWasteLocationTourPickupDateImport(
    snapshot,
    { rows: parsed.rows },
    { createId: randomUUID }
  );
  const { assignments, issues } = collectTourAssignments(plan);
  return { ...plan, assignments, issues, existingFractionRecords: snapshot.fractions };
};

export const previewLocationTourPickupDateImport = async (
  repository: WasteRepository,
  parsed: WasteLocationTourPickupDateImportParseResult
): Promise<WasteLocationTourPickupDateImportPreview> => {
  const planned = await planLocationTourPickupDateImport(repository, parsed);
  return {
    profileId: 'waste-management.ortsbezogene-tourtermine',
    delimiter: parsed.delimiter,
    detectedDelimiter: parsed.detectedDelimiter,
    fractionNames: parsed.fractionNames,
    existingFractions: planned.existingFractions,
    newFractions: planned.newFractions,
    existingTours: planned.existingTours,
    newTours: planned.newTours,
    validRowCount: parsed.validRowCount - planned.issues.length,
    invalidRowCount: parsed.invalidRowCount + planned.issues.length,
    errors: [...parsed.issues, ...planned.issues].sort(
      (left, right) => left.rowNumber - right.rowNumber
    ),
    summary: planned.summary,
  };
};
