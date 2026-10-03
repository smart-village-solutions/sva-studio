import {
  isValidWasteIsoDateOnly,
  wasteAnnualTourTransferLimits,
  wasteManagementMasterDataContract,
  wasteTourStatusBulkLimit,
  wasteTourStatuses,
  type WasteTourRecurrence,
} from '@sva/waste-management-contracts';
import { z } from 'zod';

const wasteTourRecurrenceSchema = z.enum([
  'weekly',
  'biweekly',
  'fourweekly',
  'yearly',
  'on-demand',
  'custom',
] satisfies readonly WasteTourRecurrence[]);

const wasteTourDateSchema = z
  .string()
  .trim()
  .refine(isValidWasteIsoDateOnly, 'Ungültiges Datum im Format JJJJ-MM-TT.');

const createWasteLocationTourLinkSchema = z.object({
  id: z.string().trim().min(1),
  locationId: z.string().trim().min(1),
  tourId: z.string().trim().min(1),
});

const updateWasteLocationTourLinkSchema = createWasteLocationTourLinkSchema.omit({ id: true });

const createWasteLocationTourPickupDateSchema = z.object({
  id: z.string().trim().min(1),
  locationId: z.string().trim().min(1),
  tourId: z.string().trim().min(1),
  pickupDate: wasteTourDateSchema,
  note: z.string().trim().min(1).optional(),
});

const updateWasteLocationTourPickupDateSchema = createWasteLocationTourPickupDateSchema.omit({
  id: true,
});

const createWasteTourAssignmentSchema = z.object({
  id: z.string().trim().min(1),
  tourId: z.string().trim().min(1),
  pickupDate: wasteTourDateSchema,
  note: z.string().trim().min(1).optional(),
  locationIds: z.array(z.string().trim().min(1)).min(1).max(100),
});
const updateWasteTourAssignmentSchema = createWasteTourAssignmentSchema.omit({ id: true });

const createWasteLocationTourLinksBulkSchema = z.object({
  locationIds: z.array(z.string().trim().min(1)).min(1).max(100),
  tourId: z.string().trim().min(1),
});

const wasteCustomTourDateSchema = z.object({
  date: wasteTourDateSchema,
  description: z.string().trim().min(1).optional(),
});

const wasteTourSchemaBase = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  wasteFractionIds: z.array(z.string().trim().min(1)).min(1),
  duplicateFromTourId: z.string().trim().min(1).optional(),
  recurrence: wasteTourRecurrenceSchema.nullish(),
  customRecurrenceId: z.string().trim().min(1).optional(),
  firstDate: wasteTourDateSchema.optional(),
  endDate: wasteTourDateSchema.optional(),
  customDates: z.array(wasteCustomTourDateSchema).optional(),
});

const createWasteTourSchema = wasteTourSchemaBase.extend({
  status: z.literal('draft').optional().default('draft'),
});

const updateWasteTourSchema = wasteTourSchemaBase.omit({ id: true }).extend({
  status: z.enum(wasteTourStatuses),
});

const wasteAnnualTourReplacementDateSchema = z
  .object({
    sourceResourceId: z.string().trim().min(1),
    targetDate: wasteTourDateSchema,
  })
  .strict();

const previewWasteAnnualTourTransferSchema = z
  .object({
    sourceYear: z.number().int(),
    selectedTourIds: z
      .array(z.string().trim().min(1))
      .max(wasteAnnualTourTransferLimits.tours)
      .optional(),
    replacementDates: z
      .array(wasteAnnualTourReplacementDateSchema)
      .max(wasteAnnualTourTransferLimits.relationships)
      .optional(),
  })
  .strict();

const createWasteAnnualTourTransferSchema = z
  .object({
    sourceYear: z.number().int(),
    selectedTourIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(wasteAnnualTourTransferLimits.tours),
    replacementDates: z
      .array(wasteAnnualTourReplacementDateSchema)
      .max(wasteAnnualTourTransferLimits.relationships),
    acknowledgedConflictTourIds: z
      .array(z.string().trim().min(1))
      .max(wasteAnnualTourTransferLimits.tours),
    previewFingerprint: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  })
  .strict();

const wasteTourValidityDateOperationSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('unchanged') }).strict(),
  z.object({ mode: z.literal('clear') }).strict(),
  z.object({ mode: z.literal('set'), value: wasteTourDateSchema }).strict(),
]);

const updateWasteTourValidityBulkSchema = z
  .object({
    tourIds: z.array(z.string().trim().min(1)).min(1).max(100),
    firstDate: wasteTourValidityDateOperationSchema,
    endDate: wasteTourValidityDateOperationSchema,
  })
  .superRefine((value, ctx) => {
    const normalizedTourIds = value.tourIds.map((tourId) => tourId.trim());
    if (new Set(normalizedTourIds).size !== normalizedTourIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'tourIds dürfen keine Duplikate enthalten.',
        path: ['tourIds'],
      });
    }
    if (value.firstDate.mode === 'unchanged' && value.endDate.mode === 'unchanged') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Mindestens eine Datumsgrenze muss geändert werden.',
        path: ['firstDate'],
      });
    }
    if (value.firstDate.mode === 'clear') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Der Gültigkeitsbeginn ist der Startanker des Turnus und darf nicht entfernt werden.',
        path: ['firstDate'],
      });
    }
  });

const updateWasteTourStatusBulkSchema = z
  .object({
    tourIds: z.array(z.string().trim().uuid()).min(1).max(wasteTourStatusBulkLimit),
    status: z.enum(wasteTourStatuses),
  })
  .strict()
  .superRefine((value, ctx) => {
    const normalizedTourIds = value.tourIds.map((tourId) => tourId.trim());
    if (new Set(normalizedTourIds).size !== normalizedTourIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'tourIds dürfen keine Duplikate enthalten.',
        path: ['tourIds'],
      });
    }
  });

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

const updateWasteHolidayRuleSchema = z.object({
  scope: z.enum(wasteManagementMasterDataContract.holidayRuleScopes).optional(),
  strategy: z.enum(wasteManagementMasterDataContract.holidayRuleStrategies).optional(),
});

export const wasteManagementTourSchemas = {
  wasteCustomTourDateSchema,
  wasteTourDateSchema,
  createWasteLocationTourLinkSchema,
  updateWasteLocationTourLinkSchema,
  createWasteLocationTourPickupDateSchema,
  updateWasteLocationTourPickupDateSchema,
  createWasteTourAssignmentSchema,
  updateWasteTourAssignmentSchema,
  createWasteLocationTourLinksBulkSchema,
  createWasteTourSchema,
  updateWasteTourSchema,
  previewWasteAnnualTourTransferSchema,
  createWasteAnnualTourTransferSchema,
  updateWasteTourValidityBulkSchema,
  updateWasteTourStatusBulkSchema,
  createWasteTourDateShiftSchema,
  updateWasteTourDateShiftSchema,
  createWasteGlobalDateShiftSchema,
  updateWasteGlobalDateShiftSchema,
  updateWasteHolidayRuleSchema,
} as const;
