import { z } from 'zod';

export const appConfigurationSelectionSchema = z
  .object({
    version: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^\d+(?:\.[0-9A-Za-z]+)*(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/)
      .nullable(),
  })
  .strict();
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
export const appConfigurationPreviewSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('unavailable'),
      reason: z.enum(['not_resolved', 'invalid_document']),
    })
    .strict(),
  z
    .object({
      status: z.literal('loaded'),
      instanceId: z.string().min(1),
      requestedVersion: appConfigurationSelectionSchema.shape.version,
      record: z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
          version: z.string().min(1).nullable(),
        })
        .strict(),
      fallback: z.boolean(),
      fields: z.object({ alternativeLocation: booleanField, tileTitleLines: numberField }).strict(),
    })
    .strict(),
]);
export type AppConfigurationSelection = z.infer<typeof appConfigurationSelectionSchema>;
export type AppConfigurationPreview = z.infer<typeof appConfigurationPreviewSchema>;
export type LoadedAppConfigurationPreview = Extract<AppConfigurationPreview, { status: 'loaded' }>;
