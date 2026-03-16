import { z } from 'zod';

const isoDateTimeString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Datum ist ungültig.');

const hasDefinedEntries = (value: Record<string, unknown>): boolean =>
  Object.values(value).some((entry) => entry !== undefined);

export const createLegalTextSchema = z.object({
  legalTextId: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9._-]+$/),
  legalTextVersion: z.string().trim().min(1).max(64),
  locale: z.string().trim().min(2).max(16),
  contentHash: z.string().trim().min(1).max(255),
  isActive: z.boolean().default(true),
  publishedAt: isoDateTimeString.optional(),
});

export const updateLegalTextSchema = z
  .object({
    contentHash: z.string().trim().min(1).max(255).optional(),
    isActive: z.boolean().optional(),
    publishedAt: isoDateTimeString.optional(),
  })
  .refine(hasDefinedEntries, 'Mindestens ein Feld muss gesetzt werden.');
