import { createRoleMutationPersistence } from '@sva/iam-admin';

import { createApiError } from './api-helpers.js';
import {
  emitActivityLog,
  emitRoleAuditEvent,
  notifyPermissionInvalidation,
  setRoleSyncState,
} from './shared-activity.js';
import { withInstanceScopedDb } from './shared-runtime.js';

export const {
  deleteRoleFromDatabase,
  markDeleteRoleSyncState,
  markRoleSyncState,
  persistCreatedRole,
  persistUpdatedRole,
  resolveDeletableRole,
  resolveMutableRole,
} = createRoleMutationPersistence({
  createApiError,
  emitActivityLog,
  emitRoleAuditEvent,
  notifyPermissionInvalidation,
  setRoleSyncState,
  withInstanceScopedDb,
});
