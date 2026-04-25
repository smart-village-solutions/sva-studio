import { z } from 'zod';

import { uuidLikeString } from '../shared/validators.js';
import { USER_STATUS } from './types.js';

const hasDefinedEntries = (value: Record<string, unknown>): boolean =>
  Object.values(value).some((entry) => entry !== undefined);

const optionalTrimmedSecretString = (maxLength: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z.string().trim().max(maxLength).optional()
  );

const uniqueUuidArray = (maxLength: number) =>
  z
    .array(uuidLikeString('Ungültige ID.'))
    .max(maxLength)
    .refine((value) => new Set(value).size === value.length, 'IDs müssen eindeutig sein.');

const userDirectPermissionAssignmentSchema = z.object({
  permissionId: uuidLikeString('Ungültige ID.'),
  effect: z.enum(['allow', 'deny']),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().min(1).max(200).optional(),
  lastName: z.string().trim().min(1).max(200).optional(),
  displayName: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().min(1).max(64).optional(),
  position: z.string().trim().max(255).optional(),
  department: z.string().trim().max(255).optional(),
  preferredLanguage: z.string().trim().max(16).optional(),
  timezone: z.string().trim().max(64).optional(),
  avatarUrl: z.string().url().max(1024).optional(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(USER_STATUS).optional(),
  roleIds: z.array(uuidLikeString('Ungültige ID.')).max(20).default([]),
});

export const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    firstName: z.string().trim().min(1).max(200).optional(),
    lastName: z.string().trim().min(1).max(200).optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().min(1).max(64).optional(),
    position: z.string().trim().max(255).optional(),
    department: z.string().trim().max(255).optional(),
    preferredLanguage: z.string().trim().max(16).optional(),
    timezone: z.string().trim().max(64).optional(),
    avatarUrl: z.string().url().max(1024).optional(),
    notes: z.string().trim().max(2000).optional(),
    status: z.enum(USER_STATUS).optional(),
    roleIds: uniqueUuidArray(20).optional(),
    groupIds: uniqueUuidArray(50).optional(),
    directPermissions: z
      .array(userDirectPermissionAssignmentSchema)
      .max(100)
      .refine(
        (value) => new Set(value.map((entry) => entry.permissionId)).size === value.length,
        'Berechtigungen müssen eindeutig sein.'
      )
      .optional(),
    mainserverUserApplicationId: z.string().trim().max(255).optional(),
    mainserverUserApplicationSecret: optionalTrimmedSecretString(255),
  })
  .refine(hasDefinedEntries, 'Mindestens ein Feld muss gesetzt werden.');

export const updateMyProfileSchema = z
  .object({
    username: z.string().trim().min(1).max(255).regex(/^\S+$/).optional(),
    email: z.string().email().optional(),
    firstName: z.string().trim().min(1).max(200).optional(),
    lastName: z.string().trim().min(1).max(200).optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().min(1).max(64).optional(),
    position: z.string().trim().max(255).optional(),
    department: z.string().trim().max(255).optional(),
    preferredLanguage: z.string().trim().max(16).optional(),
    timezone: z.string().trim().max(64).optional(),
  })
  .refine(hasDefinedEntries, 'Mindestens ein Feld muss gesetzt werden.');

export const bulkDeactivateSchema = z.object({
  userIds: z.array(uuidLikeString('Ungültige ID.')).min(1).max(50),
});

export const createRoleSchema = z.object({
  roleName: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9_]+$/),
  displayName: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  permissionIds: z.array(uuidLikeString('Ungültige ID.')).max(100).default([]),
  roleLevel: z.number().int().min(0).max(100).default(0),
});

export const updateRoleSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    permissionIds: z.array(uuidLikeString('Ungültige ID.')).max(100).optional(),
    roleLevel: z.number().int().min(0).max(100).optional(),
    retrySync: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0 && (Object.keys(value).some((key) => key !== 'retrySync') || value.retrySync),
    'Mindestens ein Feld muss gesetzt werden.'
  );

export const createGroupSchema = z.object({
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

export const updateGroupSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    roleIds: uniqueUuidArray(50).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(hasDefinedEntries, 'Mindestens ein Feld muss gesetzt werden.');
