export const iamAdminVersion = '0.0.1';

export type IamAdminPackageRole = 'users' | 'roles' | 'groups' | 'organizations' | 'tenant-admin-client';

export const iamAdminPackageRoles = [
  'users',
  'roles',
  'groups',
  'organizations',
  'tenant-admin-client',
] as const satisfies readonly IamAdminPackageRole[];

export {
  buildRoleSyncFailure,
  getRoleDisplayName,
  getRoleExternalName,
  mapRoleListItem,
  mapRoleSyncErrorCode,
  sanitizeRoleAuditDetails,
  sanitizeRoleErrorMessage,
} from './role-audit.js';

export {
  loadRoleById,
  loadRoleListItemById,
  loadRoleListItems,
  type ManagedRoleRow,
} from './role-query.js';

export {
  resolveUsersForBulkDeactivation,
  type BulkUserAccess,
} from './user-bulk-query.js';

export {
  mapUnmappedKeycloakUser,
  mergeMappedUserWithKeycloak,
} from './tenant-keycloak-user-projection.js';

export {
  loadMappedUsersBySubject,
} from './tenant-keycloak-user-query.js';

export {
  buildDirectPermissionRowsSql,
  buildPermissionRowsSql,
  buildPermissionTraceRowsSql,
} from './user-detail-permission-sql.js';

export { IamSchemaDriftError } from './runtime-errors.js';

export {
  getEncryptionConfig,
  protectField,
  revealField,
} from './encryption.js';

export {
  USER_STATUS,
  type ActorInfo,
  type FeatureFlags,
  type IamGroupMembershipRow,
  type IamGroupRow,
  type IamRoleRow,
  type IdempotencyReserveResult,
  type IdempotencyStatus,
  type ManagedBy,
  type RateBucket,
  type RateScope,
  type ResolveActorOptions,
  type RoleSyncErrorCode,
  type UserStatus,
} from './types.js';

export {
  mapRoles,
  mapUserRowToListItem,
  maskEmail,
  resolveUserDisplayName,
} from './user-mapping.js';

export {
  resolveUsersWithPagination,
} from './user-list-query.js';

export {
  resolveUserDetail,
} from './user-detail-query.js';

export {
  mapUserDetailRow,
} from './user-detail-query.mapping.js';

export {
  readUserDetailSchemaSupport,
  selectUserDetailQuery,
} from './user-detail-query.sql.js';

export type {
  UserDetailDirectPermissionRow,
  UserDetailGroupRow,
  UserDetailPermissionTraceRow,
  UserDetailRoleRow,
  UserDetailRow,
  UserDetailSchemaSupport,
  UserDetailSchemaSupportRow,
} from './user-detail-query.types.js';
