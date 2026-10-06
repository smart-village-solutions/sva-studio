import { z } from 'zod';

import { normalizeSsfLocale, ssfRevisionSchema } from './contracts.js';

const text = z.string().min(1).max(500);
const html = z.string().min(1).max(65536);
const locale = z
  .string()
  .max(35)
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u)
  .refine((value) => {
    try {
      return normalizeSsfLocale(value) === value;
    } catch {
      return false;
    }
  });
const httpsUrl = z.url().max(2048).refine((value) => value.startsWith('https://'));

const media = z.object({ url: httpsUrl, alternativeText: z.string().max(500) }).strict();
const branding = z.object({ logo: media.nullable(), icon: media.nullable() }).strict();
const questionId = z.string().max(64).regex(/^[A-Za-z][A-Za-z0-9]*$/u);
const questionBase = { id: questionId, headline: text.optional(), question: text, required: z.boolean().optional() };
const rating = z
  .object({ ...questionBase, type: z.literal('rating'), min: z.number().int().min(0).max(9), max: z.number().int().min(1).max(10) })
  .strict()
  .refine((value) => value.min < value.max);
const scale = z
  .object({ ...questionBase, type: z.literal('scale'), min: z.number().int().min(0).max(9), max: z.number().int().min(1).max(10), minLabel: text.optional(), maxLabel: text.optional() })
  .strict()
  .refine((value) => value.min < value.max);
const longText = z
  .object({ ...questionBase, type: z.literal('longText'), placeholder: text.optional(), maxLength: z.number().int().min(1).max(4000).optional() })
  .strict();
export const ssfFeedbackV2Schema = z
  .object({
    headline: text,
    questions: z.array(z.union([rating, scale, longText])).min(1).max(20),
    noticeHtml: html,
    button: text,
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.questions.map((question) => question.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', path: ['questions'], message: 'duplicate_question_id' });
    }
  });

export const ssfInstallationContentV2FieldsSchema = z
  .object({
    branding,
    legal: z
      .object({
        imprintUrl: httpsUrl,
        privacyPolicyUrl: httpsUrl,
        accessibilityStatementUrl: httpsUrl.nullable(),
      })
      .strict(),
    localization: z
      .object({
        locale,
        startpage: z.object({ enterCode: text, send: text, login: text }).strict(),
        login: z.object({ headline: text, descriptionHtml: html }).strict(),
        feedback: ssfFeedbackV2Schema,
      })
      .strict(),
  })
  .strict();

const guestLanguage = z
  .object({
    locale,
    nativeName: text,
    staffName: text,
    icon: media.nullable().optional(),
    guest: z
      .object({ explanationHtml: html, storageQuestionHtml: html.nullable() })
      .strict(),
    feedback: ssfFeedbackV2Schema,
  })
  .strict();

export const ssfRuntimeContentV2FieldsSchema = z
  .object({
    branding,
    conversationContentStorage: z
      .object({
        mode: z.enum(['ask', 'disabled']),
        retentionHours: z.number().int().min(0).max(8760).nullable(),
      })
      .strict(),
    staff: z
      .object({
        locale,
        dashboard: z
          .object({
            headline: text,
            explanationHtml: html,
            callToAction: text,
            load: z.object({ headline: text, green: text, yellow: text, red: text }).strict(),
          })
          .strict(),
        newConversation: z.object({ headline: text, descriptionHtml: html }).strict(),
        feedback: ssfFeedbackV2Schema,
      })
      .strict(),
    guestLanguages: z.array(guestLanguage).min(1).max(30),
  })
  .strict()
  .superRefine((value, context) => {
    const locales = value.guestLanguages.map((entry) => entry.locale);
    if (new Set(locales).size !== locales.length) {
      context.addIssue({ code: 'custom', path: ['guestLanguages'], message: 'duplicate_locale' });
    }
    const staffLanguage = value.staff.locale.split('-')[0]?.toLowerCase();
    if (locales.some((entry) => entry.split('-')[0]?.toLowerCase() === staffLanguage)) {
      context.addIssue({ code: 'custom', path: ['guestLanguages'], message: 'staff_language_as_guest' });
    }
    if (value.conversationContentStorage.mode === 'disabled') {
      if (value.conversationContentStorage.retentionHours !== null ||
          value.guestLanguages.some((entry) => entry.guest.storageQuestionHtml !== null)) {
        context.addIssue({ code: 'custom', path: ['conversationContentStorage'], message: 'disabled_storage_has_question_or_retention' });
      }
    } else if (value.conversationContentStorage.retentionHours === null ||
        value.guestLanguages.some((entry) => entry.guest.storageQuestionHtml === null)) {
      context.addIssue({ code: 'custom', path: ['conversationContentStorage'], message: 'ask_storage_missing_question_or_retention' });
    }
  });

export const ssfInstallationContentV2Schema = ssfInstallationContentV2FieldsSchema.extend({
  contractVersion: z.literal('2.0'),
  configurationRevision: ssfRevisionSchema,
}).strict();

export const ssfRuntimeConfigurationV2Schema = ssfRuntimeContentV2FieldsSchema.safeExtend({
  contractVersion: z.literal('2.0'),
  configurationRevision: ssfRevisionSchema,
  tenant: z.object({ id: text.max(128), displayName: text.max(200), timeZone: text.max(100) }).strict(),
}).strict();

export type SsfInstallationContentV2Fields = z.infer<typeof ssfInstallationContentV2FieldsSchema>;
export type SsfRuntimeContentV2Fields = z.infer<typeof ssfRuntimeContentV2FieldsSchema>;
export type SsfInstallationContentV2 = z.infer<typeof ssfInstallationContentV2Schema>;
export type SsfRuntimeConfigurationV2 = z.infer<typeof ssfRuntimeConfigurationV2Schema>;
