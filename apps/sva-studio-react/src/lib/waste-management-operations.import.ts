import { randomUUID } from 'node:crypto';

import ExcelJS from 'exceljs';
import {
  getWasteManagementImportCatalogEntry,
  normalizeWasteImportPickupDate,
  parseWasteLocationTourPickupDateCsv,
  planWasteLocationTourPickupDateImport,
  wasteManagementMasterDataContract,
  type StudioJobProgress,
  type WasteLocationTourPickupDateImportPlan,
  type WasteLocationTourPickupDateImportParseResult,
  type WasteLocationTourPickupDateImportPlanningSnapshot,
  type WasteLocationTourPickupDateImportPreview,
  type WasteManagementImportProfileId,
  type WasteManagementImportSourceFormat,
} from '@sva/core';
import type { createWasteMasterDataRepository } from '@sva/data-repositories';

import {
  defaultReadBinarySource,
  ensureRequiredColumns,
  normalizeOptionalText,
  parseBoolean,
  parseCustomDates,
  parseDelimitedStringArray,
  parseFollowUpMode,
  parseReasonType,
  parseRecurrence,
} from './waste-management-operations.shared.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

type GenericImportRow = Record<string, string>;
type WasteRepository = Pick<
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
const normalizeKeyPart = (value: string | undefined): string => (value ?? '').trim().toLocaleLowerCase('de-DE');
const toArrayBuffer = (source: Uint8Array): ArrayBuffer => {
  const slicedBuffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  return slicedBuffer instanceof ArrayBuffer ? slicedBuffer : new ArrayBuffer(0);
};
const { Workbook } = ExcelJS;

type ImportedLocationTourPickupDateRecord = Readonly<{
  readonly id: string;
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

const parseImportWorkbookRows = async (source: Uint8Array): Promise<readonly GenericImportRow[]> => {
  const workbook = new Workbook();
  await workbook.xlsx.load(toArrayBuffer(source));
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headerCount = Math.max(headerRow.actualCellCount, headerRow.cellCount);
  const headers: Array<Readonly<{ key: string; columnIndex: number }>> = [];
  for (let columnIndex = 1; columnIndex <= headerCount; columnIndex += 1) {
    const header = headerRow.getCell(columnIndex).text.trim();
    if (header.length > 0) {
      headers.push({ key: header, columnIndex });
    }
  }
  if (headers.length === 0) return [];

  const rows: GenericImportRow[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const cells = headers.map(({ columnIndex }) => row.getCell(columnIndex).text.trim());
    if (cells.every((value) => value.length === 0)) {
      continue;
    }
    rows.push(
      Object.fromEntries(headers.map(({ key }, index) => [key, cells[index] ?? '']))
    );
  }

  return rows;
};

const decodeTextSource = (source: Uint8Array): string => new TextDecoder('utf-8').decode(source);

export const parseImportRows = async (
  deps: WasteOperationRuntimeDeps,
  input: {
    readonly profileId: WasteManagementImportProfileId;
    readonly sourceFormat: WasteManagementImportSourceFormat;
    readonly blobRef?: string;
  }
): Promise<readonly GenericImportRow[]> => {
  if (!input.blobRef) throw new Error('missing_blob_ref');
  const catalogEntry = getWasteManagementImportCatalogEntry(input.profileId);
  if (!catalogEntry) throw new Error(`unknown_import_profile:${input.profileId}`);
  const source = await (deps.readBinarySource ?? defaultReadBinarySource)(input.blobRef);
  const rows = await parseImportWorkbookRows(source);
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  ensureRequiredColumns(headers, catalogEntry.requiredColumns, input.profileId);
  return rows;
};

export const parseLocationTourPickupDateImport = async (
  deps: WasteOperationRuntimeDeps,
  input: {
    readonly sourceFormat: WasteManagementImportSourceFormat;
    readonly blobRef?: string;
    readonly delimiterOverride?: ';' | ',' | '\t' | '|';
  }
): Promise<WasteLocationTourPickupDateImportParseResult> => {
  if (!input.blobRef) {
    throw new Error('missing_blob_ref');
  }
  if (input.sourceFormat !== 'text/csv') {
    throw new Error(`unsupported_import_source_format:${input.sourceFormat}`);
  }
  const source = await (deps.readBinarySource ?? defaultReadBinarySource)(input.blobRef);
  return parseWasteLocationTourPickupDateCsv({
    text: decodeTextSource(source),
    delimiterOverride: input.delimiterOverride,
  });
};

const loadPlanningSnapshot = async (
  repository: WasteRepository
): Promise<WasteLocationTourPickupDateImportPlanningSnapshot> => {
  const [fractions, regions, cities, streets, houseNumbers, locations, tours, assignments] = await Promise.all([
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

const buildImportedLocationTourPickupDateRecords = async (
  repository: WasteRepository,
  plan: WasteLocationTourPickupDateImportPlan,
  parsed: WasteLocationTourPickupDateImportParseResult
): Promise<readonly ImportedLocationTourPickupDateRecord[]> => {
  const rowsWithPickupDates = parsed.rows.filter(
    (row): row is WasteLocationTourPickupDateImportParseResult['rows'][number] & { readonly pickupDate: string } =>
      typeof row.pickupDate === 'string'
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

  const regionIdByName = new Map(regions.map((region) => [normalizeKeyPart(region.name), region.id] as const));
  const cityByRegionAndName = new Map(
    cities.map((city) => [`${city.regionId ?? ''}::${normalizeKeyPart(city.name)}`, city] as const)
  );
  const cityByName = cities.reduce<Map<string, WasteLocationTourPickupDateImportPlanningSnapshot['cities']>>((byName, city) => {
    const key = normalizeKeyPart(city.name);
    const existing = byName.get(key) ?? [];
    byName.set(key, [...existing, city]);
    return byName;
  }, new Map());
  const streetByCityAndName = new Map(
    streets.map((street) => [`${street.cityId}::${normalizeKeyPart(street.name)}`, street] as const)
  );
  const houseNumberByStreetAndValue = new Map(
    houseNumbers.map((houseNumber) => [`${houseNumber.streetId}::${normalizeKeyPart(houseNumber.number)}`, houseNumber] as const)
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
  const tourIdByName = new Map(tours.map((tour) => [normalizeKeyPart(tour.name), tour.id] as const));

  const importedPickupDates: ImportedLocationTourPickupDateRecord[] = [];
  const importedPickupDateKeys = new Set<string>();
  for (const row of rowsWithPickupDates) {
    const pickupDate = normalizeWasteImportPickupDate(row.pickupDate);
    if (!pickupDate) {
      continue;
    }

    const normalizedNote = normalizeOptionalText(row.note) ?? null;
    const regionId = row.region ? regionIdByName.get(normalizeKeyPart(row.region)) : undefined;
    const normalizedCityName = normalizeKeyPart(row.city);
    const city =
      (regionId ? cityByRegionAndName.get(`${regionId}::${normalizedCityName}`) : undefined) ??
      (() => {
        const matches = cityByName.get(normalizedCityName) ?? [];
        return matches.length === 1 ? matches[0] : undefined;
      })();
    if (!city) {
      continue;
    }

    const street = streetByCityAndName.get(`${city.id}::${normalizeKeyPart(row.street)}`);
    if (!street) {
      continue;
    }

    const houseNumber = houseNumberByStreetAndValue.get(`${street.id}::${normalizeKeyPart(row.houseNumbers)}`);
    if (!houseNumber) {
      continue;
    }

    const location =
      locationByScope.get(`${regionId ?? city.regionId ?? ''}::${city.id}::${street.id}::${houseNumber.id}`) ??
      locationByScope.get(`${city.regionId ?? ''}::${city.id}::${street.id}::${houseNumber.id}`);
    if (!location) {
      continue;
    }

    for (const tourName of Object.values(row.tourNamesByFractionName)) {
      const tourId = tourIdByName.get(normalizeKeyPart(tourName));
      if (!tourId) {
        continue;
      }
      const importedPickupDateKey = `${location.id}::${tourId}::${pickupDate}`;
      if (importedPickupDateKeys.has(importedPickupDateKey)) {
        continue;
      }
      importedPickupDateKeys.add(importedPickupDateKey);
      importedPickupDates.push({
        id: randomUUID(),
        locationId: location.id,
        tourId,
        pickupDate,
        note: normalizedNote,
      });
    }
  }

  return importedPickupDates;
};

const persistLocationTourPickupDateImportPlan = async (
  repository: WasteRepository,
  plan: WasteLocationTourPickupDateImportPlan,
  importedPickupDates: readonly ImportedLocationTourPickupDateRecord[]
) => {
  const persistStage = async <T>(
    items: readonly T[],
    persistItem: (item: T) => Promise<void>
  ): Promise<void> => {
    for (const item of items) {
      await persistItem(item);
    }
  };

  await persistStage(plan.upserts.regions, async (region) => {
    await repository.upsertWasteRegion({ id: region.id, name: region.name });
  });
  await persistStage(plan.upserts.cities, async (city) => {
    await repository.upsertWasteCity({ id: city.id, name: city.name, regionId: city.regionId });
  });
  await persistStage(plan.upserts.streets, async (street) => {
    await repository.upsertWasteStreet({ id: street.id, name: street.name, cityId: street.cityId });
  });
  await persistStage(plan.upserts.houseNumbers, async (houseNumber) => {
    await repository.upsertWasteHouseNumber({
      id: houseNumber.id,
      number: houseNumber.number,
      streetId: houseNumber.streetId,
    });
  });
  await persistStage(plan.upserts.locations, async (location) => {
    await repository.upsertWasteCollectionLocation({
      id: location.id,
      cityId: location.cityId,
      regionId: location.regionId,
      streetId: location.streetId,
      houseNumberId: location.houseNumberId,
      active: location.active,
    });
  });
  await persistStage(plan.upserts.fractions, async (fraction) => {
    await repository.upsertWasteFraction({
      id: fraction.id,
      name: fraction.name,
      translations: fraction.translations,
      containerSize: fraction.containerSize,
      color: fraction.color,
      description: fraction.description,
      active: fraction.active,
      reminderConfig: fraction.reminderConfig,
    });
  });
  await persistStage(plan.upserts.tours, async (tour) => {
    await repository.upsertWasteTour({
      id: tour.id,
      name: tour.name,
      description: tour.description,
      wasteFractionIds: tour.wasteFractionIds,
      recurrence: tour.recurrence,
      firstDate: tour.firstDate,
      endDate: tour.endDate,
      customDates: tour.customDates,
      active: tour.active,
    });
  });
  await persistStage(plan.upserts.assignments, async (assignment) => {
    await repository.upsertWasteLocationTourLink({
      id: assignment.id,
      locationId: assignment.locationId,
      tourId: assignment.tourId,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
    });
  });
  await persistStage(importedPickupDates, async (pickupDate) => {
    await repository.upsertWasteLocationTourPickupDate({
      id: pickupDate.id,
      locationId: pickupDate.locationId,
      tourId: pickupDate.tourId,
      pickupDate: pickupDate.pickupDate,
      note: pickupDate.note,
    });
  });
};

const planLocationTourPickupDateImport = async (
  repository: WasteRepository,
  input: {
    readonly parsed: WasteLocationTourPickupDateImportParseResult;
    readonly persist: boolean;
    readonly reportProgress?: (progress: StudioJobProgress) => Promise<void> | void;
  }
): Promise<WasteLocationTourPickupDateImportPlan> => {
  const totalRows = input.parsed.validRowCount;
  let processedRows = 0;

  const plan = planWasteLocationTourPickupDateImport(await loadPlanningSnapshot(repository), {
    rows: input.parsed.rows,
  }, {
    createId: () => randomUUID(),
  });
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

export const previewLocationTourPickupDateImport = async (
  repository: WasteRepository,
  parsed: WasteLocationTourPickupDateImportParseResult
): Promise<WasteLocationTourPickupDateImportPreview> => {
  const planned = await planLocationTourPickupDateImport(repository, { parsed, persist: false });
  return {
    profileId: 'waste-management.ortsbezogene-tourtermine',
    delimiter: parsed.delimiter,
    detectedDelimiter: parsed.detectedDelimiter,
    fractionNames: parsed.fractionNames,
    existingFractions: planned.existingFractions,
    newFractions: planned.newFractions,
    existingTours: planned.existingTours,
    newTours: planned.newTours,
    validRowCount: parsed.validRowCount,
    invalidRowCount: parsed.invalidRowCount,
    errors: parsed.issues,
    summary: planned.summary,
  };
};

const executeLocationTourPickupDateImport = async (
  repository: WasteRepository,
  input: {
    readonly parsedLocationTourPickupDates: WasteLocationTourPickupDateImportParseResult;
    readonly reportProgress?: (progress: StudioJobProgress) => Promise<void> | void;
  }
) => {
  if (input.parsedLocationTourPickupDates.issues.length > 0) {
    throw new Error('location_tour_pickup_date_import_has_issues');
  }

  const planned = await planLocationTourPickupDateImport(repository, {
    parsed: input.parsedLocationTourPickupDates,
    persist: true,
    reportProgress: input.reportProgress,
  });

  return {
    rowCount: input.parsedLocationTourPickupDates.validRowCount,
    createdFractions: planned.summary.fractions.created,
    createdTours: planned.newTours.length,
    createdLocations: planned.summary.locations.created,
    createdAssignments: planned.summary.assignments.created,
    skippedRows: input.parsedLocationTourPickupDates.invalidRowCount,
    errorCount: input.parsedLocationTourPickupDates.issues.length,
  };
};

const executeGeographyImport = async (
  repository: WasteRepository,
  rows: readonly GenericImportRow[],
  counts: { rows: number; upserts: number }
) => {
  for (const row of rows) {
    await repository.upsertWasteRegion({ id: row.region_id, name: row.region_name });
    await repository.upsertWasteCity({ id: row.city_id, name: row.city_name, regionId: row.region_id });
    counts.upserts += 2;
    if (normalizeOptionalText(row.street_id) && normalizeOptionalText(row.street_name)) {
      await repository.upsertWasteStreet({ id: row.street_id, name: row.street_name, cityId: row.city_id });
      counts.upserts += 1;
    }
    if (
      normalizeOptionalText(row.house_number_id) &&
      normalizeOptionalText(row.house_number_value) &&
      normalizeOptionalText(row.street_id)
    ) {
      await repository.upsertWasteHouseNumber({ id: row.house_number_id, number: row.house_number_value, streetId: row.street_id });
      counts.upserts += 1;
    }
    await repository.upsertWasteCollectionLocation({
      id: row.location_id,
      regionId: normalizeOptionalText(row.region_id),
      cityId: row.city_id,
      streetId: normalizeOptionalText(row.street_id),
      houseNumberId: normalizeOptionalText(row.house_number_id),
      active: parseBoolean(row.active, 'active'),
    });
    counts.upserts += 1;
  }

  return counts;
};

const executeToursImport = async (
  repository: WasteRepository,
  rows: readonly GenericImportRow[],
  counts: { rows: number; upserts: number }
) => {
  for (const row of rows) {
    await repository.upsertWasteTour({
      id: row.tour_id,
      name: row.tour_name,
      description: normalizeOptionalText(row.description),
      wasteFractionIds: parseDelimitedStringArray(row.waste_fraction_ids),
      recurrence: parseRecurrence(row.recurrence) ?? null,
      firstDate: normalizeOptionalText(row.first_date),
      endDate: normalizeOptionalText(row.end_date),
      customDates: parseCustomDates(row.custom_dates),
      active: parseBoolean(row.active, 'active'),
    });
    counts.upserts += 1;
  }

  return counts;
};

const executeDateShiftImport = async (
  repository: WasteRepository,
  rows: readonly GenericImportRow[],
  counts: { rows: number; upserts: number }
) => {
  for (const row of rows) {
    const shiftContext = normalizeOptionalText(row.shift_context);
    if (shiftContext !== 'global' && shiftContext !== 'tour') {
      throw new Error(`invalid_shift_context:${row.shift_context}`);
    }
    if (shiftContext === 'tour') {
      const tourId = normalizeOptionalText(row.tour_id);
      if (!tourId) throw new Error(`missing_tour_id:${row.shift_id}`);
      await repository.upsertWasteTourDateShift({
        id: row.shift_id,
        tourId,
        originalDate: row.original_date,
        actualDate: row.actual_date,
        hasYear: parseBoolean(row.has_year, 'has_year'),
        reasonType: parseReasonType(wasteManagementMasterDataContract, row.reason_type),
        reasonKey: normalizeOptionalText(row.reason_key),
        followUpMode: parseFollowUpMode(wasteManagementMasterDataContract, row.follow_up_mode),
        description: normalizeOptionalText(row.description),
      });
      counts.upserts += 1;
      continue;
    }
    await repository.upsertWasteGlobalDateShift({
      id: row.shift_id,
      originalDate: row.original_date,
      actualDate: row.actual_date,
      hasYear: parseBoolean(row.has_year, 'has_year'),
      reasonType: parseReasonType(wasteManagementMasterDataContract, row.reason_type),
      reasonKey: normalizeOptionalText(row.reason_key),
      description: normalizeOptionalText(row.description),
      tourIds: parseDelimitedStringArray(row.tour_ids),
    });
    counts.upserts += 1;
  }

  return counts;
};

export const executeImport = async (
  repository: WasteRepository,
  input: {
    readonly profileId: WasteManagementImportProfileId;
    readonly rows?: readonly GenericImportRow[];
    readonly parsedLocationTourPickupDates?: WasteLocationTourPickupDateImportParseResult;
    readonly reportProgress?: (progress: StudioJobProgress) => Promise<void> | void;
  }
) => {
  const rows = input.rows ?? [];
  const counts = { rows: rows.length, upserts: 0 };

  switch (input.profileId) {
    case 'waste-management.ortsbezogene-tourtermine':
      if (!input.parsedLocationTourPickupDates) {
        throw new Error('missing_location_tour_pickup_date_import');
      }
      return executeLocationTourPickupDateImport(repository, {
        parsedLocationTourPickupDates: input.parsedLocationTourPickupDates,
        reportProgress: input.reportProgress,
      });
    case 'waste-management.geografie-abholorte':
      return executeGeographyImport(repository, rows, counts);
    case 'waste-management.touren':
      return executeToursImport(repository, rows, counts);
    case 'waste-management.ausweichtermine':
      return executeDateShiftImport(repository, rows, counts);
  }
};
