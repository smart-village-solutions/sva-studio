import { z } from 'zod';

import {
  SSF_RUNTIME_CONTRACT_VERSION,
  SSF_RUNTIME_ERROR_CODES,
  SSF_RUNTIME_LIMITS,
} from './constants.js';

const utf8ByteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

export const normalizeSsfLocale = (value: string): string => {
  if (value.length > SSF_RUNTIME_LIMITS.localeCharacters) {
    throw new Error('Locale exceeds the V1 character limit.');
  }

  const [normalized] = Intl.getCanonicalLocales(value);
  if (!normalized) {
    throw new Error('Locale must be a valid BCP-47 language tag.');
  }

  return normalized;
};

const ssfLocaleSchema = z
  .string()
  .min(1)
  .max(SSF_RUNTIME_LIMITS.localeCharacters)
  .refine(
    (value) => {
      try {
        return normalizeSsfLocale(value) === value;
      } catch {
        return false;
      }
    },
    { message: 'Locale must be a canonical BCP-47 language tag.' }
  );

export const ssfHtmlSchema = z.string().superRefine((value, context) => {
  if (utf8ByteLength(value) > SSF_RUNTIME_LIMITS.htmlUtf8Bytes) {
    context.addIssue({
      code: 'custom',
      message: `HTML must not exceed ${SSF_RUNTIME_LIMITS.htmlUtf8Bytes} UTF-8 bytes.`,
    });
  }
});

export const ssfRevisionSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/u);

const ssfResolvedMediaSchema = z
  .object({
    url: z.url().max(SSF_RUNTIME_LIMITS.urlCharacters),
    alternativeText: z.string().max(SSF_RUNTIME_LIMITS.alternativeTextCharacters),
  })
  .strict();

const ssfRuntimeLocaleSchema = z
  .object({
    locale: ssfLocaleSchema,
    authenticatedHomeExplanationHtml: ssfHtmlSchema,
    guestExplanationHtml: ssfHtmlSchema,
    conversationContentStorageQuestionHtml: ssfHtmlSchema.nullable(),
  })
  .strict();

const ssfTimeZoneSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, 'Time zone must be a valid IANA time zone.');

const ssfRuntimeConfigurationBaseObjectSchema = z
  .object({
    contractVersion: z.literal(SSF_RUNTIME_CONTRACT_VERSION),
    tenant: z
      .object({
        id: z.string().min(1).max(128),
        displayName: z.string().min(1).max(SSF_RUNTIME_LIMITS.displayNameCharacters),
        timeZone: ssfTimeZoneSchema,
      })
      .strict(),
    branding: z
      .object({
        logo: ssfResolvedMediaSchema.nullable(),
        icon: ssfResolvedMediaSchema.nullable(),
      })
      .strict(),
    localization: z
      .object({
        defaultLocale: ssfLocaleSchema,
        locales: z.array(ssfRuntimeLocaleSchema).min(1).max(SSF_RUNTIME_LIMITS.activeLocales),
      })
      .strict(),
    conversationContentStorage: z
      .object({
        mode: z.enum(['ask', 'disabled']),
      })
      .strict(),
  })
  .strict();

type SemanticConfiguration = z.infer<typeof ssfRuntimeConfigurationBaseObjectSchema>;

const addSemanticConfigurationIssues = (
  configuration: SemanticConfiguration,
  context: z.RefinementCtx
): void => {
  const locales = configuration.localization.locales.map((entry) => entry.locale);
  if (new Set(locales).size !== locales.length) {
    context.addIssue({
      code: 'custom',
      path: ['localization', 'locales'],
      message: 'Locales must be unique.',
    });
  }
  if (!locales.includes(configuration.localization.defaultLocale)) {
    context.addIssue({
      code: 'custom',
      path: ['localization', 'defaultLocale'],
      message: 'The default locale must be active.',
    });
  }
  if (
    configuration.conversationContentStorage.mode === 'disabled' &&
    configuration.localization.locales.some(
      (entry) => entry.conversationContentStorageQuestionHtml !== null
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['localization', 'locales'],
      message: 'Storage questions must be null when conversation storage is disabled.',
    });
  }
};

export const ssfRuntimeConfigurationWithoutRevisionsSchema =
  ssfRuntimeConfigurationBaseObjectSchema.superRefine(addSemanticConfigurationIssues);

export const ssfRuntimeConfigurationSchema = ssfRuntimeConfigurationBaseObjectSchema
  .extend({
    configurationRevision: ssfRevisionSchema,
    authorizationRevision: ssfRevisionSchema,
  })
  .strict()
  .superRefine(addSemanticConfigurationIssues);

export const ssfRuntimeErrorSchema = z
  .object({
    contractVersion: z.literal(SSF_RUNTIME_CONTRACT_VERSION),
    error: z
      .object({
        code: z.enum(SSF_RUNTIME_ERROR_CODES),
        message: z.string().min(1).max(200),
        retryable: z.boolean(),
        correlationId: z
          .string()
          .min(1)
          .max(SSF_RUNTIME_LIMITS.correlationIdCharacters)
          .regex(/^[\x20-\x7e]+$/u),
      })
      .strict(),
  })
  .strict();

export type SsfResolvedMedia = z.infer<typeof ssfResolvedMediaSchema>;
export type SsfRuntimeLocale = z.infer<typeof ssfRuntimeLocaleSchema>;
export type SsfRuntimeConfigurationWithoutRevisions = z.infer<
  typeof ssfRuntimeConfigurationWithoutRevisionsSchema
>;
export type SsfRuntimeConfiguration = z.infer<typeof ssfRuntimeConfigurationSchema>;
export type SsfRuntimeError = z.infer<typeof ssfRuntimeErrorSchema>;
