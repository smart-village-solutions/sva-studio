import { createSdkLogger } from '@sva/server-runtime';

import {
  createGetKeycloakPreflightHandler,
  createGetKeycloakStatusHandler,
  createPlanKeycloakProvisioningHandler,
} from './service-keycloak.js';
import { buildInstanceDetail } from './service-helpers.js';

import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';

type InstanceRecord = NonNullable<Awaited<ReturnType<InstanceRegistryRepository['getInstanceById']>>>;
const logger = createSdkLogger({ component: 'iam-instance-registry-service', level: 'info' });

const loadOptionalArtifact = async <T>(
  instanceId: string,
  artifactKey: 'keycloak_status' | 'keycloak_preflight' | 'keycloak_plan',
  load: () => Promise<T | null>
): Promise<T | undefined> => {
  try {
    return (await load()) ?? undefined;
  } catch (error) {
    logger.warn('instance_detail_optional_artifact_failed', {
      operation: 'get_instance_detail',
      instance_id: instanceId,
      artifact_key: artifactKey,
      error_type: error instanceof Error ? error.constructor.name : typeof error,
    });
    return undefined;
  }
};

export const loadKeycloakDetailArtifacts = async (
  deps: InstanceRegistryServiceDeps,
  instance: InstanceRecord
) => {
  const getKeycloakStatus = createGetKeycloakStatusHandler(deps);
  const getKeycloakPreflight = createGetKeycloakPreflightHandler(deps);
  const planKeycloakProvisioning = createPlanKeycloakProvisioningHandler(deps);

  const [provisioningRuns, auditEvents, keycloakStatus, keycloakPreflight, keycloakPlan, keycloakProvisioningRuns] =
    await Promise.all([
      deps.repository.listProvisioningRuns(instance.instanceId),
      deps.repository.listAuditEvents(instance.instanceId),
      loadOptionalArtifact(instance.instanceId, 'keycloak_status', () => getKeycloakStatus(instance.instanceId)),
      loadOptionalArtifact(instance.instanceId, 'keycloak_preflight', () => getKeycloakPreflight(instance.instanceId)),
      loadOptionalArtifact(instance.instanceId, 'keycloak_plan', () => planKeycloakProvisioning(instance.instanceId)),
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
