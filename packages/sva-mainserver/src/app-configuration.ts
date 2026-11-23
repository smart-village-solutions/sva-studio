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

export type AppConfigurationRecord = z.infer<typeof appConfigurationRecordSchema>;
export type AppConfigurationFields = z.infer<typeof appConfigurationFieldsSchema>;
export type AppConfigurationSave = z.infer<typeof appConfigurationSaveSchema>;
export type AppConfigurationDocument = AppConfigurationRecord & {
  revision: string;
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
