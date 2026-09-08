import { z } from 'zod';

import { SSF_RUNTIME_LIMITS } from './constants.js';
import { SSF_PRODUCT_DEFAULTS_V1 } from './defaults.js';

export const SSF_SYSTEM_CONFIGURATION_PATH = '/api/v1/plugins/ssf/system-configuration';
export const SSF_TENANT_CONFIGURATION_PATH = '/api/v1/plugins/ssf/tenant-configuration';

export const SSF_ADMIN_ACTIONS = {
  systemRead: 'ssf.configuration.system.read',
  systemManage: 'ssf.configuration.system.manage',
  tenantRead: 'ssf.configuration.tenant.read',
  tenantManage: 'ssf.configuration.tenant.manage',
} as const;

const supportedLocales = SSF_PRODUCT_DEFAULTS_V1.locales.map((entry) => entry.locale) as [
  string,
  ...string[],
];
export const ssfAdminLocaleSchema = z.enum(supportedLocales);
const htmlSchema = z.string().superRefine((value, context) => {
  if (new TextEncoder().encode(value).byteLength > SSF_RUNTIME_LIMITS.htmlUtf8Bytes) {
    context.addIssue({ code: 'custom', message: 'html_too_large' });
  }
});
const nullableHtml = htmlSchema.nullable();

export const ssfSystemLocaleInputSchema = z
  .object({
    locale: ssfAdminLocaleSchema,
    available: z.boolean(),
    authenticatedHomeExplanationHtml: htmlSchema,
    guestExplanationHtml: htmlSchema,
    conversationContentStorageQuestionHtml: htmlSchema,
  })
  .strict();

export const ssfSystemConfigurationInputSchema = z
  .object({
    defaultLocale: ssfAdminLocaleSchema,
    conversationContentStorageMode: z.enum(['ask', 'disabled']),
    locales: z.array(ssfSystemLocaleInputSchema).length(supportedLocales.length),
  })
  .strict()
  .superRefine((value, context) => {
    const active = value.locales.filter((entry) => entry.available);
    if (!active.some((entry) => entry.locale === value.defaultLocale)) {
      context.addIssue({
        code: 'custom',
        path: ['defaultLocale'],
        message: 'default_locale_inactive',
      });
    }
    if (new Set(value.locales.map((entry) => entry.locale)).size !== supportedLocales.length) {
      context.addIssue({ code: 'custom', path: ['locales'], message: 'locales_invalid' });
    }
  });

export const ssfTenantLocaleInputSchema = z
  .object({
    locale: ssfAdminLocaleSchema,
    enabled: z.boolean().nullable(),
    authenticatedHomeExplanationHtml: nullableHtml,
    guestExplanationHtml: nullableHtml,
    conversationContentStorageQuestionHtml: nullableHtml,
  })
  .strict();

export const ssfTenantConfigurationInputSchema = z
  .object({
    defaultLocale: ssfAdminLocaleSchema.nullable(),
    conversationContentStorageMode: z.enum(['ask', 'disabled']).nullable(),
    locales: z.array(ssfTenantLocaleInputSchema).length(supportedLocales.length),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.defaultLocale !== null &&
      value.locales.find((entry) => entry.locale === value.defaultLocale)?.enabled === false
    ) {
      context.addIssue({
        code: 'custom',
        path: ['defaultLocale'],
        message: 'default_locale_inactive',
      });
    }
    if (new Set(value.locales.map((entry) => entry.locale)).size !== supportedLocales.length) {
      context.addIssue({ code: 'custom', path: ['locales'], message: 'locales_invalid' });
    }
  });

export type SsfSystemConfigurationInput = z.infer<typeof ssfSystemConfigurationInputSchema>;
export type SsfTenantConfigurationInput = z.infer<typeof ssfTenantConfigurationInputSchema>;
export type SsfEffectiveTenantConfiguration = Omit<SsfSystemConfigurationInput, 'locales'> & {
  locales: readonly (Omit<
    SsfSystemConfigurationInput['locales'][number],
    'conversationContentStorageQuestionHtml'
  > & {
    conversationContentStorageQuestionHtml: string | null;
  })[];
};

export type SsfTenantConfigurationView = Readonly<{
  system: SsfSystemConfigurationInput;
  overrides: SsfTenantConfigurationInput;
  effective: SsfEffectiveTenantConfiguration;
}>;
