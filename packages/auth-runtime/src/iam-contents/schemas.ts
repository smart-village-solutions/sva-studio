import type { ContentJsonValue } from '@sva/core';
import { iamContentStatuses, iamContentValidationStates } from '@sva/core';
import { z } from 'zod';

import { resolveContentPublicationInvariant } from './content-publication-invariants.js';

const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const isoDateTimeString = z
  .string()
  .trim()
  .refine(
    (value) => isoDateTimePattern.test(value) && !Number.isNaN(new Date(value).getTime()),
    'Datum ist ungültig.'
  );

const contentStatusSchema = z.enum(iamContentStatuses);
const contentValidationStateSchema = z.enum(iamContentValidationStates);
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
  value: {
    status?: (typeof iamContentStatuses)[number];
    publishedAt?: string;
    publishFrom?: string;
    publishUntil?: string;
  },
  ctx: z.RefinementCtx
) => {
  const invariant = resolveContentPublicationInvariant(value);
  if (invariant === 'content_published_at_required') {
    ctx.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: 'Veröffentlichungsdatum ist für veröffentlichte Inhalte erforderlich.',
    });
  }
  if (invariant === 'content_publication_window_invalid') {
    ctx.addIssue({
      code: 'custom',
      path: ['publishUntil'],
      message: 'Das Veröffentlichungsende muss nach dem Veröffentlichungsbeginn liegen.',
    });
  }
};

const hasDefinedEntries = (value: Record<string, unknown>): boolean =>
  Object.values(value).some((entry) => entry !== undefined);

export const createContentSchema = z
  .object({
    contentType: z.string().trim().min(1).max(128),
    organizationId: z.uuid().optional(),
    ownerSubjectId: z.string().trim().min(1).max(255).optional(),
    title: z.string().trim().min(1).max(255),
    payload: jsonValueSchema,
    status: contentStatusSchema.default('draft'),
    validationState: contentValidationStateSchema.default('valid'),
    publishedAt: isoDateTimeString.optional(),
    publishFrom: isoDateTimeString.optional(),
    publishUntil: isoDateTimeString.optional(),
  })
  .superRefine(validatePublishedAtForStatus);

export const updateContentSchema = z
  .object({
    organizationId: z.uuid().optional(),
    ownerSubjectId: z.string().trim().min(1).max(255).optional(),
    title: z.string().trim().min(1).max(255).optional(),
    payload: jsonValueSchema.optional(),
    status: contentStatusSchema.optional(),
    validationState: contentValidationStateSchema.optional(),
    publishedAt: isoDateTimeString.optional(),
    publishFrom: isoDateTimeString.optional(),
    publishUntil: isoDateTimeString.optional(),
  })
  .refine(hasDefinedEntries, 'Mindestens ein Feld muss gesetzt werden.')
  .superRefine(validatePublishedAtForStatus);

export type UpdateContentSchemaInput = z.infer<typeof updateContentSchema>;
