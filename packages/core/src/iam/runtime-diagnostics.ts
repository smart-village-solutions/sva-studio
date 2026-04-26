import type {
  ApiErrorCode,
  IamRuntimeDiagnosticClassification,
  IamRuntimeDiagnostics,
  IamRuntimeRecommendedAction,
  IamRuntimeSafeDetails,
  IamRuntimeDiagnosticStatus,
} from './account-management-contract.js';

type RuntimeDiagnosticInput = {
  readonly code: ApiErrorCode | string;
  readonly status: number;
  readonly details?: Readonly<Record<string, unknown>>;
};

type RuntimeDiagnosticSafeDetails = Readonly<{
  input: RuntimeDiagnosticInput;
  safeDetails?: IamRuntimeSafeDetails;
}>;

const readString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const readSafeDetails = (details?: Readonly<Record<string, unknown>>): IamRuntimeSafeDetails | undefined => {
  if (!details) {
    return undefined;
  }

  const syncError =
    typeof details.syncError === 'object' && details.syncError !== null
      ? (details.syncError as Record<string, unknown>)
      : undefined;

  const safeDetails: IamRuntimeSafeDetails = {
    reason_code: readString(details.reason_code),
    dependency: readString(details.dependency),
    schema_object: readString(details.schema_object),
    expected_migration: readString(details.expected_migration),
    actor_resolution: readString(details.actor_resolution),
    instance_id: readString(details.instance_id),
    return_to: readString(details.return_to),
    sync_state: readString(details.sync_state) ?? readString(details.syncState),
    sync_error_code: readString(details.sync_error_code) ?? readString(details.syncErrorCode) ?? readString(syncError?.code),
  };

  return Object.values(safeDetails).some((value) => typeof value === 'string') ? safeDetails : undefined;
};

const classify = ({ input, safeDetails }: RuntimeDiagnosticSafeDetails): IamRuntimeDiagnosticClassification => {
  const reasonCode = safeDetails?.reason_code;
  const syncErrorCode = safeDetails?.sync_error_code;

  if (
    reasonCode === 'auth_resolution_failed' ||
    reasonCode === 'auth_config_missing' ||
    reasonCode === 'tenant_auth_resolution_failed' ||
    reasonCode === 'tenant_auth_client_secret_unreadable'
  ) {
    return 'auth_resolution';
  }

  if (
    reasonCode === 'oidc_discovery_failed' ||
    reasonCode === 'oidc_exchange_failed' ||
    reasonCode === 'oidc_callback_failed' ||
    reasonCode === 'token_exchange_failed'
  ) {
    return 'oidc_discovery_or_exchange';
  }

  if (
    reasonCode === 'frontend_state_stale' ||
    reasonCode === 'permission_snapshot_stale' ||
    reasonCode === 'permission_refetch_failed'
  ) {
    return 'frontend_state_or_permission_staleness';
  }

  if (
    reasonCode === 'legacy_workaround' ||
    reasonCode === 'legacy_session_payload' ||
    reasonCode === 'legacy_allowlist_fallback' ||
    reasonCode === 'return_encrypted' ||
    reasonCode === 'tenant_host_resolution_primary_hostname_fallback'
  ) {
    return 'legacy_workaround_or_regression';
  }

  if (reasonCode === 'registry_or_provisioning_drift_blocked') {
    return 'registry_or_provisioning_drift';
  }

  if (syncErrorCode === 'DB_WRITE_FAILED') {
    return 'database_mapping_or_membership_inconsistency';
  }

  if (syncErrorCode || safeDetails?.sync_state) {
    return 'keycloak_reconcile';
  }

  if (reasonCode === 'tenant_lookup_failed' || reasonCode?.startsWith('tenant_host_resolution_')) {
    return 'tenant_host_validation';
  }

  if (reasonCode === 'tenant_host_invalid') {
    return 'tenant_host_validation';
  }

  if (reasonCode === 'tenant_not_found' || reasonCode === 'tenant_inactive') {
    return 'registry_or_provisioning_drift';
  }

  if (
    input.code === 'unauthorized' ||
    input.code === 'reauth_required' ||
    reasonCode === 'token_refresh_failed' ||
    reasonCode === 'session_user_diagnostics' ||
    reasonCode === 'session_store_unavailable' ||
    reasonCode === 'missing_session_instance_id'
  ) {
    return 'session_store_or_session_hydration';
  }

  if (
    safeDetails?.actor_resolution === 'missing_actor_account' ||
    safeDetails?.actor_resolution === 'missing_instance_membership' ||
    reasonCode === 'missing_actor_account' ||
    reasonCode === 'missing_instance_membership'
  ) {
    return 'actor_resolution_or_membership';
  }

  if (
    input.code === 'keycloak_unavailable' ||
    reasonCode === 'keycloak_dependency_failed' ||
    reasonCode === 'keycloak_admin_not_configured' ||
    reasonCode === 'keycloak_unavailable'
  ) {
    return 'keycloak_dependency';
  }

  if (
    input.code === 'database_unavailable' ||
    reasonCode === 'schema_drift' ||
    reasonCode === 'missing_table' ||
    reasonCode === 'missing_column' ||
    reasonCode === 'database_not_configured'
  ) {
    return 'database_or_schema_drift';
  }

  if (
    reasonCode === 'jit_provision_failed' ||
    reasonCode === 'foreign_key_violation' ||
    reasonCode === 'rls_denied'
  ) {
    return 'database_mapping_or_membership_inconsistency';
  }

  if (
    input.code === 'tenant_auth_client_secret_missing' ||
    input.code === 'tenant_admin_client_not_configured' ||
    input.code === 'tenant_admin_client_secret_missing'
  ) {
    return 'registry_or_provisioning_drift';
  }

  return 'unknown';
};

const resolveStatus = (
  input: RuntimeDiagnosticInput,
  classification: IamRuntimeDiagnosticClassification
): IamRuntimeDiagnosticStatus => {
  if (input.code === 'unauthorized' || input.code === 'reauth_required') {
    return 'recovery_laeuft';
  }

  if (
    input.code === 'forbidden' ||
    input.code === 'csrf_validation_failed' ||
    input.code === 'invalid_request' ||
    input.code === 'conflict' ||
    input.code === 'feature_disabled' ||
    classification === 'keycloak_reconcile'
  ) {
    return 'manuelle_pruefung_erforderlich';
  }

  return 'degradiert';
};

const resolveRecommendedAction = (
  input: RuntimeDiagnosticInput,
  classification: IamRuntimeDiagnosticClassification
): IamRuntimeRecommendedAction => {
  if (input.code === 'unauthorized' || input.code === 'reauth_required') {
    return 'erneut_anmelden';
  }

  switch (classification) {
    case 'auth_resolution':
    case 'oidc_discovery_or_exchange':
      return 'erneut_anmelden';
    case 'keycloak_dependency':
      return 'keycloak_pruefen';
    case 'database_or_schema_drift':
      return 'migration_pruefen';
    case 'registry_or_provisioning_drift':
      return 'provisioning_pruefen';
    case 'keycloak_reconcile':
      return 'rollenabgleich_pruefen';
    case 'actor_resolution_or_membership':
    case 'database_mapping_or_membership_inconsistency':
    case 'legacy_workaround_or_regression':
      return 'manuell_pruefen';
    case 'frontend_state_or_permission_staleness':
      return 'erneut_versuchen';
    case 'unknown':
      return input.status >= 500 ? 'support_kontaktieren' : 'erneut_versuchen';
    default:
      return 'erneut_versuchen';
  }
};

export const deriveIamRuntimeDiagnostics = (input: RuntimeDiagnosticInput): IamRuntimeDiagnostics => {
  const safeDetails = readSafeDetails(input.details);
  const classification = classify({ input, safeDetails });

  return {
    classification,
    status: resolveStatus(input, classification),
    recommendedAction: resolveRecommendedAction(input, classification),
    ...(safeDetails ? { safeDetails } : {}),
  };
};
