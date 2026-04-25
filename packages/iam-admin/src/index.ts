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
  createRoleReadHandlers,
  type RoleReadAuthenticatedRequestContext,
  type RoleReadHandlerDeps,
} from './role-read-handlers.js';

export {
  createCreateRoleHandlerInternal,
  type CreateRoleAuthenticatedRequestContext,
  type CreateRoleHandlerDeps,
} from './role-create-handler.js';

export {
  createUpdateRoleHandlerInternal,
  type UpdateRoleAuthenticatedRequestContext,
  type UpdateRoleHandlerDeps,
} from './role-update-handler.js';

export {
  createDeleteRoleHandlerInternal,
  type DeleteRoleAuthenticatedRequestContext,
  type DeleteRoleHandlerDeps,
} from './role-delete-handler.js';

export {
  loadRoleById,
  loadRoleListItemById,
  loadRoleListItems,
  type ManagedRoleRow,
} from './role-query.js';

export {
  runRoleCatalogReconciliation,
  type ReconcileReport,
  type RoleCatalogReconciliationDeps,
} from './reconcile-core.js';
export {
  createReconcileHandlerInternal,
  type ReconcileHandlerDeps,
} from './reconcile-handler.js';

export {
  resolveUsersForBulkDeactivation,
  type BulkUserAccess,
} from './user-bulk-query.js';

export {
  createBulkDeactivateHandlerInternal,
  type BulkDeactivateAuthenticatedRequestContext,
  type BulkDeactivateHandlerDeps,
} from './user-bulk-deactivate-handler.js';

export {
  createCreateUserHandlerInternal,
  type CreateAuthenticatedRequestContext,
  type CreateUserHandlerDeps,
} from './user-create-handler.js';

export {
  createDeactivateUserHandlerInternal,
  type DeactivateAuthenticatedRequestContext,
  type DeactivateUserHandlerDeps,
} from './user-deactivate-handler.js';

export {
  createUpdateUserHandlerInternal,
  type UpdateAuthenticatedRequestContext,
  type UpdateUserHandlerDeps,
} from './user-update-handler.js';

export {
  createSyncUsersFromKeycloakHandlerInternal,
  type SyncUsersAuthenticatedRequestContext,
  type SyncUsersHandlerDeps,
} from './user-import-sync-handler.js';

export {
  mapUnmappedKeycloakUser,
  mergeMappedUserWithKeycloak,
} from './tenant-keycloak-user-projection.js';

export {
  loadMappedUsersBySubject,
} from './tenant-keycloak-user-query.js';

export {
  createLegacyGroupReadHandlers,
  type LegacyGroupReadAuthenticatedRequestContext,
  type LegacyGroupReadHandlerDeps,
} from './legacy-group-read-handlers.js';

export {
  createLegacyGroupMutationHandlers,
  type LegacyGroupMutationAuthenticatedRequestContext,
  type LegacyGroupMutationHandlerDeps,
} from './legacy-group-mutation-handlers.js';

export {
  loadLegacyGroupById,
  loadLegacyGroups,
} from './legacy-group-query.js';

export {
  createLegacyGroupSchema,
  updateLegacyGroupSchema,
  type CreateLegacyGroupInput,
  type UpdateLegacyGroupInput,
} from './legacy-group-schemas.js';

export {
  createGroupMutationHandlers,
  type GroupMutationAuthenticatedRequestContext,
  type GroupMutationHandlerDeps,
} from './group-mutation-handlers.js';

export {
  createGroupReadHandlers,
  type GroupReadAuthenticatedRequestContext,
  type GroupReadHandlerDeps,
} from './group-read-handlers.js';

export {
  loadGroupDetail,
  loadGroupMembershipRows,
  loadGroupListItems,
  type GroupQueryClient,
} from './group-query.js';

export {
  mapGroupListItem,
  mapGroupMembership,
  type AccountGroupRow,
  type GroupRoleRow,
  type GroupRow,
  type IamAdminGroupDetail,
  type IamAdminGroupListItem,
  type IamAdminGroupMembership,
  type IamAdminGroupType,
  type IamUuid,
} from './group-types.js';

export {
  assignGroupMembershipSchema,
  assignGroupRoleSchema,
  createGroupSchema,
  groupKeySchema,
  removeGroupMembershipSchema,
  updateGroupSchema,
  type AssignGroupMembershipInput,
  type AssignGroupRoleInput,
  type CreateGroupInput,
  type RemoveGroupMembershipInput,
  type UpdateGroupInput,
} from './group-schemas.js';

export {
  assignOrganizationMembershipSchema,
  contentAuthorPolicySchema,
  createOrganizationSchema,
  membershipVisibilitySchema,
  organizationTypeSchema,
  updateOrganizationContextSchema,
  updateOrganizationSchema,
} from './organization-schemas.js';

export {
  createOrganizationReadHandlers,
  type OrganizationReadAuthenticatedRequestContext,
  type OrganizationReadHandlerDeps,
} from './organization-read-handlers.js';

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
  createUserReadHandlers,
  type UserReadAuthenticatedRequestContext,
  type UserReadHandlerDeps,
} from './user-read-handlers.js';

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
