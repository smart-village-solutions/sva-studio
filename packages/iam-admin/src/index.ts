export const iamAdminVersion = '0.0.1';

export {
  classifyTenantKeycloakRole,
  isTenantKeycloakRoleVisible,
  type TenantKeycloakRoleAssignmentPolicy,
  type TenantKeycloakRoleCategory,
  type TenantKeycloakRoleDescriptor,
} from './keycloak-role-assignment-policy.js';

export type IamAdminPackageRole =
  'users' | 'roles' | 'groups' | 'organizations' | 'tenant-admin-client';

export const iamAdminPackageRoles = [
  'users',
  'roles',
  'groups',
  'organizations',
  'tenant-admin-client',
] as const satisfies readonly IamAdminPackageRole[];

export { buildRoleSyncFailure, getRoleDisplayName, getRoleExternalName } from './role-audit.js';
export { mapRoleListItem, mapRoleSyncErrorCode } from './role-audit.js';
export { sanitizeRoleAuditDetails, sanitizeRoleErrorMessage } from './role-audit.js';

export { createRoleReadHandlers } from './role-read-handlers.js';
export { type RoleReadAuthenticatedRequestContext } from './role-read-handlers.js';
export { type RoleReadHandlerDeps } from './role-read-handlers.js';
export { getManagedPermissionMetadata } from './managed-permissions.js';
export { isRootOnlyPermissionKey } from './managed-permissions.js';
export { isTenantVisiblePermissionKey } from './managed-permissions.js';
export { listManagedPermissionMetadata } from './managed-permissions.js';
export { type ManagedPermissionMetadata } from './managed-permissions.js';

export { createCreateRoleHandlerInternal } from './role-create-handler.js';
export { type CreateRoleAuthenticatedRequestContext } from './role-create-handler.js';
export { type CreateRoleHandlerDeps } from './role-create-handler.js';

export { createUpdateRoleHandlerInternal } from './role-update-handler.js';
export { type UpdateRoleAuthenticatedRequestContext } from './role-update-handler.js';
export { type UpdateRoleHandlerDeps } from './role-update-handler.js';

export { createDeleteRoleHandlerInternal } from './role-delete-handler.js';
export { type DeleteRoleAuthenticatedRequestContext } from './role-delete-handler.js';
export { type DeleteRoleHandlerDeps } from './role-delete-handler.js';

export { loadRoleById, loadRoleListItemById, loadRoleListItems } from './role-query.js';
export { type ManagedRoleRow } from './role-query.js';

export { createRoleMutationPersistence } from './role-mutation-persistence.js';
export { type MutableRole } from './role-mutation-persistence.js';
export { type RoleMutationPersistenceActor } from './role-mutation-persistence.js';
export { type RoleMutationPersistenceDeps } from './role-mutation-persistence.js';

export { createManagedRoleSync } from './managed-role-sync.js';
export { type ManagedRoleIdentityProviderResolution } from './managed-role-sync.js';
export { type ManagedRoleSyncDeps, type ManagedRoleSyncRow } from './managed-role-sync.js';

export { ensureActorCanManageTarget } from './actor-authorization.js';
export { ensureDeleteTargetIsAllowed } from './actor-authorization.js';
export { ensureTenantManageableRoleAssignments } from './actor-authorization.js';
export { ensureRoleAssignmentWithinActorLevel } from './actor-authorization.js';
export { isSystemAdminAccount, resolveActorMaxRoleLevel } from './actor-authorization.js';
export { resolveSystemAdminCount } from './actor-authorization.js';
export { filterPlatformTechnicalKeycloakRoleNames } from './role-governance.js';
export { filterTenantTechnicalKeycloakRoleNames } from './role-governance.js';
export { resolveTenantTechnicalKeycloakRoleNames } from './role-governance.js';
export { isProtectedTenantRole, isTenantTechnicalKeycloakRole } from './role-governance.js';
export { isRootOnlyRole, isTenantManageableRole } from './role-governance.js';
export { PLATFORM_TECHNICAL_KEYCLOAK_ROLE_NAMES } from './role-governance.js';
export { TENANT_TECHNICAL_KEYCLOAK_ROLE_NAMES } from './role-governance.js';

export { resolveActorAccountId } from './actor-resolution-query.js';
export { resolveMissingActorDiagnosticReason } from './actor-resolution-query.js';

export {
  createActorResolutionServices,
  type ActorResolutionProvisionResult,
  type ActorResolutionServiceDeps,
  type ResolveActorAccountIdWithProvisionInput,
} from './actor-resolution-service.js';

export { resolveGroupsByIds, resolveRoleIdsForGroups } from './role-resolution.js';
export { resolveRolesByExternalNames, resolveRolesByIds } from './role-resolution.js';

export { readRoleCatalogFingerprint, runRoleCatalogReconciliation } from './reconcile-core.js';
export { type ReconcileReport, type RoleCatalogReconciliationDeps } from './reconcile-core.js';
export { createReconcileHandlerInternal } from './reconcile-handler.js';
export { type ReconcileAuthenticatedRequestContext } from './reconcile-handler.js';
export { type ReconcileHandlerDeps } from './reconcile-handler.js';

export { resolveUsersForBulkDeactivation, type BulkUserAccess } from './user-bulk-query.js';

export {
  createBulkDeactivateHandlerInternal,
  type BulkDeactivateAuthenticatedRequestContext,
  type BulkDeactivateHandlerDeps,
} from './user-bulk-deactivate-handler.js';
export {
  createBulkReprovisionMainserverHandlerInternal,
  type BulkReprovisionMainserverAuthenticatedRequestContext,
  type BulkReprovisionMainserverActor,
  type BulkReprovisionMainserverFailure,
  type BulkReprovisionMainserverHandlerDeps,
  type BulkReprovisionMainserverResult,
} from './user-bulk-reprovision-mainserver-handler.js';

export { createCreateUserHandlerInternal } from './user-create-handler.js';
export { type CreateAuthenticatedRequestContext } from './user-create-handler.js';
export { type CreateUserHandlerDeps } from './user-create-handler.js';

export { createUserCreatePersistence } from './user-create-persistence.js';
export { type PreparedCreateUserAssignments } from './user-create-persistence.js';
export { type CreateUserPersistenceActor } from './user-create-persistence.js';
export { type CreateUserPersistenceDeps } from './user-create-persistence.js';
export { type CreateUserPersistencePayload } from './user-create-persistence.js';

export {
  createDeactivateUserHandlerInternal,
  type DeactivateAuthenticatedRequestContext,
  type DeactivateUserHandlerDeps,
} from './user-deactivate-handler.js';

export { deleteUser, createDeleteUserHandlerInternal } from './user-delete-handler.js';
export { type DeleteAuthenticatedRequestContext } from './user-delete-handler.js';
export { type DeleteUserDeps, type DeleteUserHandlerDeps } from './user-delete-handler.js';
export { type DeleteUserInput, type DeleteUserResult } from './user-delete-handler.js';
export { assertAccountHardDeletePreconditions } from './user-delete-persistence.js';
export { anonymizeRetainedOwnedContent, hardDeleteAccount } from './user-delete-persistence.js';
export { markOwnedContentDeletedForAccountRemoval } from './user-delete-persistence.js';
export { purgeAccountHardDeleteBlockers } from './user-delete-persistence.js';
export { reconcileOwnedContentForAccountDelete } from './user-delete-persistence.js';

export { createUpdateUserHandlerInternal } from './user-update-handler.js';
export { RoleMutationCapabilityUnavailableError } from './user-update-handler.js';
export { shouldUpdateUserIdentityAttributes } from './user-update-handler.js';
export { shouldUpdateUserIdentityPayload } from './user-update-handler.js';
export { type UpdateAuthenticatedRequestContext } from './user-update-handler.js';
export { type UpdateUserHandlerDeps } from './user-update-handler.js';

export { buildUpdatedUserParams } from './user-update-persistence.js';
export { createUserUpdatePersistence } from './user-update-persistence.js';
export { type UpdateUserPersistencePayload } from './user-update-persistence.js';
export { type UserMainserverCredentialState } from './user-update-persistence.js';
export { type UserUpdatePersistenceDeps } from './user-update-persistence.js';

export {
  createSyncUsersFromKeycloakHandlerInternal,
  type SyncUsersAuthenticatedRequestContext,
  type SyncUsersHandlerDeps,
} from './user-import-sync-handler.js';

export { createUserImportPersistence } from './user-import-persistence.js';
export { type ImportIdentityListedUser } from './user-import-persistence.js';
export { type UserImportLocalProfileSeed } from './user-import-persistence.js';
export { type UserImportPersistenceDeps } from './user-import-persistence.js';

export { createProfileCommands, type ProfileActorInfo } from './profile-commands.js';
export { type ProfileCommandsDeps, type ProfileUpdatePayload } from './profile-commands.js';
export { type SessionProfileSeed } from './profile-commands.js';

export { mapUnmappedKeycloakUser } from './tenant-keycloak-user-projection.js';
export { mergeMappedUserWithKeycloak } from './tenant-keycloak-user-projection.js';

export { loadMappedUsersBySubject } from './tenant-keycloak-user-query.js';
export { loadTechnicalAccountSubjects } from './tenant-keycloak-user-query.js';

export {
  createLegacyGroupReadHandlers,
  type LegacyGroupReadAuthenticatedRequestContext,
  type LegacyGroupReadHandlerDeps,
  type LegacyGroupReadLogger,
} from './legacy-group-read-handlers.js';

export {
  createLegacyGroupMutationHandlers,
  type LegacyGroupMutationAuthenticatedRequestContext,
  type LegacyGroupMutationHandlerDeps,
} from './legacy-group-mutation-handlers.js';

export { loadLegacyGroupById, loadLegacyGroups } from './legacy-group-query.js';

export { createLegacyGroupSchema, updateLegacyGroupSchema } from './legacy-group-schemas.js';
export { type CreateLegacyGroupInput } from './legacy-group-schemas.js';
export { type UpdateLegacyGroupInput } from './legacy-group-schemas.js';

export { createGroupMutationHandlers } from './group-mutation-handlers.js';
export { type GroupMutationAuthenticatedRequestContext } from './group-mutation-handlers.js';
export { type GroupMutationHandlerDeps } from './group-mutation-handlers.js';

export { createGroupReadHandlers } from './group-read-handlers.js';
export { type GroupReadAuthenticatedRequestContext } from './group-read-handlers.js';
export { type GroupReadHandlerDeps } from './group-read-handlers.js';

export { loadGroupDetail, loadGroupMembershipRows, loadGroupListItems } from './group-query.js';
export { type GroupQueryClient } from './group-query.js';

export { mapGroupListItem, mapGroupMembership, type AccountGroupRow } from './group-types.js';
export { type GroupRoleRow, type GroupRow, type IamAdminGroupDetail } from './group-types.js';
export { type IamAdminGroupListItem, type IamAdminGroupMembership } from './group-types.js';
export { type IamAdminGroupType, type IamUuid } from './group-types.js';

export { assignGroupMembershipSchema, assignGroupRoleSchema } from './group-schemas.js';
export { createGroupSchema, groupKeySchema } from './group-schemas.js';
export { removeGroupMembershipSchema, updateGroupSchema } from './group-schemas.js';
export { type AssignGroupMembershipInput, type AssignGroupRoleInput } from './group-schemas.js';
export { type CreateGroupInput, type RemoveGroupMembershipInput } from './group-schemas.js';
export { type UpdateGroupInput } from './group-schemas.js';

export { assignOrganizationMembershipSchema } from './organization-schemas.js';
export { contentAuthorPolicySchema, createOrganizationSchema } from './organization-schemas.js';
export { membershipVisibilitySchema, organizationTypeSchema } from './organization-schemas.js';
export { updateOrganizationContextSchema } from './organization-schemas.js';
export { updateOrganizationSchema } from './organization-schemas.js';

export {
  createOrganizationReadHandlers,
  type OrganizationReadAuthenticatedRequestContext,
  type OrganizationReadHandlerDeps,
} from './organization-read-handlers.js';

export {
  createOrganizationMutationHandlers,
  type OrganizationMutationAuthenticatedRequestContext,
  type OrganizationMutationHandlerDeps,
} from './organization-mutation-handlers.js';

export { chooseActiveOrganizationId, escapeIlikePattern } from './organization-query.js';
export { isHierarchyError, loadContextOptions } from './organization-query.js';
export { loadOrganizationById, loadOrganizationDetail } from './organization-query.js';
export { loadOrganizationList, mapContextOption } from './organization-query.js';
export { mapMembershipRow, mapOrganizationListItem } from './organization-query.js';
export { readOrganizationTypeFilter, readOrganizationListSort } from './organization-query.js';
export { readStatusFilter, rebuildOrganizationSubtree } from './organization-query.js';
export { resolveHierarchyFields, type ContextOptionRow } from './organization-query.js';
export { type HierarchyResolution, type MembershipRow } from './organization-query.js';
export { type OrganizationRow } from './organization-query.js';
export { type OrganizationListSortDirection } from './organization-query.js';
export { type OrganizationListSortField } from './organization-query.js';

export {
  buildOrganizationMainserverSecretAad,
  loadOrganizationMainserverCredentialState,
  projectOrganizationMainserverCredentialState,
  reserveOrganizationMainserverProvisioning,
  updateOrganizationMainserverProvisioningState,
  upsertOrganizationMainserverCredentials,
  type OrganizationMainserverCredentialRow,
  type OrganizationMainserverCredentialState,
  type OrganizationMainserverProvisioningReservation,
} from './organization-mainserver-credentials.js';

export {
  writeActiveOrganizationProvisioningCredentials,
  type ActiveOrganizationProvisioningCredentialWriteInput,
  type OrganizationMainserverCredentialWriteInput,
} from './organization-mainserver-credential-write.js';

export { buildDirectPermissionRowsSql } from './user-detail-permission-sql.js';
export { buildPermissionRowsSql } from './user-detail-permission-sql.js';
export { buildPermissionTraceRowsSql } from './user-detail-permission-sql.js';

export { IamSchemaDriftError } from './runtime-errors.js';

export { getEncryptionConfig, protectField, revealField } from './encryption.js';

export { USER_STATUS, type ActorInfo, type FeatureFlags } from './types.js';
export { type IamGroupMembershipRow, type IamGroupRow, type IamRoleRow } from './types.js';
export { type IdempotencyReserveResult, type IdempotencyStatus } from './types.js';
export { type ManagedBy, type RateBucket, type RateScope } from './types.js';
export { type ResolveActorOptions, type RoleSyncErrorCode, type UserStatus } from './types.js';

export { mapRoles, mapUserRowToListItem, maskEmail } from './user-mapping.js';
export { resolveUserDisplayName } from './user-mapping.js';

export { resolveUsersWithPagination } from './user-list-query.js';

export { resolveUserDetail } from './user-detail-query.js';

export { createUserReadHandlers } from './user-read-handlers.js';
export { type UserReadAuthenticatedRequestContext } from './user-read-handlers.js';
export { type UserReadHandlerDeps } from './user-read-handlers.js';

export { mapUserDetailRow } from './user-detail-query.mapping.js';

export { readUserDetailSchemaSupport, selectUserDetailQuery } from './user-detail-query.sql.js';

export type {
  UserDetailGroupRow,
  UserDetailPermissionTraceRow,
  UserDetailRoleRow,
  UserDetailRow,
  UserDetailSchemaSupport,
  UserDetailSchemaSupportRow,
} from './user-detail-query.types.js';
