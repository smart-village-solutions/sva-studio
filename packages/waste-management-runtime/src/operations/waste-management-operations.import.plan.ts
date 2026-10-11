import { randomUUID } from 'node:crypto';

import { type StudioJobProgress } from '@sva/core';
import {
  normalizeWasteImportPickupDate,
  planWasteLocationTourPickupDateImport,
  type WasteLocationTourPickupDateImportPlan,
  type WasteLocationTourPickupDateImportParseResult,
  type WasteLocationTourPickupDateImportPlanningSnapshot,
} from '@sva/waste-management-contracts';
import type { createWasteMasterDataRepository } from '@sva/waste-management-runtime/repositories';

import { persistLocationTourPickupDateImportPlan } from './waste-management-operations.import.persist.js';
import { normalizeOptionalText } from './waste-management-operations.shared.js';

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

const wasteImportProgressBatchSize = 25;
const normalizeKeyPart = (value: string | undefined): string =>
  (value ?? '').trim().toLocaleLowerCase('de-DE');

export type ImportedLocationTourPickupDateRecord = Readonly<{
  readonly id: string;
  readonly assignmentId?: string;
  readonly locationId: string;
  readonly tourId: string;
  readonly pickupDate: string;
  readonly note: string | null;
}>;

const createLocationTourPickupDateImportProgress = (input: {
  readonly processedRows: number;
  readonly totalRows: number;
  readonly currentPhase: string;
  readonly currentStepKey: string;
}): StudioJobProgress => ({
  completedSteps: input.processedRows,
  totalSteps: input.totalRows,
  currentPhase: input.currentPhase,
  currentStepKey: input.currentStepKey,
  details: {
    processedRows: input.processedRows,
    totalRows: input.totalRows,
  },
  lastUpdatedAt: new Date().toISOString(),
});

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

const reportLocationTourPickupDateImportProgress = async (
  reportProgress: ((progress: StudioJobProgress) => Promise<void> | void) | undefined,
  input: {
    readonly processedRows: number;
    readonly totalRows: number;
    readonly currentPhase: string;
    readonly currentStepKey: string;
  }
) => {
  await reportProgress?.(createLocationTourPickupDateImportProgress(input));
};

const mergeUniqueById = <T extends { readonly id: string }>(
  existing: readonly T[],
  created: readonly T[]
): readonly T[] => {
  const merged = new Map(existing.map((entry) => [entry.id, entry] as const));
  for (const entry of created) {
    merged.set(entry.id, entry);
  }
  return [...merged.values()];
};

type ImportPlanningCity = WasteLocationTourPickupDateImportPlanningSnapshot['cities'][number];
type ImportResolutionIndexes = Readonly<{
  regionIdByName: ReadonlyMap<string, string>;
  cityByRegionAndName: ReadonlyMap<string, ImportPlanningCity>;
  cityByName: ReadonlyMap<string, readonly ImportPlanningCity[]>;
  streetByCityAndName: ReadonlyMap<string, { readonly id: string }>;
  houseNumberByStreetAndValue: ReadonlyMap<string, { readonly id: string }>;
  locationByScope: ReadonlyMap<string, { readonly id: string }>;
  tourIdByName: ReadonlyMap<string, string>;
}>;

const resolveImportedLocationId = (
  row: WasteLocationTourPickupDateImportParseResult['rows'][number],
  indexes: ImportResolutionIndexes
): string | undefined => {
  const regionId = row.region
    ? indexes.regionIdByName.get(normalizeKeyPart(row.region))
    : undefined;
  const normalizedCityName = normalizeKeyPart(row.city);
  const citiesWithName = indexes.cityByName.get(normalizedCityName) ?? [];
  const city = regionId
    ? indexes.cityByRegionAndName.get(`${regionId}::${normalizedCityName}`)
    : citiesWithName.length === 1
      ? citiesWithName[0]
      : undefined;
  if (!city) return undefined;

  const street = indexes.streetByCityAndName.get(`${city.id}::${normalizeKeyPart(row.street)}`);
  if (!street) return undefined;
  const houseNumber = indexes.houseNumberByStreetAndValue.get(
    `${street.id}::${normalizeKeyPart(row.houseNumbers)}`
  );
  if (!houseNumber) return undefined;

  return (
    indexes.locationByScope.get(
      `${regionId ?? city.regionId ?? ''}::${city.id}::${street.id}::${houseNumber.id}`
    ) ??
    indexes.locationByScope.get(
      `${city.regionId ?? ''}::${city.id}::${street.id}::${houseNumber.id}`
    )
  )?.id;
};

export const buildImportedLocationTourPickupDateRecords = async (
  repository: WasteRepository,
  plan: WasteLocationTourPickupDateImportPlan,
  parsed: WasteLocationTourPickupDateImportParseResult
): Promise<readonly ImportedLocationTourPickupDateRecord[]> => {
  const rowsWithPickupDates = parsed.rows.filter(
    (
      row
    ): row is WasteLocationTourPickupDateImportParseResult['rows'][number] & {
      readonly pickupDate: string;
    } => typeof row.pickupDate === 'string'
  );
  if (rowsWithPickupDates.length === 0) {
    return [];
  }

  const snapshot = await loadPlanningSnapshot(repository);
  const regions = mergeUniqueById(snapshot.regions, plan.upserts.regions);
  const cities = mergeUniqueById(snapshot.cities, plan.upserts.cities);
  const streets = mergeUniqueById(snapshot.streets, plan.upserts.streets);
  const houseNumbers = mergeUniqueById(snapshot.houseNumbers, plan.upserts.houseNumbers);
  const locations = mergeUniqueById(snapshot.locations, plan.upserts.locations);
  const tours = mergeUniqueById(snapshot.tours, plan.upserts.tours);

  const regionIdByName = new Map(
    regions.map((region) => [normalizeKeyPart(region.name), region.id] as const)
  );
  const cityByRegionAndName = new Map(
    cities.map((city) => [`${city.regionId ?? ''}::${normalizeKeyPart(city.name)}`, city] as const)
  );
  const cityByName = cities.reduce<
    Map<string, WasteLocationTourPickupDateImportPlanningSnapshot['cities']>
  >((byName, city) => {
    const key = normalizeKeyPart(city.name);
    const existing = byName.get(key) ?? [];
    byName.set(key, [...existing, city]);
    return byName;
  }, new Map());
  const streetByCityAndName = new Map(
    streets.map((street) => [`${street.cityId}::${normalizeKeyPart(street.name)}`, street] as const)
  );
  const houseNumberByStreetAndValue = new Map(
    houseNumbers.map(
      (houseNumber) =>
        [`${houseNumber.streetId}::${normalizeKeyPart(houseNumber.number)}`, houseNumber] as const
    )
  );
  const locationByScope = new Map(
    locations.map(
      (location) =>
        [
          `${location.regionId ?? ''}::${location.cityId}::${location.streetId ?? ''}::${location.houseNumberId ?? ''}`,
          location,
        ] as const
    )
  );
  const tourIdByName = new Map(
    tours.map((tour) => [normalizeKeyPart(tour.name), tour.id] as const)
  );

  const indexes: ImportResolutionIndexes = {
    regionIdByName,
    cityByRegionAndName,
    cityByName,
    streetByCityAndName,
    houseNumberByStreetAndValue,
    locationByScope,
    tourIdByName,
  };
  const importedPickupDates: ImportedLocationTourPickupDateRecord[] = [];
  const importedPickupDateKeys = new Set<string>();
  for (const row of rowsWithPickupDates) {
    const pickupDate = normalizeWasteImportPickupDate(row.pickupDate);
    if (!pickupDate) {
      continue;
    }

    const normalizedNote = normalizeOptionalText(row.note) ?? null;
    const locationId = resolveImportedLocationId(row, indexes);
    if (!locationId) {
      continue;
    }

    for (const tourName of Object.values(row.tourNamesByFractionName)) {
      const tourId = tourIdByName.get(normalizeKeyPart(tourName));
      if (!tourId) {
        continue;
      }
      const importedPickupDateKey = row.assignmentId
        ? `${row.assignmentId}::${row.rowNumber}::${tourId}`
        : `legacy::${locationId}::${tourId}::${pickupDate}`;
      if (importedPickupDateKeys.has(importedPickupDateKey)) {
        continue;
      }
      importedPickupDateKeys.add(importedPickupDateKey);
      importedPickupDates.push({
        id: row.assignmentId ?? randomUUID(),
        assignmentId: row.assignmentId,
        locationId,
        tourId,
        pickupDate,
        note: normalizedNote,
      });
    }
  }

  return importedPickupDates;
};
export const planLocationTourPickupDateImport = async (
  repository: WasteRepository,
  input: {
    readonly parsed: WasteLocationTourPickupDateImportParseResult;
    readonly persist: boolean;
    readonly reportProgress?: (progress: StudioJobProgress) => Promise<void> | void;
  }
): Promise<WasteLocationTourPickupDateImportPlan> => {
  const totalRows = input.parsed.validRowCount;
  let processedRows = 0;

  const plan = planWasteLocationTourPickupDateImport(
    await loadPlanningSnapshot(repository),
    {
      rows: input.parsed.rows,
    },
    {
      createId: () => randomUUID(),
    }
  );
  const importedPickupDates = input.persist
    ? await buildImportedLocationTourPickupDateRecords(repository, plan, input.parsed)
    : [];

  if (input.persist) {
    await reportLocationTourPickupDateImportProgress(input.reportProgress, {
      processedRows: 0,
      totalRows,
      currentPhase: 'waste-management.import-preparation',
      currentStepKey: 'prepare-import',
    });
    await reportLocationTourPickupDateImportProgress(input.reportProgress, {
      processedRows: 0,
      totalRows,
      currentPhase: 'waste-management.import-running',
      currentStepKey: 'process-rows',
    });
  }

  if (input.persist) {
    for (const _row of input.parsed.rows) {
      processedRows += 1;
      if (processedRows % wasteImportProgressBatchSize === 0 || processedRows === totalRows) {
        await reportLocationTourPickupDateImportProgress(input.reportProgress, {
          processedRows,
          totalRows,
          currentPhase: 'waste-management.import-running',
          currentStepKey: 'process-rows',
        });
      }
    }
    await persistLocationTourPickupDateImportPlan(repository, plan, importedPickupDates);
  }

  if (input.persist) {
    await reportLocationTourPickupDateImportProgress(input.reportProgress, {
      processedRows,
      totalRows,
      currentPhase: 'waste-management.completed',
      currentStepKey: 'complete-operation',
    });
  }

  return plan;
};
