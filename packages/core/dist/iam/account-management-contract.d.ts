import type { IamLegalTextTargeting, IamRolePermissionAssignmentScope, IamUuid } from '@sva/iam-core';
import type { IamPermissionRuntimeScope } from './account-management.js';
import type { WasteManagementSettingsRecord } from '../waste-management-contract.js';
export type ApiErrorCode = 'unauthorized' | 'forbidden' | 'not_found' | 'invalid_request' | 'invalid_instance_id' | 'invalid_organization_id' | 'organization_inactive' | 'rate_limited' | 'csrf_validation_failed' | 'idempotency_key_required' | 'idempotency_key_reuse' | 'idempotency_in_progress' | 'keycloak_unavailable' | 'tenant_auth_client_secret_missing' | 'tenant_admin_client_not_configured' | 'tenant_admin_client_secret_missing' | 'encryption_not_configured' | 'database_unavailable' | 'mainserver_configuration_incomplete' | 'mainserver_credentials_missing' | 'mainserver_credentials_unavailable' | 'mainserver_credentials_invalid' | 'mainserver_user_conflict' | 'mainserver_provisioning_failed' | 'last_admin_protection' | 'self_protection' | 'feature_disabled' | 'conflict' | 'legal_acceptance_required' | 'reauth_required' | 'internal_error';
export declare const iamRuntimeDiagnosticClassifications: readonly ["auth_resolution", "oidc_discovery_or_exchange", "tenant_host_validation", "session_store_or_session_hydration", "actor_resolution_or_membership", "keycloak_dependency", "database_or_schema_drift", "database_mapping_or_membership_inconsistency", "registry_or_provisioning_drift", "keycloak_reconcile", "frontend_state_or_permission_staleness", "legacy_workaround_or_regression", "unknown"];
export type IamRuntimeDiagnosticClassification = (typeof iamRuntimeDiagnosticClassifications)[number];
export declare const iamRuntimeDiagnosticStatuses: readonly ["gesund", "degradiert", "recovery_laeuft", "manuelle_pruefung_erforderlich"];
export type IamRuntimeDiagnosticStatus = (typeof iamRuntimeDiagnosticStatuses)[number];
export declare const iamRuntimeRecommendedActions: readonly ["erneut_anmelden", "erneut_versuchen", "keycloak_pruefen", "migration_pruefen", "provisioning_pruefen", "rollenabgleich_pruefen", "manuell_pruefen", "support_kontaktieren"];
export type IamRuntimeRecommendedAction = (typeof iamRuntimeRecommendedActions)[number];
export type IamRuntimeSafeDetails = Readonly<{
    reason_code?: string;
    dependency?: string;
    schema_object?: string;
    expected_migration?: string;
    actor_resolution?: string;
    instance_id?: string;
    return_to?: string;
    auth_flow_id?: string;
    recovery_step?: string;
    sync_state?: string;
    sync_error_code?: string;
}>;
export type IamRuntimeDiagnostics = {
    readonly classification: IamRuntimeDiagnosticClassification;
    readonly status: IamRuntimeDiagnosticStatus;
    readonly recommendedAction: IamRuntimeRecommendedAction;
    readonly safeDetails?: IamRuntimeSafeDetails;
};
export type InstanceStatus = 'requested' | 'validated' | 'provisioning' | 'active' | 'failed' | 'suspended' | 'archived';
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
export type IamUserPermissionTraceSourceKind = 'direct_role' | 'group_role';
export type IamUserPermissionTraceStatus = 'effective' | 'inactive' | 'expired' | 'disabled';
export type IamUserPermissionTraceInactiveReason = 'assignment_not_started' | 'assignment_expired' | 'membership_not_started' | 'membership_expired' | 'group_disabled' | 'hierarchy_restricted';
export type IamUserPermissionTraceItem = {
    readonly permissionKey: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId?: string;
    readonly runtimeScope?: IamPermissionRuntimeScope;
    readonly organizationId?: IamUuid;
    readonly scope?: Readonly<Record<string, unknown>>;
    readonly accessScope?: IamRolePermissionAssignmentScope;
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
    readonly inheritedFromOrganizationId?: IamUuid;
    readonly inheritedFromGeoUnitId?: IamUuid;
    readonly restrictedByGeoUnitId?: IamUuid;
    readonly inactiveReason?: IamUserPermissionTraceInactiveReason;
    readonly validFrom?: string;
    readonly validTo?: string;
};
export type IamMainserverCredentialStatus = 'complete' | 'missing_application_id' | 'missing_application_secret' | 'missing_both' | 'unknown';
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
    readonly keycloakRoles?: readonly string[];
    readonly mainserverUserApplicationSecretSet: boolean;
    readonly mainserverCredentialStatus?: IamMainserverCredentialStatus;
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
    readonly permissionTrace?: readonly IamUserPermissionTraceItem[];
    readonly groups?: readonly IamUserGroupAssignment[];
    readonly organizationMemberships?: readonly IamUserOrganizationMembership[];
    readonly mainserverUserApplicationId?: string;
    readonly mainserverUserApplicationSecretSet: boolean;
    readonly fieldEditability?: IamKeycloakUserFieldEditability;
};
export type IamUserInvitationStatus = 'not_requested' | 'sent' | 'failed';
export type IamUserInvitationErrorCode = 'keycloak_user_not_ready' | 'keycloak_unavailable' | 'execute_actions_email_not_supported' | 'internal_error';
export type IamUserInvitationError = {
    readonly code: IamUserInvitationErrorCode;
    readonly message: string;
    readonly retryable: boolean;
};
export type IamCreateUserResult = {
    readonly user: IamUserDetail;
    readonly invitation: {
        readonly status: IamUserInvitationStatus;
        readonly error?: IamUserInvitationError;
    };
};
export type IamKeycloakMappingStatus = 'mapped' | 'unmapped' | 'manual_review';
export type IamKeycloakObjectEditability = 'editable' | 'read_only' | 'blocked';
export type IamKeycloakObjectDiagnosticCode = 'missing_instance_attribute' | 'forbidden_role_mapping' | 'read_only_federated_field' | 'idp_forbidden' | 'mapping_missing' | 'mapping_incomplete' | 'keycloak_projection_degraded' | 'tenant_admin_client_not_configured' | 'external_managed' | 'built_in_role' | 'system_role';
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
        readonly runtimeScope?: IamPermissionRuntimeScope;
        readonly isScopeAssignable?: boolean;
        readonly supportedAccessScopes?: readonly IamRolePermissionAssignmentScope[];
        readonly accessScope?: IamRolePermissionAssignmentScope;
    }[];
    readonly permissionAssignments?: readonly {
        readonly permissionId: IamUuid;
        readonly accessScope: IamRolePermissionAssignmentScope;
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
    readonly targets: IamLegalTextTargeting;
};
export type IamPendingLegalTextItem = {
    readonly id: IamUuid;
    readonly legalTextId: string;
    readonly name: string;
    readonly legalTextVersion: string;
    readonly locale: string;
    readonly contentHtml: string;
    readonly publishedAt?: string;
    readonly targets: IamLegalTextTargeting;
};
export type IamOrganizationType = 'county' | 'municipality' | 'district' | 'company' | 'agency' | 'other';
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
export type IamUserOrganizationMembership = {
    readonly organizationId: IamUuid;
    readonly organizationKey: string;
    readonly displayName: string;
    readonly organizationType: IamOrganizationType;
    readonly isActive: boolean;
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
    readonly assignedModules: readonly string[];
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
    readonly systemAdminRoleExists: boolean;
    readonly tenantAdminExists: boolean;
    readonly tenantAdminHasSystemAdmin: boolean;
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
export declare const instanceAuditCheckStatuses: readonly ["pass", "fail", "warn", "skip"];
export type InstanceAuditCheckStatus = (typeof instanceAuditCheckStatuses)[number];
export declare const instanceAuditCheckScopes: readonly ["instance", "registry", "keycloak", "localIam", "run"];
export type InstanceAuditCheckScope = (typeof instanceAuditCheckScopes)[number];
export type InstanceAuditCheck = {
    readonly checkId: string;
    readonly title: string;
    readonly scope: InstanceAuditCheckScope;
    readonly status: InstanceAuditCheckStatus;
    readonly expected: string;
    readonly actual: string;
    readonly evidenceSource: string;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly remediationHint?: string;
};
export type InstanceAuditInstanceResult = {
    readonly instanceId: string;
    readonly displayName: string;
    readonly status: InstanceStatus;
    readonly primaryHostname: string;
    readonly overallStatus: InstanceAuditCheckStatus;
    readonly checks: readonly InstanceAuditCheck[];
};
export type InstanceAuditRun = {
    readonly generatedAt: string;
    readonly requestId?: string;
    readonly actorId?: string;
    readonly includeOnlyActive: boolean;
    readonly targetInstanceIds: readonly string[];
    readonly overallStatus: InstanceAuditCheckStatus;
    readonly summary: {
        readonly totalInstances: number;
        readonly passCount: number;
        readonly failCount: number;
        readonly warnCount: number;
        readonly skipCount: number;
    };
    readonly checks: readonly InstanceAuditCheck[];
    readonly instances: readonly InstanceAuditInstanceResult[];
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
export declare const iamTenantIamAxisStatuses: readonly ["ready", "degraded", "blocked", "unknown"];
export type IamTenantIamAxisStatus = (typeof iamTenantIamAxisStatuses)[number];
export declare const iamTenantIamSources: readonly ["registry", "keycloak_status_snapshot", "keycloak_provisioning_run", "role_reconcile", "access_probe"];
export type IamTenantIamSource = (typeof iamTenantIamSources)[number];
export type IamTenantIamAxis = {
    readonly status: IamTenantIamAxisStatus;
    readonly summary: string;
    readonly source: IamTenantIamSource;
    readonly checkedAt?: string;
    readonly errorCode?: string;
    readonly requestId?: string;
};
export type IamTenantIamStatus = {
    readonly configuration: IamTenantIamAxis;
    readonly access: IamTenantIamAxis;
    readonly reconcile: IamTenantIamAxis;
    readonly overall: IamTenantIamAxis;
};
export type IamInstanceAssignedModule = {
    readonly moduleId: string;
    readonly permissionIds: readonly string[];
    readonly systemRoleNames: readonly string[];
};
export type IamInstanceModuleIamModuleStatus = {
    readonly moduleId: string;
    readonly status: IamTenantIamAxisStatus;
    readonly summary: string;
    readonly source: IamTenantIamSource;
    readonly permissionIds: readonly string[];
    readonly systemRoleNames: readonly string[];
};
export type IamInstanceModuleIamStatus = {
    readonly overall: IamTenantIamAxis;
    readonly modules: readonly IamInstanceModuleIamModuleStatus[];
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
    readonly tenantIamStatus?: IamTenantIamStatus;
    readonly moduleIamStatus?: IamInstanceModuleIamStatus;
    readonly wasteManagementSettings?: WasteManagementSettingsRecord;
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
    readonly mainserverApplicationId?: string;
    readonly mainserverApplicationSecretSet: boolean;
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
//# sourceMappingURL=account-management-contract.d.ts.map