export type ApiErrorCode =
  | 'unauthorized'
  | 'invalid_service_token'
  | 'missing_platform_role'
  | 'missing_action_scope'
  | 'identity_provider_unavailable'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'invalid_account_invitation_template'
  | 'account_invitation_template_revision_conflict'
  | 'invalid_instance_id'
  | 'invalid_organization_id'
  | 'organization_inactive'
  | 'rate_limited'
  | 'csrf_validation_failed'
  | 'idempotency_key_required'
  | 'idempotency_key_reuse'
  | 'idempotency_in_progress'
  | 'plugin_activation_required_cannot_disable'
  | 'plugin_activation_state_conflict'
  | 'unknown_module_contract'
  | 'plugin_tenant_lifecycle_not_declared'
  | 'plugin_tenant_lifecycle_inactive'
  | 'plugin_tenant_lifecycle_operation_not_declared'
  | 'plugin_tenant_lifecycle_handler_missing'
  | 'plugin_tenant_lifecycle_cancellation_mismatch'
  | 'plugin_tenant_lifecycle_claim_conflict'
  | 'plugin_tenant_lifecycle_invalid_transition'
  | 'plugin_tenant_lifecycle_request_conflict'
  | 'plugin_tenant_lifecycle_claim_failed'
  | 'plugin_tenant_lifecycle_job_creation_failed'
  | 'plugin_tenant_lifecycle_enqueue_failed'
  | 'plugin_tenant_lifecycle_start_failed'
  | 'plugin_tenant_access_blocked'
  | 'invalid_source_year'
  | 'replacement_date_invalid'
  | 'batch_limit_exceeded'
  | 'preview_stale'
  | 'target_identity_conflict'
  | 'target_conflict_unacknowledged'
  | 'active_job_exists'
  | 'keycloak_unavailable'
  | 'keycloak_request_failed'
  | 'keycloak_role_write_rejected'
  | 'tenant_auth_client_secret_missing'
  | 'tenant_admin_client_not_configured'
  | 'tenant_admin_client_secret_missing'
  | 'encryption_not_configured'
  | 'database_unavailable'
  | 'mainserver_configuration_incomplete'
  | 'mainserver_credentials_missing'
  | 'mainserver_credentials_partial'
  | 'mainserver_credentials_stale'
  | 'mainserver_credentials_unavailable'
  | 'mainserver_credentials_invalid'
  | 'mainserver_user_conflict'
  | 'mainserver_provisioning_failed'
  | 'keycloak_role_protected'
  | 'keycloak_role_assignment_not_direct'
  | 'keycloak_role_assignment_reconciliation_required'
  | 'last_admin_protection'
  | 'self_protection'
  | 'feature_disabled'
  | 'conflict'
  | 'legal_acceptance_required'
  | 'reauth_required'
  | 'confirmation_required'
  | 'invalid_confirmation'
  | 'internal_unclassified'
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

export type IamRuntimeDiagnosticClassification =
  (typeof iamRuntimeDiagnosticClassifications)[number];

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
  auth_flow_id?: string;
  recovery_step?: string;
  field?: string;
  step?: string;
  impact?: string;
  remediation?: string;
  responsibility?: string;
  next_check?: string;
  retry_class?: 'never' | 'safe' | 'conditional';
  run_id?: string;
  sync_state?: string;
  sync_error_code?: string;
  moduleIds?: readonly string[];
  errorCodes?: readonly string[];
}>;

export type IamRuntimeDiagnostics = {
  readonly classification: IamRuntimeDiagnosticClassification;
  readonly status: IamRuntimeDiagnosticStatus;
  readonly recommendedAction: IamRuntimeRecommendedAction;
  readonly safeDetails?: IamRuntimeSafeDetails;
};

export type InstanceStatus =
  'requested' | 'validated' | 'provisioning' | 'active' | 'failed' | 'suspended' | 'archived';

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

export * from './account-user-contract.js';
export * from './account-keycloak-contract.js';
export * from './account-role-group-contract.js';
export * from './account-organization-contract.js';
export * from './account-instance-contract.js';
export * from './account-tenant-status-contract.js';
