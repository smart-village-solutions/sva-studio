import { createUserCreatePersistence } from '@sva/iam-admin';
import { z } from 'zod';

import { protectField } from './encryption.js';
import { createUserSchema } from './schemas.js';
import {
  assignGroups,
  assignRoles,
  emitActivityLog,
  ensureRoleAssignmentWithinActorLevel,
  notifyPermissionInvalidation,
  resolveGroupsByIds,
  resolveRoleIdsForGroups,
  resolveRolesByIds,
} from './shared.js';

export type CreateUserPayload = z.infer<typeof createUserSchema>;

export const { persistCreatedUser } = createUserCreatePersistence({
  assignGroups,
  assignRoles,
  emitActivityLog,
  ensureRoleAssignmentWithinActorLevel,
  notifyPermissionInvalidation,
  protectField,
  resolveGroupsByIds,
  resolveRoleIdsForGroups,
  resolveRolesByIds,
});
