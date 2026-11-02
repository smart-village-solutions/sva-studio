import { z } from 'zod';

const hours = z.number().int().min(1).max(8760);
const locale = z.string().max(35).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u);
const recordingTexts = z.array(z.object({
  locale, consentHtml: z.string().min(1).max(65536), resumePromptHtml: z.string().min(1).max(65536),
}).strict()).max(40).refine((values) => new Set(values.map(({ locale }) => locale)).size === values.length,
  'duplicate_recording_locale');
const fields = z.object({
  enabled: z.boolean(), legalBasis: z.enum(['consent', 'statutory']),
  signature: z.enum(['off', 'optional', 'required']), idCheck: z.enum(['off', 'optional', 'required']),
  retentionHours: hours, verificationRequired: z.boolean(), recoveryMode: z.enum(['standard', 'enhanced']),
  timestampAuthorityUrl: z.string().url().max(2048).refine((value) => value.startsWith('https://')),
  auditRetentionHours: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), texts: recordingTexts.optional(),
}).strict();
export const ssfRecordingPolicySchema = fields.superRefine((value, context) => {
  if (value.auditRetentionHours < value.retentionHours) context.addIssue({
    code: 'custom', path: ['auditRetentionHours'], message: 'recording_audit_retention_too_short',
  });
});
/** Sparse administrator drafts are deliberately distinct from publishable policies. */
export const ssfRecordingSettingsSchema = fields.partial().extend({ retentionHours: hours.nullable().optional() }).strict();
export type RecordingPolicy = z.infer<typeof ssfRecordingPolicySchema>;
export const resolveRecordingRetentionHours = (installationHours?: number | null, tenantHours?: number | null): number => {
  if (installationHours != null) hours.parse(installationHours);
  if (tenantHours != null) hours.parse(tenantHours);
  return tenantHours ?? installationHours ?? 720;
};
export const resolveSsfRecordingPolicy = (installation: unknown, tenant: unknown): RecordingPolicy | undefined => {
  if (installation === undefined && tenant === undefined) return undefined;
  const defaults = ssfRecordingSettingsSchema.parse(installation === undefined ? {} : installation);
  const overrides = ssfRecordingSettingsSchema.parse(tenant === undefined ? {} : tenant);
  const candidate = { ...defaults, ...overrides, enabled: overrides.enabled ?? false,
    retentionHours: resolveRecordingRetentionHours(defaults.retentionHours, overrides.retentionHours) };
  if (candidate.auditRetentionHours !== undefined && candidate.auditRetentionHours < candidate.retentionHours) {
    throw new z.ZodError([{ code: 'custom', path: ['auditRetentionHours'], message: 'recording_audit_retention_too_short' }]);
  }
  const result = ssfRecordingPolicySchema.safeParse(candidate);
  if (result.success) return result.data;
  // Incomplete disabled drafts are administrative data only. Explicit conflicts remain invalid.
  if (!candidate.enabled && result.error.issues.every((issue) => (issue.code === 'invalid_type' || issue.code === 'invalid_value') &&
    (candidate as Record<string, unknown>)[String(issue.path[0])] === undefined)) return undefined;
  throw result.error;
};
