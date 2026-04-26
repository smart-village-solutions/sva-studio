import type { IamPermissionEffect, IamUuid } from './authorization-contract';

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'invalid_instance_id'
  | 'invalid_organization_id'
  | 'organization_inactive'
  | 'rate_limited'
  | 'csrf_validation_failed'
  | 'idempotency_key_required'
  | 'idempotency_key_reuse'
  | 'idempotency_in_progress'
  | 'keycloak_unavailable'
  | 'tenant_auth_client_secret_missing'
  | 'tenant_admin_client_not_configured'
  | 'tenant_admin_client_secret_missing'
  | 'encryption_not_configured'
  | 'database_unavailable'
  | 'last_admin_protection'
  | 'self_protection'
  | 'feature_disabled'
  | 'conflict'
  | 'legal_acceptance_required'
  | 'reauth_required'
  | 'internal_error';

export const iamRuntimeDiagnosticClassifications = [
  'auth_resolution',
  'oidc_discovery_or_exchange',
  'tenant_host_validation',
  'session_store_or_session_hydration',
  'actor_resolution_or_membership',
  'keycloak_dependency',
  'database_or_schema_drift',
  'database_mapping_or_membership_inconsistency',
  'registry_or_provisioning_drift',
  'keycloak_reconcile',
  'frontend_state_or_permission_staleness',
  'legacy_workaround_or_regression',
  'unknown',
] as const;

export type IamRuntimeDiagnosticClassification = (typeof iamRuntimeDiagnosticClassifications)[number];

export const iamRuntimeDiagnosticStatuses = [
  'gesund',
  'degradiert',
  'recovery_laeuft',
  'manuelle_pruefung_erforderlich',
] as const;

export type IamRuntimeDiagnosticStatus = (typeof iamRuntimeDiagnosticStatuses)[number];

export const iamRuntimeRecommendedActions = [
  'erneut_anmelden',
  'erneut_versuchen',
  'keycloak_pruefen',
  'migration_pruefen',
  'provisioning_pruefen',
  'rollenabgleich_pruefen',
  'manuell_pruefen',
  'support_kontaktieren',
] as const;

export type IamRuntimeRecommendedAction = (typeof iamRuntimeRecommendedActions)[number];

export type IamRuntimeSafeDetails = Readonly<{
  reason_code?: string;
  dependency?: string;
  schema_object?: string;
  expected_migration?: string;
  actor_resolution?: string;
  instance_id?: string;
  return_to?: string;
  sync_state?: string;
  sync_error_code?: string;
}>;

export type IamRuntimeDiagnostics = {
  readonly classification: IamRuntimeDiagnosticClassification;
  readonly status: IamRuntimeDiagnosticStatus;
  readonly recommendedAction: IamRuntimeRecommendedAction;
  readonly safeDetails?: IamRuntimeSafeDetails;
};

export type InstanceStatus =
  | 'requested'
  | 'validated'
  | 'provisioning'
  | 'active'
  | 'failed'
  | 'suspended'
  | 'archived';

export type InstanceRealmMode = 'new' | 'existing';

export type ApiPagination = {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};

export type ApiItemResponse<TItem> = {
  readonly data: TItem;
  readonly requestId?: string;
};

export type ApiListResponse<TItem> = {
  readonly data: readonly TItem[];
  readonly pagination: ApiPagination;
  readonly requestId?: string;
};

export type ApiErrorResponse = {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly classification?: IamRuntimeDiagnosticClassification;
    readonly status?: IamRuntimeDiagnosticStatus;
    readonly recommendedAction?: IamRuntimeRecommendedAction;
    readonly safeDetails?: IamRuntimeSafeDetails;
  };
  readonly requestId?: string;
};

export type IamRoleSyncState = 'synced' | 'pending' | 'failed';

export type IamRoleSyncError = {
  readonly code: string;
};

export type IamGroupType = 'role_bundle';
export type IamGroupMembershipOrigin = 'manual' | 'seed' | 'sync';

export type IamUserRoleAssignment = {
  readonly roleId: IamUuid;
  readonly roleKey: string;
  readonly roleName: string;
  readonly roleLevel: number;
  readonly editability?: IamKeycloakObjectEditability;
  readonly diagnostics?: readonly IamKeycloakObjectDiagnostic[];
  readonly validFrom?: string;
  readonly validTo?: string;
};

export type IamUserGroupAssignment = {
  readonly accountId?: IamUuid;
  readonly groupId: IamUuid;
  readonly groupKey: string;
  readonly displayName: string;
  readonly groupType: IamGroupType;
  readonly origin: IamGroupMembershipOrigin;
  readonly validFrom?: string;
  readonly validTo?: string;
};

export type IamUserDirectPermissionAssignment = {
  readonly permissionId: IamUuid;
  readonly permissionKey: string;
  readonly effect: IamPermissionEffect;
  readonly description?: string;
};

export type IamUserPermissionTraceSourceKind = 'direct_permission' | 'direct_role' | 'group_role';
export type IamUserPermissionTraceStatus = 'effective' | 'inactive' | 'expired' | 'disabled';

export type IamUserPermissionTraceItem = {
  readonly permissionKey: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly organizationId?: IamUuid;
  readonly effect: IamPermissionEffect;
  readonly scope?: Readonly<Record<string, unknown>>;
  readonly isEffective: boolean;
  readonly status: IamUserPermissionTraceStatus;
  readonly sourceKind: IamUserPermissionTraceSourceKind;
  readonly roleId?: IamUuid;
  readonly roleKey?: string;
  readonly roleName?: string;
  readonly groupId?: IamUuid;
  readonly groupKey?: string;
  readonly groupDisplayName?: string;
  readonly groupActive?: boolean;
  readonly assignmentOrigin?: IamGroupMembershipOrigin;
  readonly validFrom?: string;
  readonly validTo?: string;
};

export type IamUserListItem = {
  readonly id: IamUuid;
  readonly keycloakSubject: string;
  readonly displayName: string;
  readonly email?: string;
  readonly status: 'active' | 'inactive' | 'pending';
  readonly mappingStatus?: IamKeycloakMappingStatus;
  readonly editability?: IamKeycloakObjectEditability;
  readonly diagnostics?: readonly IamKeycloakObjectDiagnostic[];
  readonly position?: string;
  readonly department?: string;
  readonly lastLoginAt?: string;
  readonly roles: readonly IamUserRoleAssignment[];
};

export type IamUserDetail = IamUserListItem & {
  readonly username?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly preferredLanguage?: string;
  readonly timezone?: string;
  readonly avatarUrl?: string;
  readonly notes?: string;
  readonly permissions?: readonly string[];
  readonly directPermissions?: readonly IamUserDirectPermissionAssignment[];
  readonly permissionTrace?: readonly IamUserPermissionTraceItem[];
  readonly groups?: readonly IamUserGroupAssignment[];
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecretSet: boolean;
  readonly fieldEditability?: IamKeycloakUserFieldEditability;
};

export type IamKeycloakMappingStatus = 'mapped' | 'unmapped' | 'manual_review';

export type IamKeycloakObjectEditability = 'editable' | 'read_only' | 'blocked';

export type IamKeycloakObjectDiagnosticCode =
  | 'missing_instance_attribute'
  | 'forbidden_role_mapping'
  | 'read_only_federated_field'
  | 'idp_forbidden'
  | 'mapping_missing'
  | 'mapping_incomplete'
  | 'keycloak_projection_degraded'
  | 'tenant_admin_client_not_configured'
  | 'external_managed'
  | 'built_in_role'
  | 'system_role';

export type IamKeycloakObjectDiagnostic = {
  readonly code: IamKeycloakObjectDiagnosticCode;
  readonly message?: string;
  readonly objectId?: string;
  readonly objectType?: 'user' | 'role' | 'role_assignment';
};

export type IamKeycloakUserFieldEditability = {
  readonly profile: IamKeycloakObjectEditability;
  readonly status: IamKeycloakObjectEditability;
  readonly roles: IamKeycloakObjectEditability;
};

export type IamUserSyncObjectDiagnostic = {
  readonly keycloakSubject: string;
  readonly mappingStatus: IamKeycloakMappingStatus;
  readonly diagnostics: readonly IamKeycloakObjectDiagnostic[];
};

export type IamUserImportSyncReport = {
  readonly outcome: 'success' | 'partial_failure' | 'blocked' | 'failed';
  readonly checkedCount: number;
  readonly correctedCount: number;
  readonly manualReviewCount: number;
  readonly importedCount: number;
  readonly updatedCount: number;
  readonly repairedProfileCount?: number;
  readonly skippedCount: number;
  readonly totalKeycloakUsers: number;
  readonly objects?: readonly IamUserSyncObjectDiagnostic[];
  readonly diagnostics?: {
    readonly authRealm: string;
    readonly providerSource: 'instance' | 'global' | 'fallback_global' | 'platform';
    readonly executionMode?: 'platform_admin' | 'tenant_admin' | 'break_glass';
    readonly matchedWithoutInstanceAttributeCount?: number;
    readonly skippedInstanceIds?: readonly string[];
  };
};

export type IamRoleListItem = {
  readonly id: IamUuid;
  readonly roleKey: string;
  readonly roleName: string;
  readonly externalRoleName: string;
  readonly managedBy: 'studio' | 'external' | 'keycloak_builtin';
  readonly description?: string;
  readonly isSystemRole: boolean;
  readonly editability?: IamKeycloakObjectEditability;
  readonly diagnostics?: readonly IamKeycloakObjectDiagnostic[];
  readonly roleLevel: number;
  readonly memberCount: number;
  readonly syncState: IamRoleSyncState;
  readonly lastSyncedAt?: string;
  readonly syncError?: IamRoleSyncError;
  readonly permissions: readonly {
    readonly id: IamUuid;
    readonly permissionKey: string;
    readonly description?: string;
  }[];
};

export type IamRoleReconcileEntry = {
  readonly roleId?: IamUuid;
  readonly roleKey?: string;
  readonly externalRoleName: string;
  readonly action: 'noop' | 'create' | 'update' | 'report';
  readonly status: 'synced' | 'corrected' | 'failed' | 'requires_manual_action';
  readonly errorCode?: string;
  readonly diagnostics?: readonly IamKeycloakObjectDiagnostic[];
};

export type IamRoleReconcileReport = {
  readonly outcome: 'success' | 'partial_failure' | 'blocked' | 'failed';
  readonly checkedCount: number;
  readonly correctedCount: number;
  readonly failedCount: number;
  readonly manualReviewCount: number;
  readonly requiresManualActionCount: number;
  readonly roles: readonly IamRoleReconcileEntry[];
};

export type IamGroupListItem = {
  readonly id: IamUuid;
  readonly groupKey: string;
  readonly displayName: string;
  readonly description?: string;
  readonly groupType: IamGroupType;
  readonly isActive: boolean;
  readonly memberCount: number;
  readonly roles: readonly {
    readonly roleId: IamUuid;
    readonly roleKey: string;
    readonly roleName: string;
  }[];
};

export type IamGroupDetail = IamGroupListItem & {
  readonly members: readonly IamUserGroupAssignment[];
};

export type IamLegalTextListItem = {
  readonly id: IamUuid;
  readonly name: string;
  readonly legalTextVersion: string;
  readonly locale: string;
  readonly contentHtml: string;
  readonly status: 'draft' | 'valid' | 'archived';
  readonly publishedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly acceptanceCount: number;
  readonly activeAcceptanceCount: number;
  readonly lastAcceptedAt?: string;
};

export type IamPendingLegalTextItem = {
  readonly id: IamUuid;
  readonly legalTextId: string;
  readonly name: string;
  readonly legalTextVersion: string;
  readonly locale: string;
  readonly contentHtml: string;
  readonly publishedAt?: string;
};

export type IamOrganizationType =
  | 'county'
  | 'municipality'
  | 'district'
  | 'company'
  | 'agency'
  | 'other';

export type IamContentAuthorPolicy = 'org_only' | 'org_or_personal';

export type IamOrganizationMembershipVisibility = 'internal' | 'external';

export type IamOrganizationListItem = {
  readonly id: IamUuid;
  readonly organizationKey: string;
  readonly displayName: string;
  readonly parentOrganizationId?: IamUuid;
  readonly parentDisplayName?: string;
  readonly organizationType: IamOrganizationType;
  readonly contentAuthorPolicy: IamContentAuthorPolicy;
  readonly isActive: boolean;
  readonly depth: number;
  readonly hierarchyPath: readonly IamUuid[];
  readonly childCount: number;
  readonly membershipCount: number;
};

export type IamOrganizationMembership = {
  readonly accountId: IamUuid;
  readonly keycloakSubject: string;
  readonly displayName: string;
  readonly email?: string;
  readonly visibility: IamOrganizationMembershipVisibility;
  readonly isDefaultContext: boolean;
  readonly createdAt: string;
};

export type IamInstanceProvisioningOperation = 'create' | 'activate' | 'suspend' | 'archive';

export type IamInstanceProvisioningRun = {
  readonly id: string;
  readonly instanceId: string;
  readonly operation: IamInstanceProvisioningOperation;
  readonly status: InstanceStatus;
  readonly stepKey?: string;
  readonly idempotencyKey: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly requestId?: string;
  readonly actorId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type IamInstanceAuditEvent = {
  readonly id: string;
  readonly instanceId: string;
  readonly eventType: string;
  readonly actorId?: string;
  readonly requestId?: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
};

export type IamInstanceListItem = {
  readonly instanceId: string;
  readonly displayName: string;
  readonly status: InstanceStatus;
  readonly parentDomain: string;
  readonly primaryHostname: string;
  readonly realmMode: InstanceRealmMode;
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecretConfigured: boolean;
  readonly tenantAdminClient?: {
    readonly clientId: string;
    readonly secretConfigured: boolean;
  };
  readonly tenantAdminBootstrap?: {
    readonly username: string;
    readonly email?: string;
    readonly firstName?: string;
    readonly lastName?: string;
  };
  readonly themeKey?: string;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly mainserverConfigRef?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly latestProvisioningRun?: IamInstanceProvisioningRun;
};

export type IamInstanceKeycloakStatus = {
  readonly realmExists: boolean;
  readonly clientExists: boolean;
  readonly tenantAdminClientExists: boolean;
  readonly instanceIdMapperExists: boolean;
  readonly tenantAdminExists: boolean;
  readonly tenantAdminHasSystemAdmin: boolean;
  readonly tenantAdminHasInstanceRegistryAdmin: boolean;
  readonly tenantAdminInstanceIdMatches: boolean;
  readonly redirectUrisMatch: boolean;
  readonly logoutUrisMatch: boolean;
  readonly webOriginsMatch: boolean;
  readonly clientSecretConfigured: boolean;
  readonly tenantClientSecretReadable: boolean;
  readonly clientSecretAligned: boolean;
  readonly tenantAdminClientSecretConfigured: boolean;
  readonly tenantAdminClientSecretReadable: boolean;
  readonly tenantAdminClientSecretAligned: boolean;
  readonly runtimeSecretSource: 'tenant' | 'global';
};

export type IamInstanceKeycloakPreflight = {
  readonly overallStatus: 'ready' | 'warning' | 'blocked';
  readonly checkedAt: string;
  readonly checks: readonly {
    readonly checkKey: string;
    readonly title: string;
    readonly status: 'ready' | 'warning' | 'blocked';
    readonly summary: string;
    readonly details: Readonly<Record<string, unknown>>;
  }[];
};

export type IamInstanceKeycloakPlan = {
  readonly mode: InstanceRealmMode;
  readonly overallStatus: 'ready' | 'blocked';
  readonly generatedAt: string;
  readonly driftSummary: string;
  readonly steps: readonly {
    readonly stepKey: string;
    readonly title: string;
    readonly action: 'create' | 'update' | 'verify' | 'skip';
    readonly status: 'ready' | 'blocked';
    readonly summary: string;
    readonly details: Readonly<Record<string, unknown>>;
  }[];
};

export type IamInstanceKeycloakProvisioningRun = {
  readonly id: string;
  readonly instanceId: string;
  readonly mode: InstanceRealmMode;
  readonly intent: 'provision' | 'provision_admin_client' | 'reset_tenant_admin' | 'rotate_client_secret';
  readonly overallStatus: 'planned' | 'running' | 'succeeded' | 'failed';
  readonly driftSummary: string;
  readonly requestId?: string;
  readonly actorId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly steps: readonly {
    readonly stepKey: string;
    readonly title: string;
    readonly status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'unchanged';
    readonly startedAt?: string;
    readonly finishedAt?: string;
    readonly summary: string;
    readonly details: Readonly<Record<string, unknown>>;
    readonly requestId?: string;
  }[];
};

export type IamInstanceDetail = IamInstanceListItem & {
  readonly hostnames: readonly {
    readonly hostname: string;
    readonly isPrimary: boolean;
    readonly createdAt: string;
  }[];
  readonly provisioningRuns: readonly IamInstanceProvisioningRun[];
  readonly auditEvents: readonly IamInstanceAuditEvent[];
  readonly keycloakStatus?: IamInstanceKeycloakStatus;
  readonly keycloakPreflight?: IamInstanceKeycloakPreflight;
  readonly keycloakPlan?: IamInstanceKeycloakPlan;
  readonly latestKeycloakProvisioningRun?: IamInstanceKeycloakProvisioningRun;
  readonly keycloakProvisioningRuns: readonly IamInstanceKeycloakProvisioningRun[];
};

export type IamOrganizationChildItem = {
  readonly id: IamUuid;
  readonly organizationKey: string;
  readonly displayName: string;
  readonly isActive: boolean;
};

export type IamOrganizationDetail = IamOrganizationListItem & {
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly memberships: readonly IamOrganizationMembership[];
  readonly children: readonly IamOrganizationChildItem[];
};

export type IamOrganizationContextOption = {
  readonly organizationId: IamUuid;
  readonly organizationKey: string;
  readonly displayName: string;
  readonly organizationType: IamOrganizationType;
  readonly isActive: boolean;
  readonly isDefaultContext: boolean;
};

export type IamOrganizationContext = {
  readonly activeOrganizationId?: IamUuid;
  readonly organizations: readonly IamOrganizationContextOption[];
};
