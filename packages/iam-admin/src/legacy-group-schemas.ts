import { z } from 'zod';

const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuidLikeString = (message: string) => z.string().regex(UUID_LIKE_PATTERN, message);

const hasDefinedEntries = (value: Record<string, unknown>): boolean =>
  Object.values(value).some((entry) => entry !== undefined);

const uniqueUuidArray = (maxLength: number) =>
  z
    .array(uuidLikeString('Ungültige ID.'))
    .max(maxLength)
    .refine((value) => new Set(value).size === value.length, 'IDs müssen eindeutig sein.');

export const createLegacyGroupSchema = z.object({
  groupKey: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9_]+$/),
  displayName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  roleIds: uniqueUuidArray(50).default([]),
});

export const updateLegacyGroupSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    roleIds: uniqueUuidArray(50).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(hasDefinedEntries, 'Mindestens ein Feld muss gesetzt werden.');

export type CreateLegacyGroupInput = z.infer<typeof createLegacyGroupSchema>;
export type UpdateLegacyGroupInput = z.infer<typeof updateLegacyGroupSchema>;
