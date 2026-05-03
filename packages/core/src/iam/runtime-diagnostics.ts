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

const PRE_SYNC_REASON_CLASSIFICATIONS = new Map<string, IamRuntimeDiagnosticClassification>([
  ['auth_resolution_failed', 'auth_resolution'],
  ['auth_config_missing', 'auth_resolution'],
  ['tenant_auth_resolution_failed', 'auth_resolution'],
  ['tenant_auth_client_secret_unreadable', 'auth_resolution'],
  ['oidc_discovery_failed', 'oidc_discovery_or_exchange'],
  ['oidc_exchange_failed', 'oidc_discovery_or_exchange'],
  ['oidc_callback_failed', 'oidc_discovery_or_exchange'],
  ['token_exchange_failed', 'oidc_discovery_or_exchange'],
  ['frontend_state_stale', 'frontend_state_or_permission_staleness'],
  ['permission_snapshot_stale', 'frontend_state_or_permission_staleness'],
  ['permission_refetch_failed', 'frontend_state_or_permission_staleness'],
  ['legacy_workaround', 'legacy_workaround_or_regression'],
  ['legacy_session_payload', 'legacy_workaround_or_regression'],
  ['legacy_allowlist_fallback', 'legacy_workaround_or_regression'],
  ['return_encrypted', 'legacy_workaround_or_regression'],
  ['tenant_host_resolution_primary_hostname_fallback', 'legacy_workaround_or_regression'],
  ['registry_or_provisioning_drift_blocked', 'registry_or_provisioning_drift'],
]);

const POST_SYNC_REASON_CLASSIFICATIONS = new Map<string, IamRuntimeDiagnosticClassification>([
  ['tenant_lookup_failed', 'tenant_host_validation'],
  ['tenant_host_invalid', 'tenant_host_validation'],
  ['tenant_not_found', 'registry_or_provisioning_drift'],
  ['tenant_inactive', 'registry_or_provisioning_drift'],
]);

const SESSION_REASON_CODES = new Set([
  'token_refresh_failed',
  'session_user_diagnostics',
  'session_store_unavailable',
  'missing_session_instance_id',
]);

const KEYCLOAK_REASON_CODES = new Set([
  'keycloak_dependency_failed',
  'keycloak_admin_not_configured',
  'keycloak_unavailable',
]);

const DATABASE_REASON_CODES = new Set([
  'schema_drift',
  'missing_table',
  'missing_column',
  'database_not_configured',
]);

const DATABASE_MAPPING_REASON_CODES = new Set([
  'jit_provision_failed',
  'foreign_key_violation',
  'rls_denied',
]);

const REGISTRY_DRIFT_INPUT_CODES = new Set([
  'tenant_auth_client_secret_missing',
  'tenant_admin_client_not_configured',
  'tenant_admin_client_secret_missing',
]);

const SESSION_INPUT_CODES = new Set<ApiErrorCode>(['unauthorized', 'reauth_required']);
const KEYCLOAK_INPUT_CODES = new Set<ApiErrorCode>(['keycloak_unavailable']);
const DATABASE_INPUT_CODES = new Set<ApiErrorCode>(['database_unavailable']);

const readString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const readReasonClassification = (
  reasonCode: string | undefined,
  classifications: ReadonlyMap<string, IamRuntimeDiagnosticClassification>
): IamRuntimeDiagnosticClassification | undefined => (reasonCode ? classifications.get(reasonCode) : undefined);

const matchesReasonCode = (reasonCode: string | undefined, reasonCodes: ReadonlySet<string>): boolean =>
  reasonCode !== undefined && reasonCodes.has(reasonCode);

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
  const preSyncClassification = readReasonClassification(reasonCode, PRE_SYNC_REASON_CLASSIFICATIONS);

  if (preSyncClassification) {
    return preSyncClassification;
  }

  if (syncErrorCode === 'DB_WRITE_FAILED') {
    return 'database_mapping_or_membership_inconsistency';
  }

  if (syncErrorCode || safeDetails?.sync_state) {
    return 'keycloak_reconcile';
  }

  if (reasonCode?.startsWith('tenant_host_resolution_')) {
    return 'tenant_host_validation';
  }

  const postSyncClassification = readReasonClassification(reasonCode, POST_SYNC_REASON_CLASSIFICATIONS);
  if (postSyncClassification) {
    return postSyncClassification;
  }

  if (
    SESSION_INPUT_CODES.has(input.code as ApiErrorCode) ||
    matchesReasonCode(reasonCode, SESSION_REASON_CODES)
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

  if (KEYCLOAK_INPUT_CODES.has(input.code as ApiErrorCode) || matchesReasonCode(reasonCode, KEYCLOAK_REASON_CODES)) {
    return 'keycloak_dependency';
  }

  if (DATABASE_INPUT_CODES.has(input.code as ApiErrorCode) || matchesReasonCode(reasonCode, DATABASE_REASON_CODES)) {
    return 'database_or_schema_drift';
  }

  if (matchesReasonCode(reasonCode, DATABASE_MAPPING_REASON_CODES)) {
    return 'database_mapping_or_membership_inconsistency';
  }

  if (REGISTRY_DRIFT_INPUT_CODES.has(input.code)) {
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
