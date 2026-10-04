import { wasteManagementMasterDataContract } from '@sva/waste-management-contracts';
import { z } from 'zod';

const wasteFractionReminderCountSchema = z.enum(
  wasteManagementMasterDataContract.fractionReminderCounts
);
const wasteFractionReminderLeadDaySchema = z
  .number()
  .int()
  .min(wasteManagementMasterDataContract.fractionReminderLeadDayMin)
  .max(wasteManagementMasterDataContract.fractionReminderLeadDayMax);

const wasteFractionReminderSlotSchema = z
  .object({
    id: z.string().trim().min(1),
    maxLeadDays: wasteFractionReminderLeadDaySchema,
    defaultLeadDays: wasteFractionReminderLeadDaySchema,
  })
  .superRefine((value, ctx) => {
    if (value.defaultLeadDays > value.maxLeadDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultLeadDays'],
        message: 'defaultLeadDays darf maxLeadDays nicht überschreiten.',
      });
    }
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
    const requiredSlotCount =
      value.reminderCount === 'none' ? 0 : value.reminderCount === 'once' ? 1 : 2;
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

    if (
      !value.reminderConfig.channels.push &&
      !value.reminderConfig.channels.email &&
      !value.reminderConfig.channels.calendar
    ) {
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
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Ungültiger Hex-Farbwert.'),
  description: z.string().trim().min(1).optional(),
  active: z.boolean(),
  reminderConfig: wasteFractionReminderConfigSchema,
});

const createWasteFractionSchema = withWasteFractionReminderValidation(wasteFractionSchemaBase);

const updateWasteFractionSchema = withWasteFractionReminderValidation(
  wasteFractionSchemaBase.omit({ id: true })
);

const createWasteRegionSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

const updateWasteRegionSchema = createWasteRegionSchema.omit({ id: true });

const createWasteCitySchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  postalCode: z.string().trim().max(16).optional(),
  regionId: z.string().trim().min(1).optional(),
});

const updateWasteCitySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    postalCode: z.string().trim().max(16).nullable().optional(),
    regionId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Mindestens ein Feld muss aktualisiert werden.',
  });

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
