export type IamKeycloakMappingStatus = 'mapped' | 'unmapped' | 'manual_review';

export type IamKeycloakRoleCategory =
  | 'assignable'
  | 'system_admin'
  | 'keycloak_builtin'
  | 'client_role'
  | 'service_role'
  | 'platform_role';

export type IamKeycloakRealmRole = {
  readonly id: string;
  readonly roleName: string;
  readonly description?: string;
  readonly composite: boolean;
  readonly managedBy: 'studio' | 'external' | 'keycloak_builtin';
  readonly category: IamKeycloakRoleCategory;
  readonly assignable: boolean;
  readonly reasonCode?: string;
};

export type IamKeycloakRealmRoleAssignment = IamKeycloakRealmRole & {
  readonly direct: boolean;
  readonly effective: boolean;
  readonly origin: 'direct' | 'composite' | 'unassigned';
};

export type IamUserKeycloakRoleAssignments = {
  readonly userRef: string;
  readonly mappingStatus: IamKeycloakMappingStatus;
  readonly roles: readonly IamKeycloakRealmRoleAssignment[];
};

export type IamKeycloakRoleAssignmentMutationResult = {
  readonly userRef: string;
  readonly roleName: string;
  readonly operation: 'assign' | 'remove';
  readonly direct: boolean;
  readonly status: 'confirmed' | 'reconciliation_required';
};

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
