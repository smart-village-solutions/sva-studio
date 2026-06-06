import { randomUUID } from 'node:crypto';

import {
  getWasteManagementImportCatalogEntry,
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
import * as XLSX from 'xlsx';

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

const parseImportWorkbookRows = (source: Uint8Array): readonly GenericImportRow[] => {
  const workbook = XLSX.read(source, { type: 'array', raw: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils
    .sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : String(value ?? '')])
      )
    );
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
  const rows = parseImportWorkbookRows(source);
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

const persistLocationTourPickupDateImportPlan = async (
  repository: WasteRepository,
  plan: WasteLocationTourPickupDateImportPlan
) => {
  for (const region of plan.upserts.regions) {
    await repository.upsertWasteRegion({ id: region.id, name: region.name });
  }
  for (const city of plan.upserts.cities) {
    await repository.upsertWasteCity({ id: city.id, name: city.name, regionId: city.regionId });
  }
  for (const street of plan.upserts.streets) {
    await repository.upsertWasteStreet({ id: street.id, name: street.name, cityId: street.cityId });
  }
  for (const houseNumber of plan.upserts.houseNumbers) {
    await repository.upsertWasteHouseNumber({
      id: houseNumber.id,
      number: houseNumber.number,
      streetId: houseNumber.streetId,
    });
  }
  for (const location of plan.upserts.locations) {
    await repository.upsertWasteCollectionLocation({
      id: location.id,
      cityId: location.cityId,
      regionId: location.regionId,
      streetId: location.streetId,
      houseNumberId: location.houseNumberId,
      active: location.active,
    });
  }
  for (const fraction of plan.upserts.fractions) {
    await repository.upsertWasteFraction({
      id: fraction.id,
      name: fraction.name,
      translations: fraction.translations,
      containerSize: fraction.containerSize,
      color: fraction.color,
      description: fraction.description,
      active: fraction.active,
      reminderCount: fraction.reminderCount,
      firstReminderMaxLeadDays: fraction.firstReminderMaxLeadDays,
      secondReminderMaxLeadDays: fraction.secondReminderMaxLeadDays,
      reminderChannelPushEnabled: fraction.reminderChannelPushEnabled,
      reminderChannelEmailEnabled: fraction.reminderChannelEmailEnabled,
      reminderChannelCalendarEnabled: fraction.reminderChannelCalendarEnabled,
    });
  }
  for (const tour of plan.upserts.tours) {
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
  }
  for (const assignment of plan.upserts.assignments) {
    await repository.upsertWasteLocationTourLink({
      id: assignment.id,
      locationId: assignment.locationId,
      tourId: assignment.tourId,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
    });
  }
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

  const plan = planWasteLocationTourPickupDateImport(await loadPlanningSnapshot(repository), {
    rows: input.parsed.rows,
  }, {
    createId: () => randomUUID(),
  });

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
    await persistLocationTourPickupDateImportPlan(repository, plan);
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

export const executeImport = async (
  repository: WasteRepository,
  input: {
    readonly profileId: WasteManagementImportProfileId;
    readonly rows?: readonly GenericImportRow[];
    readonly parsedLocationTourPickupDates?: WasteLocationTourPickupDateImportParseResult;
    readonly reportProgress?: (progress: StudioJobProgress) => Promise<void> | void;
  }
) => {
  if (input.profileId === 'waste-management.ortsbezogene-tourtermine') {
    if (!input.parsedLocationTourPickupDates) {
      throw new Error('missing_location_tour_pickup_date_import');
    }
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
  }

  const rows = input.rows ?? [];
  const counts = { rows: rows.length, upserts: 0 };

  if (input.profileId === 'waste-management.geografie-abholorte') {
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
  }

  if (input.profileId === 'waste-management.touren') {
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
  }

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
