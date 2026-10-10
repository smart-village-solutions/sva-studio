import { createSdkLogger } from '@sva/server-runtime';
import type { InstanceProvisioningRun } from '@sva/core';
import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { assertNoActiveTenantProvisioning } from './service-active-provisioning.js';
import { syncProtectedSystemAdminPermissions } from './service-module-mutations.js';
import { isSupportedTenantProvisioningSnapshotVersion } from './tenant-provisioning-snapshot.js';
import { readParentKeycloakPlanGate } from './tenant-provisioning-state.js';
import {
  createGetKeycloakStatusHandler,
  createPlanKeycloakProvisioningHandler,
} from './service-keycloak-readers.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { buildProvisioningInput, createQueuedRun } from './service-keycloak-execution-shared.js';
import {
  ensureReconcilePreconditions,
  resolveReconcileIntent,
} from './service-keycloak-reconcile-helpers.js';
import { processNextProvisioningClaim } from './service-keycloak-worker-claim.js';
import {
  assertProvisioningIntentAllowed,
  createPlanStaleError,
} from './service-keycloak-execution-plan.js';
import { processClaimedKeycloakProvisioningRun } from './service-keycloak-execution-worker.js';

export { processClaimedKeycloakProvisioningRun } from './service-keycloak-execution-worker.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

const canRecoverMissingTenantSecret = async (
  deps: InstanceRegistryServiceDeps,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>,
  intent: ExecuteInstanceKeycloakProvisioningInput['intent']
): Promise<boolean> => {
  if (
    intent !== 'rotate_client_secret' ||
    loaded.instance.realmMode !== 'existing' ||
    loaded.authClientSecret
  ) {
    return false;
  }
  // Recovery authorization requires current evidence, never a historical bootstrap snapshot.
  const preflight = await deps.getKeycloakPreflight?.(buildProvisioningInput(loaded));
  const blockers = preflight?.checks.filter((check) => check.status === 'blocked') ?? [];
  return blockers.length > 0 && blockers.every((check) => check.checkKey === 'tenant_secret');
};

const findAutomatedParentRun = async (
  deps: InstanceRegistryServiceDeps,
  instanceId: string
): Promise<InstanceProvisioningRun | undefined> =>
  (await deps.repository.listProvisioningRuns(instanceId)).find(
    (run) =>
      run.operation === 'create' &&
      isSupportedTenantProvisioningSnapshotVersion(run.snapshotVersion) &&
      run.desiredSnapshot.automationMode === 'kassel-traefik-file' &&
      !run.completedAt &&
      ['requested', 'validated', 'provisioning'].includes(run.status)
  );
export const processNextQueuedKeycloakProvisioningRun = async (
  deps: InstanceRegistryServiceDeps,
  claimFilter?: { createdAtOrAfter?: string }
) => processNextProvisioningClaim(deps, processClaimedKeycloakProvisioningRun, claimFilter);

export const createExecuteKeycloakProvisioningHandler =
  (
    deps: InstanceRegistryServiceDeps,
    options: { readonly allowActiveTenantProvisioning?: boolean } = {}
  ) =>
  async (input: ExecuteInstanceKeycloakProvisioningInput) => {
    logger.info('keycloak_provisioning_enqueued', {
      operation: 'execute_keycloak_provisioning',
      result: 'enqueued',
      step_key: 'queue_enqueue',
      instance_id: input.instanceId,
      request_id: input.requestId,
      actor_id: input.actorId,
      intent: input.intent,
    });

    const loaded = await loadInstanceWithSecret(deps, input.instanceId);
    if (!loaded) {
      logger.debug('keycloak_provisioning_skipped', {
        operation: 'execute_keycloak_provisioning',
        instance_id: input.instanceId,
        reason: 'instance_not_found',
      });
      return null;
    }
    assertProvisioningIntentAllowed(loaded.instance.realmMode, input.intent);
    const parentRun = options.allowActiveTenantProvisioning
      ? undefined
      : await findAutomatedParentRun(deps, input.instanceId);
    const parentGate = parentRun ? readParentKeycloakPlanGate(parentRun) : undefined;
    const confirmsWaitingParent =
      input.intent === 'provision' && parentGate?.status === 'awaiting_plan_confirmation';
    const retriesConfirmedParent =
      input.intent === 'provision' &&
      parentGate?.status === 'confirmed' &&
      parentGate.planFingerprint === input.planFingerprint;
    const remediatesWaitingParent =
      input.intent === 'rotate_client_secret' && parentGate?.status === 'awaiting_tenant_secret';
    if (
      !options.allowActiveTenantProvisioning &&
      !confirmsWaitingParent &&
      !retriesConfirmedParent &&
      !remediatesWaitingParent
    ) {
      await assertNoActiveTenantProvisioning(deps.repository, input.instanceId);
    }

    const currentPlan = await createPlanKeycloakProvisioningHandler(deps)(input.instanceId);
    const missingSecretRecovery = await canRecoverMissingTenantSecret(deps, loaded, input.intent);
    if (!currentPlan || (currentPlan.overallStatus === 'blocked' && !missingSecretRecovery)) {
      throw new Error('keycloak_plan_blocked');
    }
    if (currentPlan.fingerprint !== input.planFingerprint) {
      throw createPlanStaleError({
        comparisonStage: 'enqueue',
        stepKey: 'queue_enqueue',
        expectedFingerprint: input.planFingerprint,
        actualPlan: currentPlan,
      });
    }

    await syncProtectedSystemAdminPermissions(deps, input.instanceId);
    const { run } = await createQueuedRun(deps, loaded, {
      ...input,
      confirmedPlan: currentPlan,
      mutation: 'executeKeycloakProvisioning',
    });
    if (parentRun && confirmsWaitingParent) {
      if (!parentGate?.planFingerprint) {
        throw createPlanStaleError({
          comparisonStage: 'parent_confirmation',
          stepKey: 'queue_enqueue',
          actualPlan: currentPlan,
        });
      }
      const confirmed = await deps.repository.confirmProvisioningPlan({
        runId: parentRun.id,
        instanceId: input.instanceId,
        expectedPlanFingerprint: parentGate.planFingerprint,
        planFingerprint: input.planFingerprint,
        childKeycloakRunId: run.id,
        actorId: input.actorId,
        requestId: input.requestId,
      });
      if (!confirmed) {
        throw createPlanStaleError({
          comparisonStage: 'parent_confirmation',
          stepKey: 'queue_enqueue',
          expectedFingerprint: parentGate.planFingerprint,
          actualPlan: currentPlan,
        });
      }
    } else if (parentRun && remediatesWaitingParent) {
      if (!parentGate?.planFingerprint) {
        throw createPlanStaleError({
          comparisonStage: 'parent_confirmation',
          stepKey: 'queue_enqueue',
          actualPlan: currentPlan,
        });
      }
      const bound = await deps.repository.bindProvisioningRemediation({
        runId: parentRun.id,
        instanceId: input.instanceId,
        expectedPlanFingerprint: parentGate.planFingerprint,
        planFingerprint: input.planFingerprint,
        childKeycloakRunId: run.id,
        actorId: input.actorId,
        requestId: input.requestId,
      });
      if (!bound) {
        throw createPlanStaleError({
          comparisonStage: 'parent_confirmation',
          stepKey: 'queue_enqueue',
          expectedFingerprint: parentGate.planFingerprint,
          actualPlan: currentPlan,
        });
      }
    } else if (parentRun && retriesConfirmedParent && parentGate?.childKeycloakRunId !== run.id) {
      throw createPlanStaleError({
        comparisonStage: 'parent_confirmation',
        stepKey: 'queue_enqueue',
        expectedFingerprint: input.planFingerprint,
        actualPlan: currentPlan,
      });
    }
    return deps.repository.getKeycloakProvisioningRun(loaded.instance.instanceId, run.id);
  };

export const createReconcileKeycloakHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (input: {
    instanceId: string;
    idempotencyKey: string;
    actorId: string;
    requestId: string;
    planFingerprint: string;
    tenantAdminTemporaryPassword?: string;
    rotateClientSecret?: boolean;
  }) => {
    const loaded = await loadInstanceWithSecret(deps, input.instanceId);
    if (!loaded) {
      return null;
    }
    await assertNoActiveTenantProvisioning(deps.repository, input.instanceId);

    const intent = resolveReconcileIntent(loaded, input.rotateClientSecret);
    const missingSecretRecovery =
      intent === 'rotate_client_secret' &&
      loaded.instance.realmMode === 'existing' &&
      !loaded.authClientSecret;
    await ensureReconcilePreconditions(deps, loaded, {
      allowMissingTenantSecret: missingSecretRecovery,
    });
    const currentPlan = await createPlanKeycloakProvisioningHandler(deps)(input.instanceId);
    if (!currentPlan || (currentPlan.overallStatus === 'blocked' && !missingSecretRecovery)) {
      throw new Error('keycloak_plan_blocked');
    }
    if (currentPlan.fingerprint !== input.planFingerprint) {
      throw createPlanStaleError({
        comparisonStage: 'reconcile',
        stepKey: 'queue_enqueue',
        expectedFingerprint: input.planFingerprint,
        actualPlan: currentPlan,
      });
    }

    if (
      loaded.instance.realmMode === 'existing' &&
      intent !== 'provision_admin_client' &&
      intent !== 'rotate_client_secret' &&
      !loaded.authClientSecret
    ) {
      throw new Error('tenant_auth_client_secret_missing');
    }

    await createQueuedRun(deps, loaded, {
      instanceId: input.instanceId,
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      requestId: input.requestId,
      tenantAdminTemporaryPassword: input.tenantAdminTemporaryPassword,
      rotateClientSecret: input.rotateClientSecret,
      intent,
      planFingerprint: input.planFingerprint,
      confirmedPlan: currentPlan,
      mutation: 'reconcileKeycloak',
    });

    return createGetKeycloakStatusHandler(deps)(input.instanceId);
  };
