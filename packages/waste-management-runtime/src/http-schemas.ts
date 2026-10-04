import { isPlausibleEmailAddress } from '@sva/core';
import { wasteManagementMasterDataContract } from '@sva/waste-management-contracts';
import { z } from 'zod';
export { wasteManagementMasterDataSchemas } from './http-schemas.master-data.js';
export { wasteManagementTourSchemas } from './http-schemas.tours.js';

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
  .refine(
    (value) => value.length === 0 || z.string().url().safeParse(value).success,
    'Ungültige URL.'
  );
const optionalEmailSchema = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || isPlausibleEmailAddress(value),
    'Ungültige E-Mail-Adresse.'
  );
const optionalRelativePathSchema = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || (/^\/(?!\/)/.test(value) && !/^[a-z]+:/i.test(value)),
    'Ungültiger relativer Pfad.'
  );
const requiredRelativePathSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => /^\/(?!\/)/.test(value) && !/^[a-z]+:/i.test(value),
    'Ungültiger relativer Pfad.'
  );
const wastePublicBaseUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'https:') {
        return true;
      }

      return (
        parsed.protocol === 'http:' &&
        (parsed.hostname === 'localhost' ||
          parsed.hostname.endsWith('.localhost') ||
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname === '[::1]' ||
          parsed.hostname === '::1')
      );
    } catch {
      return false;
    }
  }, 'Ungültige Public-Base-URL.');
const wastePositiveIntegerSchema = z.number().int().positive();
const wasteEmailReminderConfigSchema = z.object({
  enabled: z.boolean(),
  publicSignupEnabled: z.boolean(),
  transportId: z.string().trim().min(1),
  publicBaseUrl: wastePublicBaseUrlSchema,
  doiConfirmPath: requiredRelativePathSchema,
  unsubscribePath: requiredRelativePathSchema,
  signupSuccessPath: optionalRelativePathSchema.optional(),
  activationSuccessPath: optionalRelativePathSchema.optional(),
  unsubscribeSuccessPath: optionalRelativePathSchema.optional(),
  invalidTokenPath: optionalRelativePathSchema.optional(),
  fromName: z.string().trim().min(1),
  fromEmail: optionalEmailSchema.refine((value) => value.length > 0, 'Ungültige E-Mail-Adresse.'),
  replyToEmail: optionalEmailSchema.optional(),
  serviceLabel: z.string().trim().optional(),
  privacyPolicyUrl: z.string().trim().url('Ungültige URL.'),
  imprintUrl: z.string().trim().url('Ungültige URL.'),
  consentLabel: z.string().trim().min(1),
  consentVersion: z.string().trim().min(1),
  dataControllerLabel: z.string().trim().optional(),
  dataProtectionContactEmail: optionalEmailSchema.optional(),
  doiSubjectTemplate: z.string().trim().min(1),
  doiPreheader: z.string().trim().optional(),
  doiIntroText: z.string().trim().min(1),
  doiButtonLabel: z.string().trim().min(1),
  doiFallbackText: z.string().trim().optional(),
  doiExpiryNoticeText: z.string().trim().optional(),
  doiSuccessHeadline: z.string().trim().optional(),
  doiSuccessBody: z.string().trim().optional(),
  doiErrorHeadline: z.string().trim().optional(),
  doiErrorBody: z.string().trim().optional(),
  reminderSubjectTemplate: z.string().trim().min(1),
  reminderIntroTemplate: z.string().trim().min(1),
  reminderListIntroTemplate: z.string().trim().optional(),
  reminderOutroText: z.string().trim().optional(),
  unsubscribeLinkLabel: z.string().trim().min(1),
  reminderReasonText: z.string().trim().optional(),
  unsubscribeSuccessHeadline: z.string().trim().min(1),
  unsubscribeSuccessBody: z.string().trim().min(1),
  unsubscribeAlreadyDoneHeadline: z.string().trim().optional(),
  unsubscribeAlreadyDoneBody: z.string().trim().optional(),
  unsubscribeErrorHeadline: z.string().trim().optional(),
  unsubscribeErrorBody: z.string().trim().optional(),
  maxSubscriptionsPerEmailAndLocation: wastePositiveIntegerSchema,
  signupRateLimitPerIpPerHour: wastePositiveIntegerSchema,
  signupRateLimitPerEmailPerHour: wastePositiveIntegerSchema,
  doiTokenTtlHours: wastePositiveIntegerSchema,
  pendingSubscriptionTtlHours: wastePositiveIntegerSchema,
  materializationLookaheadDays: wastePositiveIntegerSchema.min(1).max(14),
  unsubscribeTokenTtlDays: wastePositiveIntegerSchema.optional(),
});

const updateWasteSettingsSchema = z.object({
  provider: z.literal('postgresql'),
  schemaName: z.string().trim().optional(),
  enabled: z.boolean(),
  selectedInterfaceId: z.string().trim().min(1).optional(),
  calendarWebUrl: optionalWasteUrlSchema.optional(),
  pdfBrandingAssetUrl: optionalWasteUrlSchema.optional(),
  pdfContactBlock: z.string().trim().max(2_000).optional(),
  disruptionLocationEnabled: z.boolean().optional(),
  disruptionAllLocationsEnabled: z.boolean().optional(),
  emailReminderConfig: wasteEmailReminderConfigSchema.optional(),
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

export const wasteManagementSettingsSchemas = {
  wasteCustomRecurrencePresetSchema,
  updateWasteSettingsSchema,
} as const;
