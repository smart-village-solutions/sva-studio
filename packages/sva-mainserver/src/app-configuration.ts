import { z } from 'zod';

const unavailableField = z.discriminatedUnion('state', [
  z.object({ state: z.literal('missing') }).strict(),
  z.object({ state: z.literal('unsupported') }).strict(),
]);
const booleanField = z.union([
  unavailableField,
  z.object({ state: z.literal('value'), value: z.boolean() }).strict(),
]);
const numberField = z.union([
  unavailableField,
  z.object({ state: z.literal('value'), value: z.number().int().positive() }).strict(),
]);
export const appConfigurationIdSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .max(32);
export const appConfigurationRecordSchema = z.object({
  id: appConfigurationIdSchema,
  name: z.string().min(1),
  version: z.string().nullable(),
  updatedAt: z.string().min(1),
});
export const appConfigurationFieldsSchema = z
  .object({
    alternativeLocation: booleanField,
    tileTitleLines: numberField,
  })
  .strict();
const revisionSchema = z.string().min(1).max(256);
export const appConfigurationSaveSchema = z
  .object({
    id: appConfigurationIdSchema,
    baselineRevision: revisionSchema,
    baseline: appConfigurationFieldsSchema,
    changes: z
      .object({
        alternativeLocation: z.boolean().nullable().optional(),
        tileTitleLines: z.number().int().positive().nullable().optional(),
      })
      .strict(),
    reviewedRevision: revisionSchema.optional(),
    choices: z
      .object({
        alternativeLocation: z.enum(['studio', 'mainserver']).optional(),
        tileTitleLines: z.enum(['studio', 'mainserver']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const canCopyAppConfigurationName = (name: string): boolean =>
  /^[a-z0-9_]+(?:-[a-z0-9_]+)*$/.test(name);

// Mainserver compares numeric versions using Gem::Version, which ignores trailing zeroes.
export const normalizeAppConfigurationVersion = (version: string): string | undefined => {
  const value = version.trim();
  if (!/^\d+(?:\.\d+)*$/.test(value)) return undefined;
  const canonical = value
    .split('.')
    .map((part) => part.replace(/^0+(?=\d)/, ''))
    .join('.');
  return canonical.replace(/(?:\.0)+$/, '');
};

const appConfigurationVariantVersionSchema = z
  .string()
  .trim()
  .max(64)
  .refine((value) => {
    const normalized = normalizeAppConfigurationVersion(value);
    return normalized !== undefined && normalized !== '0';
  })
  .nullable();

const selection = { id: appConfigurationIdSchema, revision: revisionSchema };
export const appConfigurationVariantCommandSchema = z.discriminatedUnion('operation', [
  z
    .object({
      ...selection,
      operation: z.literal('create'),
      version: appConfigurationVariantVersionSchema,
    })
    .strict(),
  z.object({ ...selection, operation: z.literal('delete') }).strict(),
]);

export type AppConfigurationVariantCommand = z.infer<typeof appConfigurationVariantCommandSchema>;
export type AppConfigurationVariantResult =
  | { status: 'created'; document: AppConfigurationDocument }
  | { status: 'deleted' | 'exists' | 'stale' | 'missing' | 'unsupported' | 'unconfirmed' };

export type AppConfigurationRecord = z.infer<typeof appConfigurationRecordSchema>;
export type AppConfigurationFields = z.infer<typeof appConfigurationFieldsSchema>;
export type AppConfigurationSave = z.infer<typeof appConfigurationSaveSchema>;
export type AppConfigurationDocument = AppConfigurationRecord & {
  revision: string;
  canCopy: boolean;
  fields: AppConfigurationFields | null;
};
export type AppConfigurationSyncResult =
  | { status: 'saved'; document: AppConfigurationDocument }
  | {
      status: 'review';
      document: AppConfigurationDocument;
      conflicts: (keyof AppConfigurationFields)[];
    }
  | { status: 'unsupported' | 'unconfirmed' | 'missing' };
