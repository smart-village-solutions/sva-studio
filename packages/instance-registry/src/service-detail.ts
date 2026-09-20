import { isInstanceTenantAdminRequired } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import {
  createGetKeycloakPreflightHandler,
  createGetKeycloakStatusHandler,
  createPlanKeycloakProvisioningHandler,
} from './service-keycloak.js';
import {
  buildInstanceDetail,
  buildModuleIamStatus,
  buildTenantIamStatus,
} from './service-helpers.js';
import { buildBackgroundProvisioningCapabilities } from './service-draft-readiness.js';
import {
  isTenantProvisioningFailureRetryable,
  shouldExposeAutomatedProvisioning,
} from './service-active-provisioning.js';

import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';

type InstanceRecord = NonNullable<
  Awaited<ReturnType<InstanceRegistryRepository['getInstanceById']>>
>;
const logger = createSdkLogger({ component: 'iam-instance-registry-service', level: 'info' });

const loadOptionalArtifact = async <T>(
  instanceId: string,
  artifactKey:
    'keycloak_status' | 'keycloak_preflight' | 'keycloak_plan' | 'waste_management_settings',
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

  const [
    provisioningRuns,
    auditEvents,
    moduleActivations,
    keycloakStatus,
    keycloakPreflight,
    keycloakPlan,
    keycloakProvisioningRuns,
    accessEvidence,
    reconcileEvidence,
    wasteManagementSettings,
  ] = await Promise.all([
    deps.repository.listProvisioningRuns(instance.instanceId),
    deps.repository.listAuditEvents(instance.instanceId),
    deps.repository.listModuleActivations(instance.instanceId),
    loadOptionalArtifact(instance.instanceId, 'keycloak_status', () =>
      getKeycloakStatus(instance.instanceId)
    ),
    loadOptionalArtifact(instance.instanceId, 'keycloak_preflight', () =>
      getKeycloakPreflight(instance.instanceId)
    ),
    loadOptionalArtifact(instance.instanceId, 'keycloak_plan', () =>
      planKeycloakProvisioning(instance.instanceId)
    ),
    deps.repository.listKeycloakProvisioningRuns(instance.instanceId),
    deps.repository.getLatestTenantIamAccessProbe(instance.instanceId),
    deps.repository.getRoleReconcileSummary(instance.instanceId),
    loadOptionalArtifact(
      instance.instanceId,
      'waste_management_settings',
      () => deps.loadWasteDataSourceRecord?.(instance.instanceId) ?? Promise.resolve(null)
    ),
  ]);

  const tenantIamStatus = buildTenantIamStatus({
    keycloakStatus,
    requireTenantAdmin: isInstanceTenantAdminRequired(instance),
    accessEvidence: accessEvidence
      ? {
          status: accessEvidence.status,
          summary: accessEvidence.summary,
          source: 'access_probe',
          checkedAt: accessEvidence.checkedAt,
          errorCode: accessEvidence.errorCode,
          requestId: accessEvidence.requestId,
        }
      : undefined,
    reconcileEvidence: reconcileEvidence
      ? {
          status: reconcileEvidence.status,
          summary: reconcileEvidence.summary,
          source: 'role_reconcile',
          checkedAt: reconcileEvidence.checkedAt,
          errorCode: reconcileEvidence.errorCode,
          requestId: reconcileEvidence.requestId,
        }
      : undefined,
  });
  const moduleIamStatus = buildModuleIamStatus(
    instance.assignedModules,
    deps.moduleIamRegistry ?? new Map()
  );
  const backgroundCapabilities = buildBackgroundProvisioningCapabilities(
    deps,
    instance,
    'instance_detail'
  );
  const createRun = provisioningRuns.find((run) => run.operation === 'create');
  const latestKeycloakRun = keycloakProvisioningRuns[0];
  const keycloakPlanHasMutations =
    keycloakPlan?.steps.some((step) => step.action === 'create' || step.action === 'update') ??
    false;
  const hostReadinessSatisfied =
    !shouldExposeAutomatedProvisioning(deps, instance) ||
    Boolean(
      createRun?.status === 'validated' &&
      createRun.stepKey === 'completed' &&
      createRun.completedAt
    );
  const activationReady =
    instance.status !== 'active' &&
    latestKeycloakRun?.overallStatus === 'succeeded' &&
    keycloakPlan?.overallStatus === 'ready' &&
    !keycloakPlanHasMutations &&
    tenantIamStatus.overall.status === 'ready' &&
    moduleIamStatus?.overall.status === 'ready' &&
    hostReadinessSatisfied;
  const retryableCreateRun =
    createRun?.snapshotVersion === '2.0' &&
    createRun.desiredSnapshot.automationMode === 'kassel-traefik-file' &&
    isTenantProvisioningFailureRetryable(createRun)
      ? createRun
      : undefined;
  const provisioningReadiness = {
    state:
      instance.status === 'active'
        ? ('ready' as const)
        : createRun?.status === 'failed'
          ? ('provisioning_blocked' as const)
          : instance.status === 'validated' && createRun?.completedAt
            ? ('awaiting_activation' as const)
            : createRun && !createRun.completedAt
              ? ('provisioning_waiting' as const)
              : ('unknown' as const),
    capabilities: backgroundCapabilities,
    nextAction:
      instance.status === 'active'
        ? null
        : activationReady
          ? ({ action: 'instance.status.activate', retryClass: 'never' } as const)
          : retryableCreateRun
            ? ({
                action: 'instance.provisioning.retry',
                retryClass: 'safe',
                runId: retryableCreateRun.id,
              } as const)
            : keycloakPlan?.overallStatus === 'ready' && keycloakPlanHasMutations
              ? ({ action: 'instance.keycloak.execute', retryClass: 'conditional' } as const)
              : tenantIamStatus.access.status !== 'ready'
                ? ({ action: 'instance.tenant-iam.probe', retryClass: 'safe' } as const)
                : tenantIamStatus.reconcile.status !== 'ready'
                  ? ({ action: 'instance.tenant-iam.reconcile', retryClass: 'safe' } as const)
                  : ({ action: 'instance.readiness.refresh', retryClass: 'safe' } as const),
  };

  return buildInstanceDetail(
    instance,
    provisioningRuns,
    auditEvents,
    moduleActivations,
    keycloakStatus,
    keycloakPreflight,
    keycloakPlan,
    keycloakProvisioningRuns,
    tenantIamStatus,
    moduleIamStatus,
    wasteManagementSettings ?? undefined,
    provisioningReadiness
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
