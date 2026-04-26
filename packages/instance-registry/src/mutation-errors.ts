export type BlockedDriftErrorCode =
  | 'tenant_admin_client_not_configured'
  | 'tenant_admin_client_secret_missing'
  | 'tenant_auth_client_secret_missing';

export type InstanceMutationErrorCode =
  | BlockedDriftErrorCode
  | 'idempotency_key_reuse'
  | 'encryption_not_configured'
  | 'keycloak_unavailable';

export type InstanceMutationErrorClassification = {
  readonly status: 409 | 502 | 503;
  readonly code: InstanceMutationErrorCode;
  readonly details?: {
    readonly dependency: 'keycloak';
    readonly reason_code: 'registry_or_provisioning_drift_blocked';
    readonly drift_summary?: string;
  };
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

export const classifyInstanceMutationError = (error: unknown): InstanceMutationErrorClassification => {
  const message = error instanceof Error ? error.message : String(error);
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
  if (message.includes('idempotency_key_reuse')) {
    return {
      status: 409,
      code: 'idempotency_key_reuse',
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
  return {
    status: 502,
    code: 'keycloak_unavailable',
  };
};
