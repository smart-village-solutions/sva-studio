export { assignGroups, assignRoles } from './shared-assignment.js';
export {
  requireRoles,
  resolveActorAccountId,
  resolveActorInfo,
} from './shared-actor-resolution.js';
export type { ActorInfo } from './shared-actor-resolution.js';
export {
  ensureActorCanManageTarget,
  ensureRoleAssignmentWithinActorLevel,
  isSystemAdminAccount,
  resolveActorMaxRoleLevel,
  resolveSystemAdminCount,
} from './shared-actor-authorization.js';
export {
  emitActivityLog,
  emitRoleAuditEvent,
  notifyPermissionInvalidation,
  setRoleSyncState,
} from './shared-activity.js';
export { completeIdempotency, reserveIdempotency } from './shared-idempotency.js';
export {
  iamRoleSyncCounter,
  iamUserOperationsCounter,
  logger,
  setRoleDriftBacklog,
  trackKeycloakCall,
} from './shared-observability.js';
export {
  resolveGroupsByIds,
  resolveRoleIdsForGroups,
  resolveRolesByExternalNames,
  resolveRolesByIds,
} from './shared-role-resolution.js';
export {
  isKeycloakIdentityProvider,
  resolveIdentityProvider,
  resolvePool,
  withInstanceScopedDb,
} from './shared-runtime.js';
