import {
  isInstanceTenantAdminRequired,
  resolveEffectiveAccountInvitationTemplate,
} from '@sva/core';
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
import {
  buildBackgroundProvisioningCapabilities,
  isAssignedPluginLifecycleReady,
} from './service-draft-readiness.js';
import {
  isTenantProvisioningFailureRetryable,
  requiresAutomatedProvisioningEvidence,
  shouldExposeAutomatedProvisioning,
} from './service-active-provisioning.js';
import { isSupportedTenantProvisioningSnapshotVersion } from './tenant-provisioning-snapshot.js';
import { isLiveKeycloakStatusReadyForActivation } from './service-keycloak-snapshot-reader.js';
import { readLatestQueuedPluginOidcClientRequirements } from './service-keycloak-execution-payload.js';

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
    serverAccountInvitationTemplate,
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
    deps.repository.getServerAccountInvitationTemplate(),
  ]);

  const effectiveAccountInvitationTemplate = resolveEffectiveAccountInvitationTemplate({
    instanceTemplate: instance.accountInvitationTemplate,
    serverTemplate: serverAccountInvitationTemplate.template,
  });

  const latestKeycloakRun = keycloakProvisioningRuns[0];
  const latestSuccessfulKeycloakRun = keycloakProvisioningRuns.find(
    (run) => run.overallStatus === 'succeeded'
  );
  const evidenceIsCurrent = (checkedAt: string | undefined) => {
    if (!latestSuccessfulKeycloakRun) return true;
    if (!checkedAt) return false;
    return Date.parse(checkedAt) >= Date.parse(latestSuccessfulKeycloakRun.updatedAt);
  };
  const currentAccessEvidence = evidenceIsCurrent(accessEvidence?.checkedAt)
    ? accessEvidence
    : undefined;
  const currentReconcileEvidence = evidenceIsCurrent(reconcileEvidence?.checkedAt)
    ? reconcileEvidence
    : undefined;

  const tenantIamStatus = buildTenantIamStatus({
    keycloakStatus,
    requireTenantAdmin: isInstanceTenantAdminRequired(instance),
    accessEvidence: currentAccessEvidence
      ? {
          status: currentAccessEvidence.status,
          summary: currentAccessEvidence.summary,
          source: 'access_probe',
          checkedAt: currentAccessEvidence.checkedAt,
          errorCode: currentAccessEvidence.errorCode,
          requestId: currentAccessEvidence.requestId,
        }
      : undefined,
    reconcileEvidence: currentReconcileEvidence
      ? {
          status: currentReconcileEvidence.status,
          summary: currentReconcileEvidence.summary,
          source: 'role_reconcile',
          checkedAt: currentReconcileEvidence.checkedAt,
          errorCode: currentReconcileEvidence.errorCode,
          requestId: currentReconcileEvidence.requestId,
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
  const pluginLifecycleReady = await isAssignedPluginLifecycleReady(deps, instance);
  const keycloakRunInProgress =
    latestKeycloakRun?.overallStatus === 'planned' ||
    latestKeycloakRun?.overallStatus === 'running';
  const keycloakRunFailed = latestKeycloakRun?.overallStatus === 'failed';
  const keycloakPlanHasMutations =
    keycloakPlan?.steps.some((step) => step.action === 'create' || step.action === 'update') ??
    false;
  const blockedPreflightChecks =
    keycloakPreflight?.checks.filter((check) => check.status === 'blocked') ?? [];
  const missingTenantSecretIsOnlyBlocker =
    instance.realmMode === 'existing' &&
    !instance.authClientSecretConfigured &&
    blockedPreflightChecks.length > 0 &&
    blockedPreflightChecks.every((check) => check.checkKey === 'tenant_secret');
  const hostReadinessSatisfied =
    !createRun ||
    !requiresAutomatedProvisioningEvidence(createRun) ||
    Boolean(
      createRun?.status === 'validated' &&
      createRun.stepKey === 'completed' &&
      createRun.completedAt
    );
  const persistedActivationCandidate =
    instance.status !== 'active' &&
    latestKeycloakRun?.overallStatus === 'succeeded' &&
    keycloakPlan?.overallStatus === 'ready' &&
    !keycloakPlanHasMutations &&
    tenantIamStatus.overall.status === 'ready' &&
    (instance.assignedModules.length === 0 || moduleIamStatus?.overall.status === 'ready') &&
    pluginLifecycleReady &&
    hostReadinessSatisfied;
  const pluginOidcClients = readLatestQueuedPluginOidcClientRequirements(
    keycloakProvisioningRuns,
    instance,
    deps.readPluginOidcClientRequirements?.()
  );
  const [liveKeycloakReady, liveKeycloakPlan] = persistedActivationCandidate
    ? await Promise.all([
        isLiveKeycloakStatusReadyForActivation(deps, instance.instanceId, pluginOidcClients),
        loadOptionalArtifact(instance.instanceId, 'keycloak_plan', () =>
          planKeycloakProvisioning(instance.instanceId, { forceLive: true })
        ),
      ])
    : [false, undefined];
  const effectiveKeycloakPlan = liveKeycloakPlan ?? keycloakPlan;
  const effectiveKeycloakPlanHasMutations =
    effectiveKeycloakPlan?.steps.some(
      (step) => step.action === 'create' || step.action === 'update'
    ) ?? false;
  const activationReady =
    persistedActivationCandidate &&
    liveKeycloakReady &&
    effectiveKeycloakPlan?.overallStatus === 'ready' &&
    !effectiveKeycloakPlanHasMutations;
  const hasTerminalProvisioningBlocker =
    createRun?.status === 'failed' ||
    latestKeycloakRun?.overallStatus === 'failed' ||
    effectiveKeycloakPlan?.overallStatus === 'blocked' ||
    blockedPreflightChecks.length > 0 ||
    tenantIamStatus.overall.status === 'blocked' ||
    (instance.assignedModules.length > 0 && moduleIamStatus?.overall.status === 'blocked');
  const retryableCreateRun =
    createRun &&
    isSupportedTenantProvisioningSnapshotVersion(createRun.snapshotVersion) &&
    createRun.desiredSnapshot.automationMode === 'kassel-traefik-file' &&
    shouldExposeAutomatedProvisioning(deps, instance) &&
    isTenantProvisioningFailureRetryable(createRun)
      ? createRun
      : undefined;
  const provisioningReadiness = {
    state:
      instance.status === 'active'
        ? ('ready' as const)
        : hasTerminalProvisioningBlocker
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
        : retryableCreateRun
          ? ({
              action: 'instance.provisioning.retry',
              retryClass: 'safe',
              runId: retryableCreateRun.id,
            } as const)
          : createRun?.status === 'failed'
            ? ({ action: 'instance.diagnose', retryClass: 'never' } as const)
            : activationReady
              ? ({ action: 'instance.status.activate', retryClass: 'never' } as const)
              : missingTenantSecretIsOnlyBlocker
                ? ({ action: 'instance.secret.rotate', retryClass: 'conditional' } as const)
                : keycloakRunInProgress
                  ? ({ action: 'instance.readiness.refresh', retryClass: 'safe' } as const)
                  : keycloakRunFailed ||
                      (effectiveKeycloakPlan?.overallStatus === 'ready' &&
                        effectiveKeycloakPlanHasMutations)
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
    effectiveKeycloakPlan,
    keycloakProvisioningRuns,
    tenantIamStatus,
    moduleIamStatus,
    wasteManagementSettings ?? undefined,
    provisioningReadiness,
    effectiveAccountInvitationTemplate,
    serverAccountInvitationTemplate.revision
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
