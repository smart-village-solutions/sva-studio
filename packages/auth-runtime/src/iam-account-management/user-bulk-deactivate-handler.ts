import { createBulkDeactivateHandlerInternal } from '@sva/iam-admin';

import { ensureActorCanManageTarget, resolveActorMaxRoleLevel, resolveSystemAdminCount } from './shared-actor-authorization.js';
import { emitActivityLog, notifyPermissionInvalidation } from './shared-activity.js';
import { iamUserOperationsCounter, logger, trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import { resolveUsersForBulkDeactivation } from './user-bulk-query.js';
import {
  completeBulkDeactivateFailure,
  completeBulkDeactivateSuccess,
  resolveBulkDeactivateContext,
} from './user-bulk-deactivate-context.js';

export const bulkDeactivateInternal = createBulkDeactivateHandlerInternal({
  completeBulkDeactivateFailure,
  completeBulkDeactivateSuccess,
  emitActivityLog,
  ensureActorCanManageTarget,
  iamUserOperationsCounter,
  logger,
  notifyPermissionInvalidation,
  resolveActorMaxRoleLevel,
  resolveBulkDeactivateContext,
  resolveSystemAdminCount,
  resolveUsersForBulkDeactivation,
  trackKeycloakCall,
  withInstanceScopedDb,
});
