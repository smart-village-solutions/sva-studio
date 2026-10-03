import { createSdkLogger } from '@sva/server-runtime';

import type { KeycloakTenantStatus } from './keycloak-types.js';
import { createGetKeycloakStatusHandler } from './service-keycloak.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

export { buildKeycloakChecks } from './service-audit-keycloak-checks.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-audit', level: 'info' });

export const resolveKeycloakStatus = async (
  deps: InstanceRegistryServiceDeps,
  instanceId: string
): Promise<{
  status: KeycloakTenantStatus | null;
  evidenceSource: string;
  error?: string;
  fallbackStatus?: KeycloakTenantStatus | null;
  fallbackEvidenceSource?: string;
  fallbackError?: string;
}> => {
  const loaded = await loadInstanceWithSecret(deps, instanceId);
  if (!loaded) {
    return { status: null, evidenceSource: 'instance_registry' };
  }

  if (deps.getKeycloakStatus) {
    try {
      const status = await deps.getKeycloakStatus({
        instanceId: loaded.instance.instanceId,
        primaryHostname: loaded.instance.primaryHostname,
        realmMode: loaded.instance.realmMode,
        authRealm: loaded.instance.authRealm,
        authClientId: loaded.instance.authClientId,
        authIssuerUrl: loaded.instance.authIssuerUrl,
        authClientSecretConfigured: loaded.instance.authClientSecretConfigured,
        authClientSecret: loaded.authClientSecret,
        tenantAdminClient: loaded.instance.tenantAdminClient,
        tenantAdminClientSecret: loaded.tenantAdminClientSecret,
        tenantAdminBootstrap: loaded.instance.tenantAdminBootstrap,
      });
      return { status, evidenceSource: 'keycloak_live' };
    } catch (error) {
      const reasonCode = 'KEYCLOAK_STATUS_UNAVAILABLE';
      logger.warn('instance_audit_keycloak_status_failed', {
        operation: 'audit_instance_keycloak',
        result: 'failed',
        instance_id: instanceId,
        dependency: 'keycloak',
        error_type: error instanceof Error ? error.name : typeof error,
        error_code: reasonCode,
      });
      try {
        const fallback = await createGetKeycloakStatusHandler(deps)(instanceId);
        return {
          status: null,
          evidenceSource: 'keycloak_live',
          error: reasonCode,
          fallbackStatus: fallback,
          fallbackEvidenceSource: 'keycloak_snapshot',
        };
      } catch (fallbackError) {
        const fallbackReasonCode = 'KEYCLOAK_SNAPSHOT_UNAVAILABLE';
        logger.warn('instance_audit_keycloak_fallback_failed', {
          operation: 'audit_instance_keycloak',
          result: 'failed',
          instance_id: instanceId,
          dependency: 'instance_registry',
          error_type: fallbackError instanceof Error ? fallbackError.name : typeof fallbackError,
          error_code: fallbackReasonCode,
        });
        return {
          status: null,
          evidenceSource: 'keycloak_live',
          error: reasonCode,
          fallbackEvidenceSource: 'keycloak_snapshot',
          fallbackError: fallbackReasonCode,
        };
      }
    }
  }

  const fallback = await createGetKeycloakStatusHandler(deps)(instanceId);
  return { status: fallback, evidenceSource: 'keycloak_snapshot' };
};
