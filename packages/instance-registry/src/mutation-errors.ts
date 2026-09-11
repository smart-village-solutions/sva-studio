export type BlockedDriftErrorCode =
  | 'tenant_admin_client_not_configured'
  | 'tenant_admin_client_secret_missing'
  | 'tenant_auth_client_secret_missing';

export type InstanceMutationErrorCode =
  | BlockedDriftErrorCode
  | 'idempotency_key_reuse'
  | 'oidc_client_id_reserved'
  | 'tenant_hostname_reserved'
  | 'auth_realm_conflict'
  | 'instance_configuration_change_blocked'
  | 'database_unavailable'
  | 'encryption_not_configured'
  | 'keycloak_unavailable'
  | 'plugin_activation_state_conflict'
  | 'internal_unclassified';

export type InstanceMutationErrorClassification = {
  readonly status: 400 | 409 | 500 | 502 | 503;
  readonly code: InstanceMutationErrorCode;
  readonly details?: {
    readonly dependency: 'keycloak';
    readonly reason_code: 'registry_or_provisioning_drift_blocked';
    readonly drift_summary?: string;
  };
};

const stableConflictCodes = [
  'idempotency_key_reuse',
  'auth_realm_conflict',
  'instance_configuration_change_blocked',
] as const;

const readMutationErrorMessage = (error: unknown): string => {
  const databaseError =
    typeof error === 'object' && error !== null
      ? (error as { readonly code?: unknown; readonly constraint?: unknown })
      : undefined;
  if (
    databaseError?.code === '23505' &&
    databaseError.constraint === 'instances_auth_realm_unique'
  ) {
    return 'auth_realm_conflict';
  }
  return error instanceof Error ? error.message : String(error);
};

const inferBlockedDriftErrorCode = (driftSummary: string): BlockedDriftErrorCode => {
  const normalizedSummary = driftSummary.toLowerCase();
  if (
    normalizedSummary.includes('tenant_auth_client_secret_missing') ||
    normalizedSummary.includes('tenant-client-secret')
  ) {
    return 'tenant_auth_client_secret_missing';
  }
  if (
    normalizedSummary.includes('tenant_admin_client_secret_missing') ||
    (normalizedSummary.includes('tenant-admin-client') && normalizedSummary.includes('secret'))
  ) {
    return 'tenant_admin_client_secret_missing';
  }
  return 'tenant_admin_client_not_configured';
};

export const classifyInstanceMutationError = (
  error: unknown
): InstanceMutationErrorClassification => {
  const message = readMutationErrorMessage(error);
  if (message.startsWith('registry_or_provisioning_drift_blocked:')) {
    const driftSummary = message.slice('registry_or_provisioning_drift_blocked:'.length).trim();
    return {
      status: 409,
      code: inferBlockedDriftErrorCode(driftSummary),
      details: {
        dependency: 'keycloak',
        reason_code: 'registry_or_provisioning_drift_blocked',
        drift_summary: driftSummary || undefined,
      },
    };
  }
  const stableConflictCode = stableConflictCodes.find((code) => message.includes(code));
  if (stableConflictCode) {
    return {
      status: 409,
      code: stableConflictCode,
    };
  }
  if (message === 'tenant_hostname_reserved') {
    return { status: 400, code: 'tenant_hostname_reserved' };
  }
  if (message.includes('oidc_client_id_reserved')) {
    return {
      status: 400,
      code: 'oidc_client_id_reserved',
    };
  }
  if (message.startsWith('plugin_activation_state_conflict:')) {
    return {
      status: 409,
      code: 'plugin_activation_state_conflict',
    };
  }
  if (message.includes('tenant_admin_client_not_configured')) {
    return {
      status: 409,
      code: 'tenant_admin_client_not_configured',
    };
  }
  if (message.includes('tenant_admin_client_secret_missing')) {
    return {
      status: 409,
      code: 'tenant_admin_client_secret_missing',
    };
  }
  if (message.includes('tenant_auth_client_secret_missing')) {
    return {
      status: 409,
      code: 'tenant_auth_client_secret_missing',
    };
  }
  if (message.startsWith('pii_encryption_required')) {
    return {
      status: 503,
      code: 'encryption_not_configured',
    };
  }
  if (
    message.includes('row-level security policy') ||
    message.includes('does not exist') ||
    message.includes('relation "') ||
    message.includes('undefined_table') ||
    message.includes('database_unavailable')
  ) {
    return {
      status: 503,
      code: 'database_unavailable',
    };
  }
  return {
    status: 500,
    code: 'internal_unclassified',
  };
};
