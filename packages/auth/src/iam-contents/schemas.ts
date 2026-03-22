import type { ContentJsonValue } from '@sva/core';
import { iamContentStatuses } from '@sva/core';
import { z } from 'zod';

const isoDateTimeString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Datum ist ungültig.');

const contentStatusSchema = z.enum(iamContentStatuses);
const jsonValueSchema: z.ZodType<ContentJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

const validatePublishedAtForStatus = (
  value: { status?: (typeof iamContentStatuses)[number]; publishedAt?: string },
  ctx: z.RefinementCtx
) => {
  if (value.status === 'published' && !value.publishedAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: 'Veröffentlichungsdatum ist für veröffentlichte Inhalte erforderlich.',
    });
  }
};

const hasDefinedEntries = (value: Record<string, unknown>): boolean =>
  Object.values(value).some((entry) => entry !== undefined);

export const createContentSchema = z
  .object({
    contentType: z.string().trim().min(1).max(128),
    title: z.string().trim().min(1).max(255),
    payload: jsonValueSchema,
    status: contentStatusSchema.default('draft'),
    publishedAt: isoDateTimeString.optional(),
  })
  .superRefine(validatePublishedAtForStatus);

export const updateContentSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    payload: jsonValueSchema.optional(),
    status: contentStatusSchema.optional(),
    publishedAt: isoDateTimeString.optional(),
  })
  .refine(hasDefinedEntries, 'Mindestens ein Feld muss gesetzt werden.')
  .superRefine(validatePublishedAtForStatus);
