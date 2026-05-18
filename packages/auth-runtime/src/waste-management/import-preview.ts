import {
  parseWasteLocationTourPickupDateCsv,
  planWasteLocationTourPickupDateImport,
  type WasteLocationTourPickupDateImportPlanningSnapshot,
  type WasteLocationTourPickupDateImportPreview,
  type WasteManagementCsvDelimiter,
  type WasteManagementImportSourceFormat,
} from '@sva/core';
import type { createWasteMasterDataRepository } from '@sva/data-repositories';

type WasteRepository = ReturnType<typeof createWasteMasterDataRepository>;

const decodeBlobRef = (blobRef: string): string => {
  if (!blobRef.startsWith('data:')) {
    throw new Error('unsupported_blob_ref:local_file');
  }
  const separatorIndex = blobRef.indexOf(',');
  if (separatorIndex < 0) {
    throw new Error('invalid_blob_ref:data_url');
  }
  const metadata = blobRef.slice(5, separatorIndex);
  const payload = blobRef.slice(separatorIndex + 1);
  const buffer = metadata.endsWith(';base64')
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');
  return new TextDecoder('utf-8').decode(buffer);
};

const loadPlanningSnapshot = async (repository: WasteRepository): Promise<WasteLocationTourPickupDateImportPlanningSnapshot> => {
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

export const previewWasteLocationTourPickupDateImport = async (
  repository: WasteRepository,
  input: {
    readonly sourceFormat: WasteManagementImportSourceFormat;
    readonly blobRef: string;
    readonly delimiterOverride?: WasteManagementCsvDelimiter;
  }
): Promise<WasteLocationTourPickupDateImportPreview> => {
  if (input.sourceFormat !== 'text/csv') {
    throw new Error(`unsupported_import_source_format:${input.sourceFormat}`);
  }

  const parsed = parseWasteLocationTourPickupDateCsv({
    text: decodeBlobRef(input.blobRef),
    delimiterOverride: input.delimiterOverride,
  });
  const plan = planWasteLocationTourPickupDateImport(await loadPlanningSnapshot(repository), {
    rows: parsed.rows,
  });

  return {
    profileId: 'waste-management.ortsbezogene-tourtermine',
    delimiter: parsed.delimiter,
    detectedDelimiter: parsed.detectedDelimiter,
    fractionNames: parsed.fractionNames,
    existingFractions: plan.existingFractions,
    newFractions: plan.newFractions,
    existingTours: plan.existingTours,
    newTours: plan.newTours,
    validRowCount: parsed.validRowCount,
    invalidRowCount: parsed.invalidRowCount,
    errors: parsed.issues,
    summary: plan.summary,
  };
};
