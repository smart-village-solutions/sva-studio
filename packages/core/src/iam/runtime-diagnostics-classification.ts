import type {
  ApiErrorCode,
  IamRuntimeDiagnosticClassification,
  IamRuntimeSafeDetails,
} from './account-management-contract.js';

export type RuntimeDiagnosticInput = {
  readonly code: ApiErrorCode | string;
  readonly status: number;
  readonly details?: Readonly<Record<string, unknown>>;
};

type RuntimeDiagnosticSafeDetails = Readonly<{
  input: RuntimeDiagnosticInput;
  safeDetails?: IamRuntimeSafeDetails;
}>;

type RuntimeDiagnosticClassificationResolver = (
  context: RuntimeDiagnosticSafeDetails
) => IamRuntimeDiagnosticClassification | undefined;

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
  ['silent_recovery_timeout', 'oidc_discovery_or_exchange'],
  ['silent_recovery_failed', 'oidc_discovery_or_exchange'],
  ['silent_recovery_succeeded', 'frontend_state_or_permission_staleness'],
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
  'missing_session_cookie',
  'invalid_session',
  'session_expired',
  'session_not_allowed',
  'token_refresh_failed_before_expiry',
  'token_refresh_failed_after_expiry',
  'forced_reauth',
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

const ACTOR_RESOLUTION_CODES = new Set(['missing_actor_account', 'missing_instance_membership']);

const REGISTRY_DRIFT_INPUT_CODES = new Set([
  'unknown_module_contract',
  'tenant_auth_client_secret_missing',
  'tenant_admin_client_not_configured',
  'tenant_admin_client_secret_missing',
  'mainserver_configuration_incomplete',
  'mainserver_credentials_missing',
  'mainserver_credentials_partial',
  'mainserver_credentials_stale',
  'mainserver_credentials_unavailable',
  'mainserver_credentials_invalid',
  'mainserver_user_conflict',
  'mainserver_provisioning_failed',
]);

const SESSION_INPUT_CODES = new Set<ApiErrorCode>(['unauthorized', 'reauth_required']);
const KEYCLOAK_INPUT_CODES = new Set<ApiErrorCode>(['keycloak_unavailable']);
const DATABASE_INPUT_CODES = new Set<ApiErrorCode>(['database_unavailable']);

const DEPENDENCY_CLASSIFICATION_RULES = [
  [KEYCLOAK_INPUT_CODES, KEYCLOAK_REASON_CODES, 'keycloak_dependency'],
  [DATABASE_INPUT_CODES, DATABASE_REASON_CODES, 'database_or_schema_drift'],
  [undefined, DATABASE_MAPPING_REASON_CODES, 'database_mapping_or_membership_inconsistency'],
] as const;

const readReasonClassification = (
  reasonCode: string | undefined,
  classifications: ReadonlyMap<string, IamRuntimeDiagnosticClassification>
): IamRuntimeDiagnosticClassification | undefined =>
  reasonCode ? classifications.get(reasonCode) : undefined;

const matchesReasonCode = (
  reasonCode: string | undefined,
  reasonCodes: ReadonlySet<string>
): boolean => reasonCode !== undefined && reasonCodes.has(reasonCode);

const resolvePreSyncClassification: RuntimeDiagnosticClassificationResolver = ({ safeDetails }) =>
  readReasonClassification(safeDetails?.reason_code, PRE_SYNC_REASON_CLASSIFICATIONS);

const resolveSyncClassification: RuntimeDiagnosticClassificationResolver = ({ safeDetails }) => {
  const syncErrorCode = safeDetails?.sync_error_code;
  if (syncErrorCode === 'DB_WRITE_FAILED') {
    return 'database_mapping_or_membership_inconsistency';
  }

  return syncErrorCode || safeDetails?.sync_state ? 'keycloak_reconcile' : undefined;
};

const resolveTenantHostClassification: RuntimeDiagnosticClassificationResolver = ({
  safeDetails,
}) =>
  safeDetails?.reason_code?.startsWith('tenant_host_resolution_')
    ? 'tenant_host_validation'
    : readReasonClassification(safeDetails?.reason_code, POST_SYNC_REASON_CLASSIFICATIONS);

const resolveSessionClassification: RuntimeDiagnosticClassificationResolver = ({
  input,
  safeDetails,
}) =>
  SESSION_INPUT_CODES.has(input.code as ApiErrorCode) ||
  matchesReasonCode(safeDetails?.reason_code, SESSION_REASON_CODES)
    ? 'session_store_or_session_hydration'
    : undefined;

const resolveActorClassification: RuntimeDiagnosticClassificationResolver = ({ safeDetails }) =>
  matchesReasonCode(safeDetails?.actor_resolution, ACTOR_RESOLUTION_CODES) ||
  matchesReasonCode(safeDetails?.reason_code, ACTOR_RESOLUTION_CODES)
    ? 'actor_resolution_or_membership'
    : undefined;

const resolveDependencyClassification: RuntimeDiagnosticClassificationResolver = ({
  input,
  safeDetails,
}) => {
  for (const [inputCodes, reasonCodes, classification] of DEPENDENCY_CLASSIFICATION_RULES) {
    if (
      inputCodes?.has(input.code as ApiErrorCode) ||
      matchesReasonCode(safeDetails?.reason_code, reasonCodes)
    ) {
      return classification;
    }
  }

  return REGISTRY_DRIFT_INPUT_CODES.has(input.code) ? 'registry_or_provisioning_drift' : undefined;
};

const CLASSIFICATION_RESOLVERS = [
  resolvePreSyncClassification,
  resolveSyncClassification,
  resolveTenantHostClassification,
  resolveSessionClassification,
  resolveActorClassification,
  resolveDependencyClassification,
] as const satisfies readonly RuntimeDiagnosticClassificationResolver[];

export const classify = ({
  input,
  safeDetails,
}: RuntimeDiagnosticSafeDetails): IamRuntimeDiagnosticClassification => {
  for (const resolveClassification of CLASSIFICATION_RESOLVERS) {
    const classification = resolveClassification({ input, safeDetails });
    if (classification) {
      return classification;
    }
  }

  return 'unknown';
};
