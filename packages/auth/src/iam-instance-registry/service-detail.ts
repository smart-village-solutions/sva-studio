import { createSdkLogger } from '@sva/sdk/server';

import { loadRepositoryAuthClientSecret } from './service-keycloak.js';
import { buildInstanceDetail } from './service-helpers.js';

import type { InstanceRegistryRepository } from '@sva/data';
import type { InstanceRegistryServiceDeps, InstanceRegistryService } from './service-types.js';

type InstanceRecord = NonNullable<Awaited<ReturnType<InstanceRegistryRepository['getInstanceById']>>>;
const logger = createSdkLogger({ component: 'iam-instance-registry-service', level: 'info' });

const loadOptionalArtifact = async <T>(
  instanceId: string,
  artifactKey: 'keycloak_status' | 'keycloak_preflight' | 'keycloak_plan',
  load: () => Promise<T | undefined>
): Promise<T | undefined> => {
  try {
    return await load();
  } catch (error) {
    logger.warn('instance_detail_optional_artifact_failed', {
      operation: 'get_instance_detail',
      instance_id: instanceId,
      artifact_key: artifactKey,
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error_message: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
};

export const loadKeycloakDetailArtifacts = async (
  deps: InstanceRegistryServiceDeps,
  instance: InstanceRecord
) => {
  const authClientSecret = await loadRepositoryAuthClientSecret(deps.repository, instance.instanceId);
  const [provisioningRuns, auditEvents, keycloakStatus, keycloakPreflight, keycloakPlan, keycloakProvisioningRuns] = await Promise.all([
    deps.repository.listProvisioningRuns(instance.instanceId),
    deps.repository.listAuditEvents(instance.instanceId),
    loadOptionalArtifact(instance.instanceId, 'keycloak_status', async () =>
      deps.getKeycloakStatus?.({
        instanceId: instance.instanceId,
        primaryHostname: instance.primaryHostname,
        realmMode: instance.realmMode,
        authRealm: instance.authRealm,
        authClientId: instance.authClientId,
        authIssuerUrl: instance.authIssuerUrl,
        authClientSecretConfigured: instance.authClientSecretConfigured,
        authClientSecret,
        tenantAdminBootstrap: instance.tenantAdminBootstrap,
      })
    ),
    loadOptionalArtifact(instance.instanceId, 'keycloak_preflight', async () =>
      deps.getKeycloakPreflight?.({
        instanceId: instance.instanceId,
        primaryHostname: instance.primaryHostname,
        realmMode: instance.realmMode,
        authRealm: instance.authRealm,
        authClientId: instance.authClientId,
        authIssuerUrl: instance.authIssuerUrl,
        authClientSecretConfigured: instance.authClientSecretConfigured,
        authClientSecret,
        tenantAdminBootstrap: instance.tenantAdminBootstrap,
      })
    ),
    loadOptionalArtifact(instance.instanceId, 'keycloak_plan', async () =>
      deps.planKeycloakProvisioning?.({
        instanceId: instance.instanceId,
        primaryHostname: instance.primaryHostname,
        realmMode: instance.realmMode,
        authRealm: instance.authRealm,
        authClientId: instance.authClientId,
        authIssuerUrl: instance.authIssuerUrl,
        authClientSecretConfigured: instance.authClientSecretConfigured,
        authClientSecret,
        tenantAdminBootstrap: instance.tenantAdminBootstrap,
      })
    ),
    deps.repository.listKeycloakProvisioningRuns(instance.instanceId),
  ]);

  return buildInstanceDetail(
    instance,
    provisioningRuns,
    auditEvents,
    keycloakStatus,
    keycloakPreflight,
    keycloakPlan,
    keycloakProvisioningRuns
  );
};

export const createGetInstanceDetail =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['getInstanceDetail'] =>
  async (instanceId) => {
    const instance = await deps.repository.getInstanceById(instanceId);
    if (!instance) {
      return null;
    }
    return loadKeycloakDetailArtifacts(deps, instance);
  };
