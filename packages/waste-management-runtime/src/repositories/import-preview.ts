import {
  parseWasteLocationTourPickupDateCsv,
  type WasteLocationTourPickupDateImportPreview,
  type WasteManagementCsvDelimiter,
  type WasteManagementImportSourceFormat,
} from '@sva/waste-management-contracts';
import { previewLocationTourPickupDateImport } from '../operations/waste-management-operations.import.plan.js';
import type { createWasteMasterDataRepository } from './master-data.js';

type WasteRepository = ReturnType<typeof createWasteMasterDataRepository>;

const decodeBlobRef = async (
  instanceId: string,
  blobRef: string,
  readStoredSource: (input: {
    instanceId: string;
    blobRef: string;
  }) => Promise<{ body: Uint8Array }>
): Promise<string> => {
  if (blobRef.startsWith('plugin-operation-input:')) {
    const stored = await readStoredSource({ instanceId, blobRef });
    return new TextDecoder('utf-8').decode(stored.body);
  }
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

export const previewWasteLocationTourPickupDateImport = async (
  repository: WasteRepository,
  input: {
    readonly instanceId: string;
    readonly sourceFormat: WasteManagementImportSourceFormat;
    readonly blobRef: string;
    readonly delimiterOverride?: WasteManagementCsvDelimiter;
  },
  readStoredSource: (input: {
    instanceId: string;
    blobRef: string;
  }) => Promise<{ body: Uint8Array }>
): Promise<WasteLocationTourPickupDateImportPreview> => {
  if (input.sourceFormat !== 'text/csv') {
    throw new Error(`unsupported_import_source_format:${input.sourceFormat}`);
  }

  const parsed = parseWasteLocationTourPickupDateCsv({
    text: await decodeBlobRef(input.instanceId, input.blobRef, readStoredSource),
    delimiterOverride: input.delimiterOverride,
  });
  return previewLocationTourPickupDateImport(repository, parsed);
};
