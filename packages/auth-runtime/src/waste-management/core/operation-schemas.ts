import { wasteManagementOperationsContract } from '@sva/core';
import { z } from 'zod';

const startMigrationsSchema = z.object({
  targetSchema: z.string().trim().min(1).optional(),
  requestedByVersion: z.string().trim().min(1).optional(),
});

const startInitializeSchema = z.object({
  targetSchema: z.string().trim().min(1).optional(),
});

const startImportSchema = z.object({
  importProfileId: z.string().trim().min(1),
  sourceFormat: z.string().trim().min(1),
  blobRef: z.string().trim().min(1),
  dryRun: z.boolean().optional(),
  delimiterOverride: z.enum(wasteManagementOperationsContract.csvDelimiters).optional(),
});

const startExportSchema = z.object({
  profileIds: z.array(z.string().trim().min(1)).min(1).max(9),
  targetFormat: z.enum(wasteManagementOperationsContract.exportTargetFormats),
});

const previewLocationTourPickupDateImportSchema = z.object({
  importProfileId: z.literal(
    wasteManagementOperationsContract.importProfileIds.locationTourPickupDates
  ),
  sourceFormat: z.literal('text/csv'),
  blobRef: z.string().trim().min(1),
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
