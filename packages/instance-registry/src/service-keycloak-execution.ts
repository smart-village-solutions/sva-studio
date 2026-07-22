import { createSdkLogger } from '@sva/server-runtime';
import type { InstanceKeycloakProvisioningRun } from '@sva/core';
import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { createGetKeycloakStatusHandler } from './service-keycloak-readers.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { appendRunStep } from './service-keycloak-run-steps.js';
import { buildProvisioningInput, completeRun, createQueuedRun, readQueuedTemporaryPassword, syncProvisionedClientSecretToRegistry, syncRotatedClientSecretToRegistry } from './service-keycloak-execution-shared.js';
import { failClaimedRun, failRun } from './service-keycloak-execution-failures.js';
import { buildProvisioningExecutionOptions, ensureReconcilePreconditions, resolveReconcileIntent } from './service-keycloak-reconcile-helpers.js';
import { runInstanceRegistryStep } from './observability.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

const hasWorkerDependencies = (deps: InstanceRegistryServiceDeps): boolean =>
  Boolean(deps.provisionInstanceAuth && deps.getKeycloakStatus && deps.getKeycloakPreflight && deps.planKeycloakProvisioning);

const loadClaimedRunInstance = async (deps: InstanceRegistryServiceDeps, run: InstanceKeycloakProvisioningRun): Promise<NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>> | null> => {
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

const appendWorkerRunningStep = async (deps: InstanceRegistryServiceDeps, run: InstanceKeycloakProvisioningRun) =>
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

const appendPreflightSnapshot = async (deps: InstanceRegistryServiceDeps, run: InstanceKeycloakProvisioningRun, provisioningInput: ReturnType<typeof buildProvisioningInput>) => {
  const getKeycloakPreflight = deps.getKeycloakPreflight;
  if (!getKeycloakPreflight) {
    throw new Error('dependency_missing_getKeycloakPreflight');
  }
  const preflight = await getKeycloakPreflight(provisioningInput);
  await appendRunStep(deps, {
    runId: run.id,
    stepKey: 'worker_preflight_snapshot',
    title: 'Vorbedingungen prüfen',
    status: preflight.overallStatus === 'blocked' ? 'failed' : 'done',
    summary:
      preflight.overallStatus === 'blocked'
        ? 'Die Vorbedingungen blockieren die Ausführung.'
        : 'Die Vorbedingungen erlauben die Ausführung.',
    details: { preflight },
    requestId: run.requestId,
  });
  return preflight;
};

const appendPlanSnapshot = async (deps: InstanceRegistryServiceDeps, run: InstanceKeycloakProvisioningRun, provisioningInput: ReturnType<typeof buildProvisioningInput>) => {
  const planKeycloakProvisioning = deps.planKeycloakProvisioning;
  if (!planKeycloakProvisioning) {
    throw new Error('dependency_missing_planKeycloakProvisioning');
  }
  const plan = await planKeycloakProvisioning(provisioningInput);
  await appendRunStep(deps, {
    runId: run.id,
    stepKey: 'worker_plan_snapshot',
    title: 'Soll-Ist-Abgleich planen',
    status: plan.overallStatus === 'blocked' ? 'failed' : 'done',
    summary: plan.driftSummary,
    details: { plan },
    requestId: run.requestId,
  });
  return plan;
};

const syncClientSecretAfterProvisioning = async (deps: InstanceRegistryServiceDeps, run: InstanceKeycloakProvisioningRun, loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>) => {
  if (run.intent === 'rotate_client_secret') {
    await syncRotatedClientSecretToRegistry(deps, {
      loaded,
      requestId: run.requestId,
      actorId: run.actorId,
    });
    return;
  }
  if (run.intent === 'reset_tenant_admin') {
    return;
  }
  await syncProvisionedClientSecretToRegistry(deps, {
    loaded,
    requestId: run.requestId,
    actorId: run.actorId,
  });
};

const syncTenantAdminBootstrapAccountAfterProvisioning = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>
) => {
  if (!deps.syncTenantAdminBootstrapAccount) {
    return;
  }

  await deps.syncTenantAdminBootstrapAccount({
    instanceId: loaded.instance.instanceId,
    tenantAdminBootstrap: loaded.instance.tenantAdminBootstrap,
    requestId: run.requestId,
    actorId: run.actorId,
  });
};

const executeClaimedRun = async (deps: InstanceRegistryServiceDeps, run: InstanceKeycloakProvisioningRun, loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>, tenantAdminTemporaryPassword: string | undefined, provisioningInput: ReturnType<typeof buildProvisioningInput>) => {
  const preflight = await runInstanceRegistryStep('worker_preflight', () =>
    appendPreflightSnapshot(deps, run, provisioningInput)
  );
  const plan = await runInstanceRegistryStep('worker_plan', () =>
    appendPlanSnapshot(deps, run, provisioningInput)
  );

  const rotatingMissingTenantSecret = run.intent === 'rotate_client_secret' && !loaded.authClientSecret;
  if (run.mode === 'existing' && run.intent !== 'provision_admin_client' && !rotatingMissingTenantSecret && !loaded.authClientSecret) {
    throw new Error('tenant_auth_client_secret_missing');
  }
  const secretRotationRecovery = rotatingMissingTenantSecret &&
    preflight.checks.every((check) => check.checkKey === 'tenant_secret' || check.status !== 'blocked');
  if (!secretRotationRecovery && (preflight.overallStatus === 'blocked' || plan.overallStatus === 'blocked')) {
    await deps.repository.updateKeycloakProvisioningRun({
      runId: run.id,
      overallStatus: 'failed',
      driftSummary: 'Provisioning blockiert: Worker-Preflight oder Plan melden Blocker.',
    });
    return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
  }

  const provisionInstanceAuth = deps.provisionInstanceAuth;
  if (!provisionInstanceAuth) {
    throw new Error('dependency_missing_provisionInstanceAuth');
  }

  await runInstanceRegistryStep('keycloak_execution', () => provisionInstanceAuth({
    ...provisioningInput,
    tenantAdminTemporaryPassword,
    rotateClientSecret: run.intent === 'rotate_client_secret',
    ...buildProvisioningExecutionOptions(run.intent),
  }));

  await runInstanceRegistryStep('secret_sync', () => syncClientSecretAfterProvisioning(deps, run, loaded));
  await runInstanceRegistryStep('admin_bootstrap', () =>
    syncTenantAdminBootstrapAccountAfterProvisioning(deps, run, loaded)
  );

  const finalRunStatus = await runInstanceRegistryStep('worker_complete', () => completeRun(deps, {
    loaded,
    runId: run.id,
    requestId: run.requestId,
    actorId: run.actorId,
    intent: run.intent,
    tenantAdminTemporaryPassword,
  }));

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

  if (!hasWorkerDependencies(deps)) {
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

  const queueStep = run.steps.find((step: InstanceKeycloakProvisioningRun['steps'][number]) => step.stepKey === 'queued');
  const tenantAdminTemporaryPassword = readQueuedTemporaryPassword(deps, run.id, queueStep?.details);
  const provisioningInput = buildProvisioningInput(loaded);

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
    return await executeClaimedRun(deps, run, loaded, tenantAdminTemporaryPassword, provisioningInput);
  } catch (error) {
    await failRun(deps, {
      runId: run.id,
      requestId: run.requestId,
      instanceId: run.instanceId,
      intent: run.intent,
      error,
    });
    return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
  }
};

export const processNextQueuedKeycloakProvisioningRun = async (deps: InstanceRegistryServiceDeps, claimFilter?: { createdAtOrAfter?: string }) =>
  processClaimedKeycloakProvisioningRun(
    deps,
    await (
      deps.repository as InstanceRegistryServiceDeps['repository'] & {
        claimNextKeycloakProvisioningRun: (input?: { createdAtOrAfter?: string }) => Promise<InstanceKeycloakProvisioningRun | null>;
      }
    ).claimNextKeycloakProvisioningRun(claimFilter)
  );

export const createExecuteKeycloakProvisioningHandler =
  (deps: InstanceRegistryServiceDeps) =>
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

    const { run } = await createQueuedRun(deps, loaded, {
      ...input,
      mutation: 'executeKeycloakProvisioning',
    });
    return deps.repository.getKeycloakProvisioningRun(loaded.instance.instanceId, run.id);
  };

export const createReconcileKeycloakHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (input: {
    instanceId: string;
    idempotencyKey: string;
    actorId: string;
    requestId: string;
    tenantAdminTemporaryPassword?: string;
    rotateClientSecret?: boolean;
  }) => {
    const loaded = await loadInstanceWithSecret(deps, input.instanceId);
    if (!loaded) {
      return null;
    }

    await ensureReconcilePreconditions(deps, loaded);

    const intent = resolveReconcileIntent(loaded, input.rotateClientSecret);

    if (loaded.instance.realmMode === 'existing' && intent !== 'provision_admin_client' && !loaded.authClientSecret) {
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
      mutation: 'reconcileKeycloak',
    });

    return createGetKeycloakStatusHandler(deps)(input.instanceId);
  };
