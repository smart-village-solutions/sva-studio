import { z } from 'zod';

import { ssfInstallationContentV2FieldsSchema, ssfRuntimeContentV2FieldsSchema } from './content-v2-contracts.js';

export const SSF_SYSTEM_CONTENT_V2_ADMIN_PATH = '/api/v1/plugins/ssf/content-v2/system' as const;
export const SSF_TENANT_CONTENT_V2_ADMIN_PATH = '/api/v1/plugins/ssf/content-v2/tenant' as const;

export const ssfSupportedLanguagesCatalogSchema = z.object({
  languages: z.record(z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
    z.object({ name: z.string().min(1), native: z.string().min(1) }).strict()).refine(
      (languages) => Object.keys(languages).length > 0
    ),
  admin_default: z.string().min(1),
  popular: z.array(z.string()),
}).strict().superRefine((catalog, context) => {
  if (!catalog.languages[catalog.admin_default]) context.addIssue({ code: 'custom', path: ['admin_default'], message: 'Unknown default language' });
  catalog.popular.forEach((locale, index) => {
    if (!catalog.languages[locale]) context.addIssue({ code: 'custom', path: ['popular', index], message: 'Unknown popular language' });
  });
});

export type SsfSupportedLanguagesCatalog = z.infer<typeof ssfSupportedLanguagesCatalogSchema>;

export const ssfSystemContentV2InputSchema = z.object({
  installation: ssfInstallationContentV2FieldsSchema.nullable(),
  runtimeTemplate: ssfRuntimeContentV2FieldsSchema.nullable(),
}).strict();

export const ssfSystemContentV2ViewSchema = ssfSystemContentV2InputSchema.extend({
  supportedLanguages: ssfSupportedLanguagesCatalogSchema.nullable(),
}).strict();

export const ssfTenantContentV2InputSchema = z.record(z.string(), z.unknown());

export const ssfTenantContentV2ViewSchema = z.object({
  runtimeTemplate: ssfRuntimeContentV2FieldsSchema.nullable(),
  overrides: ssfTenantContentV2InputSchema.nullable(),
  supportedLanguages: ssfSupportedLanguagesCatalogSchema.nullable(),
}).strict();

export type SsfSystemContentV2Input = z.infer<typeof ssfSystemContentV2InputSchema>;
export type SsfSystemContentV2View = z.infer<typeof ssfSystemContentV2ViewSchema>;
export type SsfTenantContentV2View = z.infer<typeof ssfTenantContentV2ViewSchema>;
