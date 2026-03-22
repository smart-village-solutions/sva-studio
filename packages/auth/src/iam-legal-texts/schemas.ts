import { z } from 'zod';

const isoDateTimeString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Datum ist ungültig.');

const legalTextStatusSchema = z.enum(['draft', 'valid', 'archived']);

const hasDefinedEntries = (value: Record<string, unknown>): boolean =>
  Object.values(value).some((entry) => entry !== undefined);

const validatePublishedAtForStatus = (
  value: { status?: 'draft' | 'valid' | 'archived'; publishedAt?: string },
  ctx: z.RefinementCtx
) => {
  if (value.status === 'valid' && !value.publishedAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: 'Veröffentlichungsdatum ist für gültige Rechtstexte erforderlich.',
    });
  }
};

export const createLegalTextSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    legalTextVersion: z.string().trim().min(1).max(64),
    locale: z.string().trim().min(2).max(16),
    contentHtml: z.string().trim().min(1).max(200_000),
    status: legalTextStatusSchema.default('draft'),
    publishedAt: isoDateTimeString.optional(),
  })
  .superRefine(validatePublishedAtForStatus);

export const updateLegalTextSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    legalTextVersion: z.string().trim().min(1).max(64).optional(),
    locale: z.string().trim().min(2).max(16).optional(),
    contentHtml: z.string().trim().min(1).max(200_000).optional(),
    status: legalTextStatusSchema.optional(),
    publishedAt: isoDateTimeString.optional(),
  })
  .refine(hasDefinedEntries, 'Mindestens ein Feld muss gesetzt werden.');
