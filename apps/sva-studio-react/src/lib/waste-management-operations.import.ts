import { getWasteManagementImportCatalogEntry, wasteManagementMasterDataContract, type WasteManagementImportProfileId, type WasteManagementImportSourceFormat } from '@sva/core';
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

const parseImportWorkbookRows = (source: Uint8Array): readonly Record<string, string>[] => {
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

export const parseImportRows = async (
  deps: WasteOperationRuntimeDeps,
  input: {
    readonly profileId: WasteManagementImportProfileId;
    readonly sourceFormat: WasteManagementImportSourceFormat;
    readonly blobRef?: string;
  }
): Promise<readonly Record<string, string>[]> => {
  if (!input.blobRef) throw new Error('missing_blob_ref');
  const catalogEntry = getWasteManagementImportCatalogEntry(input.profileId);
  if (!catalogEntry) throw new Error(`unknown_import_profile:${input.profileId}`);
  const source = await (deps.readBinarySource ?? defaultReadBinarySource)(input.blobRef);
  const rows = parseImportWorkbookRows(source);
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  ensureRequiredColumns(headers, catalogEntry.requiredColumns, input.profileId);
  return rows;
};

export const executeImport = async (
  repository: ReturnType<typeof createWasteMasterDataRepository>,
  input: {
    readonly profileId: WasteManagementImportProfileId;
    readonly rows: readonly Record<string, string>[];
  }
) => {
  const counts = { rows: input.rows.length, upserts: 0 };

  if (input.profileId === 'waste-management.geografie-abholorte') {
    for (const row of input.rows) {
      await repository.upsertWasteRegion({ id: row.region_id, name: row.region_name });
      await repository.upsertWasteCity({ id: row.city_id, name: row.city_name, regionId: row.region_id });
      counts.upserts += 2;
      if (normalizeOptionalText(row.street_id) && normalizeOptionalText(row.street_name)) {
        await repository.upsertWasteStreet({ id: row.street_id, name: row.street_name, cityId: row.city_id });
        counts.upserts += 1;
      }
      if (normalizeOptionalText(row.house_number_id) && normalizeOptionalText(row.house_number_value) && normalizeOptionalText(row.street_id)) {
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
    for (const row of input.rows) {
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

  for (const row of input.rows) {
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
