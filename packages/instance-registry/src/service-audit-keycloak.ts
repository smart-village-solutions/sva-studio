import { createSdkLogger } from '@sva/server-runtime';

import type { KeycloakTenantStatus } from './keycloak-types.js';
import { createGetKeycloakStatusHandler } from './service-keycloak.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { buildKeycloakChecks } from './service-audit-keycloak-checks.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

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
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('instance_audit_keycloak_status_failed', {
        instance_id: instanceId,
        error: message,
      });
      try {
        const fallback = await createGetKeycloakStatusHandler(deps)(instanceId);
        return {
          status: null,
          evidenceSource: 'keycloak_live',
          error: message,
          fallbackStatus: fallback,
          fallbackEvidenceSource: 'keycloak_snapshot',
        };
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        logger.warn('instance_audit_keycloak_fallback_failed', {
          instance_id: instanceId,
          error: fallbackMessage,
        });
        return {
          status: null,
          evidenceSource: 'keycloak_live',
          error: message,
          fallbackEvidenceSource: 'keycloak_snapshot',
          fallbackError: fallbackMessage,
        };
      }
    }
  }

  const fallback = await createGetKeycloakStatusHandler(deps)(instanceId);
  return { status: fallback, evidenceSource: 'keycloak_snapshot' };
};
export { buildKeycloakChecks } from './service-audit-keycloak-checks.js';
