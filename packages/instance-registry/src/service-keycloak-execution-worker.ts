import { createSdkLogger } from '@sva/server-runtime';
import type { InstanceKeycloakProvisioningRun } from '@sva/core';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { appendRunStep } from './service-keycloak-run-steps.js';
import {
  assertQueuedRealmBaselineCurrent,
  buildProvisioningInput,
  readQueuedPluginOidcClientRequirements,
  readQueuedTemporaryPassword,
} from './service-keycloak-execution-shared.js';
import { failClaimedRun, failRun } from './service-keycloak-execution-failures.js';
import { buildProvisioningExecutionOptions } from './service-keycloak-reconcile-helpers.js';
import { loadRealmBaselineApplicability } from './service-keycloak-snapshot-reader.js';
import { runInstanceRegistryStep } from './observability.js';
import { resolveLegacyRealmRoleMigrationAllowed } from './provisioning-auth-policy.js';
import { hasProvisioningWorkerDependencies } from './service-keycloak-worker-claim.js';
import {
  validateWorkerSnapshot,
  type QueuedProvisioningInput,
} from './service-keycloak-execution-plan.js';
import {
  cleanupNewRealmAfterPostProvisioningFailure,
  finalizeProvisionedRun,
} from './service-keycloak-execution-post-provisioning.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

const loadClaimedRunInstance = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun
): Promise<NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>> | null> => {
  const loaded = await loadInstanceWithSecret(deps, run.instanceId);
  if (!loaded) {
    await failClaimedRun(deps, {
      runId: run.id,
      requestId: run.requestId,
      instanceId: run.instanceId,
      intent: run.intent,
      summary: 'Die Instanz konnte für den Provisioning-Lauf nicht mehr geladen werden.',
      details: { reason: 'instance_not_found' },
    });
    return null;
  }
  return loaded;
};
const appendWorkerRunningStep = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun
) =>
  appendRunStep(deps, {
    runId: run.id,
    stepKey: 'worker',
    title: 'Provisioning-Worker',
    status: 'running',
    summary: 'Der Worker hat den Auftrag übernommen und führt die technischen Prüfungen aus.',
    details: {
      intent: run.intent,
      mode: run.mode,
    },
    requestId: run.requestId,
  });
const executeClaimedRun = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>,
  tenantAdminTemporaryPassword: string | undefined,
  provisioningInput: QueuedProvisioningInput,
  confirmedPlanFingerprint: string,
  realmBaselineApplicable: boolean
) => {
  if (
    !(await validateWorkerSnapshot(
      deps,
      run,
      loaded,
      provisioningInput,
      confirmedPlanFingerprint,
      realmBaselineApplicable
    ))
  ) {
    return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
  }

  const provisionInstanceAuth = deps.provisionInstanceAuth;
  if (!provisionInstanceAuth) {
    throw new Error('dependency_missing_provisionInstanceAuth');
  }

  await runInstanceRegistryStep('keycloak_execution', () =>
    provisionInstanceAuth({
      ...provisioningInput,
      tenantAdminTemporaryPassword,
      rotateClientSecret: run.intent === 'rotate_client_secret',
      ...buildProvisioningExecutionOptions(run.intent),
    })
  );

  const finalRunStatus = await finalizeProvisionedRun(
    deps,
    run,
    loaded,
    tenantAdminTemporaryPassword,
    provisioningInput
  );

  if (finalRunStatus === 'failed') {
    await cleanupNewRealmAfterPostProvisioningFailure(
      deps,
      provisioningInput,
      new Error('new_realm_completion_failed')
    );
  }

  logger.info('keycloak_provisioning_completed', {
    operation: 'process_keycloak_provisioning_run',
    result: 'completed',
    step_key: 'worker_complete',
    instance_id: loaded.instance.instanceId,
    request_id: run.requestId,
    run_id: run.id,
    overall_status: finalRunStatus,
  });

  return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
};

export const processClaimedKeycloakProvisioningRun = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun | null
) => {
  if (!run) {
    return null;
  }

  if (!hasProvisioningWorkerDependencies(deps)) {
    await failClaimedRun(deps, {
      runId: run.id,
      requestId: run.requestId,
      instanceId: run.instanceId,
      intent: run.intent,
      summary: 'Provisioning-Worker ist unvollständig konfiguriert.',
      details: { reason: 'dependency_missing' },
    });
    return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
  }

  const loaded = await loadClaimedRunInstance(deps, run);
  if (!loaded) {
    return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
  }

  await appendWorkerRunningStep(deps, run);
  logger.info('keycloak_provisioning_claimed', {
    operation: 'process_keycloak_provisioning_run',
    result: 'claimed',
    request_id: run.requestId,
    instance_id: run.instanceId,
    run_id: run.id,
    intent: run.intent,
    step_key: 'worker_claim',
  });

  try {
    const queueStep = run.steps.find(
      (step: InstanceKeycloakProvisioningRun['steps'][number]) => step.stepKey === 'queued'
    );
    const confirmedPlanFingerprint = queueStep?.details.confirmedPlanFingerprint;
    if (
      typeof confirmedPlanFingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(confirmedPlanFingerprint)
    ) {
      throw new Error('keycloak_plan_confirmation_missing');
    }
    const tenantAdminTemporaryPassword = readQueuedTemporaryPassword(
      deps,
      run.id,
      queueStep?.details
    );
    assertQueuedRealmBaselineCurrent(queueStep?.details, run.mode);
    const baseProvisioningInput = buildProvisioningInput(loaded);
    const pluginOidcClients = readQueuedPluginOidcClientRequirements(
      queueStep?.details,
      baseProvisioningInput
    );
    const allowLegacyRealmRoleMigration = await resolveLegacyRealmRoleMigrationAllowed(
      { listInstances: deps.listProvisioningRealmAssignments },
      loaded.instance
    );
    const provisioningInput = {
      ...baseProvisioningInput,
      allowLegacyRealmRoleMigration,
      pluginOidcClients,
    };
    const realmBaselineApplicable = await loadRealmBaselineApplicability(deps, loaded.instance);
    return await executeClaimedRun(
      deps,
      run,
      loaded,
      tenantAdminTemporaryPassword,
      provisioningInput,
      confirmedPlanFingerprint,
      realmBaselineApplicable
    );
  } catch (error) {
    await failRun(deps, {
      runId: run.id,
      requestId: run.requestId,
      instanceId: run.instanceId,
      intent: run.intent,
      error,
    });
    if (run.intent === 'rotate_client_secret') {
      await deps.repository.completeProvisioningRemediation({
        instanceId: run.instanceId,
        childKeycloakRunId: run.id,
        succeeded: false,
      });
    }
    return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
  }
};
