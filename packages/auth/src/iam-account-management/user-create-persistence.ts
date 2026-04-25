import { createUserCreatePersistence } from '@sva/iam-admin';
import { z } from 'zod';

import { protectField } from './encryption.js';
import { createUserSchema } from './schemas.js';
import {
  assignRoles,
  emitActivityLog,
  ensureRoleAssignmentWithinActorLevel,
  notifyPermissionInvalidation,
  resolveRolesByIds,
} from './shared.js';

export type CreateUserPayload = z.infer<typeof createUserSchema>;

export const { persistCreatedUser } = createUserCreatePersistence({
  assignRoles,
  emitActivityLog,
  ensureRoleAssignmentWithinActorLevel,
  notifyPermissionInvalidation,
  protectField,
  resolveRolesByIds,
});
