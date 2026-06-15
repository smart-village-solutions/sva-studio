import {
  wasteManagementCsvDelimiters,
  wasteManagementImportProfileIds,
  wasteManagementImportSourceFormats,
  wasteManagementJobTypeIds,
  wasteManagementResetConfirmationToken,
  type WasteManagementCsvDelimiter,
  type WasteManagementImportProfileId,
  type WasteManagementImportSourceFormat,
  type WasteManagementJobTypeId,
} from './waste-management-operations-contract.constants.js';

const wasteManagementOperationsContract = {
  pluginId: 'waste-management',
  queueName: 'plugin-operations',
  jobTypeIds: wasteManagementJobTypeIds,
  resetConfirmationToken: wasteManagementResetConfirmationToken,
  importProfileIds: wasteManagementImportProfileIds,
  importSourceFormats: wasteManagementImportSourceFormats,
  csvDelimiters: wasteManagementCsvDelimiters,
  isJobTypeId: (value: string): value is WasteManagementJobTypeId =>
    (Object.values(wasteManagementJobTypeIds) as readonly string[]).includes(value),
  isImportProfileId: (value: string): value is WasteManagementImportProfileId =>
    (Object.values(wasteManagementImportProfileIds) as readonly string[]).includes(value),
  isImportSourceFormat: (value: string): value is WasteManagementImportSourceFormat =>
    (wasteManagementImportSourceFormats as readonly string[]).includes(value),
  isCsvDelimiter: (value: string): value is WasteManagementCsvDelimiter =>
    (wasteManagementCsvDelimiters as readonly string[]).includes(value),
} as const;

export { wasteManagementOperationsContract };
