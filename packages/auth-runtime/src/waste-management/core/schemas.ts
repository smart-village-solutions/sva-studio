import {
  wasteManagementMasterDataContract,
  type WasteTourRecurrence,
} from '@sva/core';
import { z } from 'zod';

const wasteFractionReminderCountSchema = z.enum(wasteManagementMasterDataContract.fractionReminderCounts);
const wasteFractionReminderLeadDaySchema = z
  .number()
  .int()
  .min(wasteManagementMasterDataContract.fractionReminderLeadDayMin)
  .max(wasteManagementMasterDataContract.fractionReminderLeadDayMax);

const wasteFractionReminderSlotSchema = z.object({
  id: z.string().trim().min(1),
  maxLeadDays: wasteFractionReminderLeadDaySchema,
  defaultLeadDays: wasteFractionReminderLeadDaySchema,
});

const wasteFractionReminderChannelSchema = z.object({
  slots: z.array(wasteFractionReminderSlotSchema).max(2),
});

const wasteFractionReminderConfigSchema = z
  .object({
    reminderCount: wasteFractionReminderCountSchema,
    channels: z.object({
      push: z.boolean(),
      email: z.boolean(),
      calendar: z.boolean(),
    }),
    push: wasteFractionReminderChannelSchema.optional(),
    email: wasteFractionReminderChannelSchema.optional(),
    calendar: wasteFractionReminderChannelSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const requiredSlotCount = value.reminderCount === 'none' ? 0 : value.reminderCount === 'once' ? 1 : 2;
    const channels: Array<keyof typeof value.channels> = ['push', 'email', 'calendar'];

    if (requiredSlotCount === 0) {
      return;
    }

    for (const channel of channels) {
      if (!value.channels[channel]) {
        continue;
      }

      const channelConfig = value[channel];
      if (!channelConfig || channelConfig.slots.length < requiredSlotCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [channel, 'slots'],
          message: `Für den Kanal "${channel}" werden ${requiredSlotCount} Reminder-Slot(s) benötigt.`,
        });
      }
    }
  });

const withWasteFractionReminderValidation = <
  TSchema extends z.ZodObject<{ reminderConfig: typeof wasteFractionReminderConfigSchema }>,
>(
  schema: TSchema
) =>
  schema.superRefine((value: z.infer<TSchema>, ctx) => {
    if (value.reminderConfig.reminderCount === 'none') {
      return;
    }

    if (!value.reminderConfig.channels.push && !value.reminderConfig.channels.email && !value.reminderConfig.channels.calendar) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reminderConfig', 'channels'],
        message: 'Mindestens ein Kanal muss aktiviert sein, wenn Erinnerungen konfiguriert sind.',
      });
    }
  });

const wasteFractionSchemaBase = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  pdfShortLabel: z.string().trim().min(1).max(12),
  translations: z.record(z.string().trim().min(1), z.string().trim().min(1)).optional(),
  containerSize: z.string().trim().min(1).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültiger Hex-Farbwert.'),
  description: z.string().trim().min(1).optional(),
  active: z.boolean(),
  reminderConfig: wasteFractionReminderConfigSchema,
});

const createWasteFractionSchema = withWasteFractionReminderValidation(wasteFractionSchemaBase);

const updateWasteFractionSchema = withWasteFractionReminderValidation(wasteFractionSchemaBase.omit({ id: true }));

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

const wasteCustomRecurrencePresetSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  intervalDays: z.number().int().positive(),
});

const wasteHolidayStateCodeSchema = z.enum(wasteManagementMasterDataContract.holidayStateCodes);
const optionalWasteUrlSchema = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || z.string().url().safeParse(value).success, 'Ungültige URL.');

const updateWasteSettingsSchema = z.object({
  provider: z.literal('supabase'),
  projectUrl: z.string().trim(),
  schemaName: z.string().trim().optional(),
  enabled: z.boolean(),
  selectedInterfaceId: z.string().trim().min(1).optional(),
  calendarWebUrl: optionalWasteUrlSchema.optional(),
  pdfBrandingAssetUrl: optionalWasteUrlSchema.optional(),
  pdfContactBlock: z.string().trim().max(2_000).optional(),
  holidayStateCode: wasteHolidayStateCodeSchema.optional(),
  customRecurrencePresets: z.array(wasteCustomRecurrencePresetSchema).default([]),
  deletedPresetFallbacks: z
    .record(
      z.string().trim().min(1),
      z.object({
        kind: z.enum(['preset', 'default']),
        value: z.string().trim().min(1),
      })
    )
    .default({}),
});

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
  duplicateFromTourId: z.string().trim().min(1).optional(),
  recurrence: wasteTourRecurrenceSchema.nullish(),
  customRecurrenceId: z.string().trim().min(1).optional(),
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

const updateWasteHolidayRuleSchema = z.object({
  scope: z.enum(wasteManagementMasterDataContract.holidayRuleScopes).optional(),
  strategy: z.enum(wasteManagementMasterDataContract.holidayRuleStrategies).optional(),
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

export const wasteManagementSettingsSchemas = {
  wasteCustomRecurrencePresetSchema,
  updateWasteSettingsSchema,
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
  updateWasteHolidayRuleSchema,
} as const;
