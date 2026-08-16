import {
  createMainserverJsonRequestHeaders,
  type WasteManagementImportSourceFormat,
} from '@sva/plugin-sdk';

import type { StartWasteManagementExportInput } from './waste-management.api.types.js';
import {
  requestWasteManagementItem,
  requestWasteManagementJob,
} from './waste-management.api.shared.js';

export const uploadWasteManagementImportSource = async (
  file: File,
  sourceFormat: WasteManagementImportSourceFormat
): Promise<string> => {
  const headers = createMainserverJsonRequestHeaders({ 'Content-Type': sourceFormat });
  const result = await requestWasteManagementItem<Readonly<{ blobRef: string; sizeBytes: number }>>(
    {
      url: '/api/v1/waste-management/tools/imports/upload',
      init: { method: 'POST', headers, body: file },
    }
  );
  return result.blobRef;
};

export const startWasteManagementExport = async (input: StartWasteManagementExportInput) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/exports', input);
