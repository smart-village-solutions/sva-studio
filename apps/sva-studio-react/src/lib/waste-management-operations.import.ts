import { Readable } from 'node:stream';

import ExcelJS from 'exceljs';
import {
  getWasteManagementImportCatalogEntry,
  parseWasteLocationTourPickupDateCsv,
  type WasteLocationTourPickupDateImportParseResult,
  type WasteLocationTourPickupDateImportPreview,
  type WasteManagementImportProfileId,
  type WasteManagementImportSourceFormat,
} from '@sva/waste-management-contracts';

import {
  planLocationTourPickupDateImport,
  type WasteRepository,
} from './waste-management-operations.import.plan.js';
import {
  executeDateShiftImport,
  executeGeographyImport,
  executeToursImport,
} from './waste-management-operations.import.persist.js';
import {
  defaultReadBinarySource,
  ensureRequiredColumns,
} from './waste-management-operations.shared.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';
import type { StudioJobProgress } from '@sva/core';

type GenericImportRow = Record<string, string>;

const toArrayBuffer = (source: Uint8Array): ArrayBuffer => {
  const slicedBuffer = source.buffer.slice(
    source.byteOffset,
    source.byteOffset + source.byteLength
  );
  return slicedBuffer instanceof ArrayBuffer ? slicedBuffer : new ArrayBuffer(0);
};
const { Workbook } = ExcelJS;

const readWorkbookWorksheet = async (
  source: Uint8Array,
  sourceFormat: WasteManagementImportSourceFormat
) => {
  const workbook = new Workbook();
  if (sourceFormat === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    await workbook.xlsx.load(toArrayBuffer(source));
    return workbook.worksheets[0];
  }
  if (sourceFormat === 'text/csv') {
    return await workbook.csv.read(Readable.from([decodeTextSource(source)]), {
      map: (value) => String(value ?? ''),
      parserOptions: {
        delimiter: ',',
      },
      sheetName: 'Import',
    });
  }
  throw new Error(`unsupported_import_source_format:${sourceFormat}`);
};

const parseImportWorksheetRows = (
  worksheet: ExcelJS.Worksheet | undefined
): readonly GenericImportRow[] => {
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
    rows.push(Object.fromEntries(headers.map(({ key }, index) => [key, cells[index] ?? ''])));
  }

  return rows;
};

const decodeTextSource = (source: Uint8Array): string => new TextDecoder('utf-8').decode(source);

export const parseImportRows = async (
  deps: WasteOperationRuntimeDeps,
  input: {
    readonly instanceId?: string;
    readonly profileId: WasteManagementImportProfileId;
    readonly sourceFormat: WasteManagementImportSourceFormat;
    readonly blobRef?: string;
  }
): Promise<readonly GenericImportRow[]> => {
  if (!input.blobRef) throw new Error('missing_blob_ref');
  const catalogEntry = getWasteManagementImportCatalogEntry(input.profileId);
  if (!catalogEntry) throw new Error(`unknown_import_profile:${input.profileId}`);
  const source = deps.readBinarySource
    ? await deps.readBinarySource(input.blobRef)
    : await defaultReadBinarySource(input.blobRef, input.instanceId);
  const worksheet = await readWorkbookWorksheet(source, input.sourceFormat);
  const rows = parseImportWorksheetRows(worksheet);
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  ensureRequiredColumns(headers, catalogEntry.requiredColumns, input.profileId);
  return rows;
};

export const parseLocationTourPickupDateImport = async (
  deps: WasteOperationRuntimeDeps,
  input: {
    readonly instanceId?: string;
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
  const source = deps.readBinarySource
    ? await deps.readBinarySource(input.blobRef)
    : await defaultReadBinarySource(input.blobRef, input.instanceId);
  return parseWasteLocationTourPickupDateCsv({
    text: decodeTextSource(source),
    delimiterOverride: input.delimiterOverride,
  });
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
