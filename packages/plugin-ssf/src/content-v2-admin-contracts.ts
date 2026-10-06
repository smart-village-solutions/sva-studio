import { z } from 'zod';

import { ssfInstallationContentV2FieldsSchema, ssfRuntimeContentV2FieldsSchema } from './content-v2-contracts.js';

export const SSF_SYSTEM_CONTENT_V2_ADMIN_PATH = '/api/v1/plugins/ssf/content-v2/system' as const;
export const SSF_TENANT_CONTENT_V2_ADMIN_PATH = '/api/v1/plugins/ssf/content-v2/tenant' as const;

export const ssfSystemContentV2InputSchema = z.object({
  installation: ssfInstallationContentV2FieldsSchema.nullable(),
  runtimeTemplate: ssfRuntimeContentV2FieldsSchema.nullable(),
}).strict();

export const ssfTenantContentV2InputSchema = z.record(z.string(), z.unknown());

export const ssfTenantContentV2ViewSchema = z.object({
  runtimeTemplate: ssfRuntimeContentV2FieldsSchema.nullable(),
  overrides: ssfTenantContentV2InputSchema.nullable(),
}).strict();

export type SsfSystemContentV2Input = z.infer<typeof ssfSystemContentV2InputSchema>;
export type SsfTenantContentV2View = z.infer<typeof ssfTenantContentV2ViewSchema>;
