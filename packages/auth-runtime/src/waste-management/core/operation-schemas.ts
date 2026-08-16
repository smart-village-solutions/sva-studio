import {
  wasteManagementDataProfileIds,
  wasteManagementOperationsContract,
  type WasteManagementDataProfileId,
} from '@sva/core';
import { z } from 'zod';

const wasteManagementDataProfileIdSchema = z.enum(
  Object.values(wasteManagementDataProfileIds) as [
    WasteManagementDataProfileId,
    ...WasteManagementDataProfileId[],
  ]
);

const startMigrationsSchema = z.object({
  targetSchema: z.string().trim().min(1).optional(),
  requestedByVersion: z.string().trim().min(1).optional(),
});

const startInitializeSchema = z.object({
  targetSchema: z.string().trim().min(1).optional(),
});

const pluginOperationInputRefSchema = z.string().regex(
  /^plugin-operation-input:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
);

const startImportSchema = z.object({
  importProfileId: z.string().trim().min(1),
  sourceFormat: z.string().trim().min(1),
  blobRef: pluginOperationInputRefSchema,
  dryRun: z.boolean().optional(),
  delimiterOverride: z.enum(wasteManagementOperationsContract.csvDelimiters).optional(),
});

const startExportSchema = z.object({
  profileIds: z.array(wasteManagementDataProfileIdSchema).min(1).max(9),
  targetFormat: z.enum(wasteManagementOperationsContract.exportTargetFormats),
});

const previewLocationTourPickupDateImportSchema = z.object({
  importProfileId: z.literal(
    wasteManagementOperationsContract.importProfileIds.locationTourPickupDates
  ),
  sourceFormat: z.literal('text/csv'),
  blobRef: pluginOperationInputRefSchema,
  delimiterOverride: z.enum(wasteManagementOperationsContract.csvDelimiters).optional(),
});

const startSeedSchema = z.object({
  seedKey: z.literal('baseline').default('baseline'),
});

const startMainserverSyncSchema = z.object({});

const startSyncWasteTypesSchema = z.object({});
const startEnrichPostalCodesSchema = z.object({});

const startResetSchema = z.object({
  confirmationToken: z
    .string()
    .trim()
    .refine(
      (value) => value === wasteManagementOperationsContract.resetConfirmationToken,
      `Bestätigungstoken muss exakt "${wasteManagementOperationsContract.resetConfirmationToken}" entsprechen.`
    ),
});

export const wasteManagementOperationSchemas = {
  startInitializeSchema,
  startMigrationsSchema,
  startImportSchema,
  startExportSchema,
  previewLocationTourPickupDateImportSchema,
  startSeedSchema,
  startMainserverSyncSchema,
  startSyncWasteTypesSchema,
  startEnrichPostalCodesSchema,
  startResetSchema,
} as const;
