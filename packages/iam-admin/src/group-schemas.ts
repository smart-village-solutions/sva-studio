import { z } from 'zod';

const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidLikeString = (message: string) => z.string().regex(UUID_LIKE_PATTERN, message);

export const groupKeySchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9_-]+$/, 'group_key darf nur Kleinbuchstaben, Ziffern, Unterstriche und Bindestriche enthalten');

export const createGroupSchema = z.object({
  groupKey: groupKeySchema,
  displayName: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
  groupType: z.literal('role_bundle').default('role_bundle'),
  isActive: z.boolean().default(true),
});

export const updateGroupSchema = z.object({
  displayName: z.string().min(1).max(128).optional(),
  description: z.string().max(512).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const assignGroupRoleSchema = z.object({
  roleId: uuidLikeString('roleId muss eine gültige ID sein'),
});

export const assignGroupMembershipSchema = z.object({
  keycloakSubject: z.string().min(1),
  validFrom: z.string().datetime({ offset: true }).optional(),
  validUntil: z.string().datetime({ offset: true }).optional(),
});

export const removeGroupMembershipSchema = z.object({
  keycloakSubject: z.string().min(1),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type AssignGroupRoleInput = z.infer<typeof assignGroupRoleSchema>;
export type AssignGroupMembershipInput = z.infer<typeof assignGroupMembershipSchema>;
export type RemoveGroupMembershipInput = z.infer<typeof removeGroupMembershipSchema>;
