export type BlockedDriftErrorCode =
  | 'tenant_admin_client_not_configured'
  | 'tenant_admin_client_secret_missing'
  | 'tenant_auth_client_secret_missing';

export type InstanceMutationErrorCode =
  | BlockedDriftErrorCode
  | 'idempotency_key_reuse'
  | 'oidc_client_id_reserved'
  | 'tenant_hostname_reserved'
  | 'tenant_hostname_conflict'
  | 'auth_realm_conflict'
  | 'instance_configuration_change_blocked'
  | 'provisioning_retry_mode_invalid'
  | 'provisioning_retry_instance_status_invalid'
  | 'provisioning_retry_not_safe'
  | 'provisioning_retry_conflict'
  | 'database_unavailable'
  | 'encryption_not_configured'
  | 'keycloak_unavailable'
  | 'keycloak_create_readiness_blocked'
  | 'keycloak_plan_blocked'
  | 'keycloak_plan_confirmation_missing'
  | 'keycloak_plan_fingerprint_stale'
  | 'activation_readiness_blocked'
  | 'plugin_activation_state_conflict'
  | 'internal_unclassified';

export type InstanceMutationErrorClassification = {
  readonly status: 400 | 409 | 500 | 502 | 503;
  readonly code: InstanceMutationErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
};

const stableConflictCodes = [
  'idempotency_key_reuse',
  'auth_realm_conflict',
  'tenant_hostname_conflict',
  'instance_configuration_change_blocked',
  'provisioning_retry_mode_invalid',
  'provisioning_retry_instance_status_invalid',
  'provisioning_retry_not_safe',
  'provisioning_retry_conflict',
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
      details: {
        reason_code: stableConflictCode,
        retry_class: stableConflictCode === 'provisioning_retry_conflict' ? 'safe' : 'never',
      },
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
  if (message.startsWith('keycloak_create_readiness_blocked:')) {
    return {
      status: 503,
      code: 'keycloak_create_readiness_blocked',
      details: {
        dependency: 'keycloak',
        reason_code: 'keycloak_create_readiness_blocked',
        step: 'create_preflight',
        impact: 'create_blocked',
        remediation: 'draft_readiness_recheck',
        responsibility: 'studio_admin_or_platform_operator',
        next_check: 'draft_readiness',
        retry_class: 'conditional',
        errorCodes: message
          .slice('keycloak_create_readiness_blocked:'.length)
          .split(',')
          .filter(Boolean),
      },
    };
  }
  if (message.includes('keycloak_plan_confirmation_missing')) {
    return { status: 409, code: 'keycloak_plan_confirmation_missing' };
  }
  if (message.includes('keycloak_plan_fingerprint_stale')) {
    return {
      status: 409,
      code: 'keycloak_plan_fingerprint_stale',
      details: {
        reason_code: 'keycloak_plan_fingerprint_stale',
        step: 'keycloak_plan_confirmation',
        impact: 'provisioning_blocked',
        remediation: 'plan_recheck_and_confirm',
        responsibility: 'studio_admin',
        next_check: 'keycloak_plan',
        retry_class: 'never',
      },
    };
  }
  if (message.includes('keycloak_plan_blocked')) {
    return { status: 409, code: 'keycloak_plan_blocked' };
  }
  if (message.startsWith('activation_readiness_blocked:')) {
    return {
      status: 409,
      code: 'activation_readiness_blocked',
      details: {
        reason_code: 'activation_readiness_blocked',
        step: 'activation_preflight',
        impact: 'activation_blocked',
        remediation: 'instance_detail_recheck',
        responsibility: 'studio_admin_or_platform_operator',
        next_check: 'instance_detail',
        retry_class: 'never',
        errorCodes: message
          .slice('activation_readiness_blocked:'.length)
          .split(',')
          .filter(Boolean),
      },
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
  if (message.includes('keycloak_unavailable')) {
    return {
      status: 502,
      code: 'keycloak_unavailable',
      details: {
        dependency: 'keycloak',
        reason_code: 'keycloak_unavailable',
        remediation: 'keycloak_recheck',
        responsibility: 'platform_operator',
        next_check: 'keycloak_preflight',
        retry_class: 'conditional',
      },
    };
  }
  return {
    status: 500,
    code: 'internal_unclassified',
    details: {
      reason_code: 'internal_unclassified',
      remediation: 'request_id_inspect',
      responsibility: 'platform_operator',
      retry_class: 'never',
    },
  };
};
