import { wasteManagementMasterDataContract, wasteManagementOperationsContract, type WasteTourRecurrence } from '@sva/core';
import { z } from 'zod';

const createWasteFractionSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  translations: z.record(z.string().trim().min(1), z.string().trim().min(1)).optional(),
  containerSize: z.string().trim().min(1).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültiger Hex-Farbwert.'),
  description: z.string().trim().min(1).optional(),
  active: z.boolean(),
});

const updateWasteFractionSchema = createWasteFractionSchema.omit({ id: true });

const createWasteRegionSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

const updateWasteRegionSchema = createWasteRegionSchema.omit({ id: true });

const createWasteCitySchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  regionId: z.string().trim().min(1).optional(),
});

const updateWasteCitySchema = createWasteCitySchema.omit({ id: true });

const createWasteStreetSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  cityId: z.string().trim().min(1),
});

const updateWasteStreetSchema = createWasteStreetSchema.omit({ id: true });

const createWasteHouseNumberSchema = z.object({
  id: z.string().trim().min(1),
  number: z.string().trim().min(1),
  streetId: z.string().trim().min(1),
});

const updateWasteHouseNumberSchema = createWasteHouseNumberSchema.omit({ id: true });

const createWasteCollectionLocationSchema = z.object({
  id: z.string().trim().min(1),
  cityId: z.string().trim().min(1),
  regionId: z.string().trim().min(1).optional(),
  streetId: z.string().trim().min(1).optional(),
  houseNumberId: z.string().trim().min(1).optional(),
  active: z.boolean(),
});

const updateWasteCollectionLocationSchema = createWasteCollectionLocationSchema.omit({ id: true });

const wasteTourRecurrenceSchema = z.enum(
  ['weekly', 'biweekly', 'fourweekly', 'yearly', 'on-demand', 'custom'] satisfies readonly WasteTourRecurrence[]
);

const wasteTourDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum im Format JJJJ-MM-TT.');

const createWasteLocationTourLinkSchema = z.object({
  id: z.string().trim().min(1),
  locationId: z.string().trim().min(1),
  tourId: z.string().trim().min(1),
  startDate: wasteTourDateSchema.optional(),
  endDate: wasteTourDateSchema.optional(),
});

const updateWasteLocationTourLinkSchema = createWasteLocationTourLinkSchema.omit({ id: true });

const createWasteLocationTourLinksBulkSchema = z.object({
  locationIds: z.array(z.string().trim().min(1)).min(1).max(100),
  tourId: z.string().trim().min(1),
  startDate: wasteTourDateSchema.optional(),
  endDate: wasteTourDateSchema.optional(),
});

const wasteCustomTourDateSchema = z.object({
  date: wasteTourDateSchema,
  description: z.string().trim().min(1).optional(),
});

const createWasteTourSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  wasteFractionIds: z.array(z.string().trim().min(1)).min(1),
  recurrence: wasteTourRecurrenceSchema.nullish(),
  firstDate: wasteTourDateSchema.optional(),
  endDate: wasteTourDateSchema.optional(),
  customDates: z.array(wasteCustomTourDateSchema).optional(),
  active: z.boolean(),
});

const updateWasteTourSchema = createWasteTourSchema.omit({ id: true });

const createWasteTourDateShiftSchema = z.object({
  id: z.string().trim().min(1),
  tourId: z.string().trim().min(1),
  originalDate: wasteTourDateSchema,
  actualDate: wasteTourDateSchema,
  hasYear: z.boolean(),
  reasonType: z.enum(wasteManagementMasterDataContract.dateShiftReasonTypes).optional(),
  reasonKey: z.string().trim().min(1).optional(),
  followUpMode: z.enum(wasteManagementMasterDataContract.followUpModes).optional(),
  description: z.string().trim().min(1).optional(),
});

const updateWasteTourDateShiftSchema = createWasteTourDateShiftSchema.omit({ id: true });

const createWasteGlobalDateShiftSchema = z.object({
  id: z.string().trim().min(1),
  originalDate: wasteTourDateSchema,
  actualDate: wasteTourDateSchema,
  hasYear: z.boolean(),
  reasonType: z.enum(wasteManagementMasterDataContract.dateShiftReasonTypes).optional(),
  reasonKey: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  tourIds: z.array(z.string().trim().min(1)).optional(),
});

const updateWasteGlobalDateShiftSchema = createWasteGlobalDateShiftSchema.omit({ id: true });

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
});

const startSeedSchema = z.object({
  seedKey: z.literal('baseline').default('baseline'),
});

const startResetSchema = z.object({
  confirmationToken: z.string().trim().refine(
    (value) => value === wasteManagementOperationsContract.resetConfirmationToken,
    `Bestätigungstoken muss exakt "${wasteManagementOperationsContract.resetConfirmationToken}" entsprechen.`
  ),
});

export const wasteManagementMasterDataSchemas = {
  createWasteFractionSchema,
  updateWasteFractionSchema,
  createWasteRegionSchema,
  updateWasteRegionSchema,
  createWasteCitySchema,
  updateWasteCitySchema,
  createWasteStreetSchema,
  updateWasteStreetSchema,
  createWasteHouseNumberSchema,
  updateWasteHouseNumberSchema,
  createWasteCollectionLocationSchema,
  updateWasteCollectionLocationSchema,
} as const;

export const wasteManagementTourSchemas = {
  wasteCustomTourDateSchema,
  wasteTourDateSchema,
  createWasteLocationTourLinkSchema,
  updateWasteLocationTourLinkSchema,
  createWasteLocationTourLinksBulkSchema,
  createWasteTourSchema,
  updateWasteTourSchema,
  createWasteTourDateShiftSchema,
  updateWasteTourDateShiftSchema,
  createWasteGlobalDateShiftSchema,
  updateWasteGlobalDateShiftSchema,
} as const;

export const wasteManagementOperationSchemas = {
  startInitializeSchema,
  startMigrationsSchema,
  startImportSchema,
  startSeedSchema,
  startResetSchema,
} as const;
