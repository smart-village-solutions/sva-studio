import { createSdkLogger } from '@sva/server-runtime';
import type { InstanceKeycloakProvisioningRun, InstanceProvisioningRun } from '@sva/core';
import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import type { KeycloakProvisioningInput } from './provisioning-auth-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { assertNoActiveTenantProvisioning } from './service-active-provisioning.js';
import { isSupportedTenantProvisioningSnapshotVersion } from './tenant-provisioning-snapshot.js';
import { readParentKeycloakPlanGate } from './tenant-provisioning-state.js';
import {
  createGetKeycloakPreflightHandler,
  createGetKeycloakStatusHandler,
  createPlanKeycloakProvisioningHandler,
} from './service-keycloak-readers.js';
import {
  loadInstanceWithSecret,
  loadKeycloakSnapshotSecretVersions,
} from './service-keycloak-secrets.js';
import { appendRunStep } from './service-keycloak-run-steps.js';
import {
  assertQueuedRealmBaselineCurrent,
  buildProvisioningInput,
  completeRun,
  createQueuedRun,
  readQueuedPluginOidcClientRequirements,
  readQueuedTemporaryPassword,
  syncProvisionedClientSecretToRegistry,
  syncRotatedClientSecretToRegistry,
} from './service-keycloak-execution-shared.js';
import { failClaimedRun, failRun } from './service-keycloak-execution-failures.js';
import {
  buildProvisioningExecutionOptions,
  ensureReconcilePreconditions,
  resolveReconcileIntent,
} from './service-keycloak-reconcile-helpers.js';
import { loadRealmBaselineApplicability } from './service-keycloak-snapshot-reader.js';
import {
  annotateInstanceRegistryError,
  buildKeycloakPlanComparisonDiagnostics,
  readInstanceRegistryStepKey,
  runInstanceRegistryStep,
} from './observability.js';
import type { KeycloakTenantPlan } from './keycloak-types.js';
import {
  buildKeycloakSnapshotInputFingerprint,
  KEYCLOAK_SNAPSHOT_POLICY_VERSION,
  resolveLegacyRealmRoleMigrationAllowed,
} from './provisioning-auth-policy.js';
import {
  hasProvisioningWorkerDependencies,
  processNextProvisioningClaim,
} from './service-keycloak-worker-claim.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });
type QueuedProvisioningInput = ReturnType<typeof buildProvisioningInput> & {
  pluginOidcClients: NonNullable<KeycloakProvisioningInput['pluginOidcClients']>;
};

const createPlanStaleError = (input: {
  readonly comparisonStage: Parameters<
    typeof buildKeycloakPlanComparisonDiagnostics
  >[0]['comparisonStage'];
  readonly stepKey: 'queue_enqueue' | 'worker_plan';
  readonly expectedFingerprint?: string;
  readonly actualPlan?: KeycloakTenantPlan;
}): unknown =>
  annotateInstanceRegistryError(
    new Error('keycloak_plan_fingerprint_stale'),
    input.stepKey,
    buildKeycloakPlanComparisonDiagnostics(input)
  );

const assertProvisioningIntentAllowed = (
  realmMode: KeycloakProvisioningInput['realmMode'],
  intent: ExecuteInstanceKeycloakProvisioningInput['intent']
): void => {
  if (realmMode === 'new' && intent === 'reset_tenant_admin') {
    throw new Error('reset_tenant_admin_requires_existing_realm');
  }
};

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
  const preflight = await createGetKeycloakPreflightHandler(deps)(loaded.instance.instanceId);
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

const appendPreflightSnapshot = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun,
  provisioningInput: ReturnType<typeof buildProvisioningInput>,
  inputFingerprint: string
) => {
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
    details: { policyVersion: KEYCLOAK_SNAPSHOT_POLICY_VERSION, inputFingerprint, preflight },
    requestId: run.requestId,
  });
  return preflight;
};

const appendPlanSnapshot = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun,
  provisioningInput: QueuedProvisioningInput,
  inputFingerprint: string,
  realmBaselineApplicable: boolean
) => {
  const planKeycloakProvisioning = deps.planKeycloakProvisioning;
  if (!planKeycloakProvisioning) {
    throw new Error('dependency_missing_planKeycloakProvisioning');
  }
  const plan = await planKeycloakProvisioning({
    ...provisioningInput,
    realmBaselineApplicable,
  });
  await appendRunStep(deps, {
    runId: run.id,
    stepKey: 'worker_plan_snapshot',
    title: 'Soll-Ist-Abgleich planen',
    status: plan.overallStatus === 'blocked' ? 'failed' : 'done',
    summary: plan.driftSummary,
    details: { policyVersion: KEYCLOAK_SNAPSHOT_POLICY_VERSION, inputFingerprint, plan },
    requestId: run.requestId,
  });
  return plan;
};

const syncClientSecretAfterProvisioning = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>
) => {
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
    tenantAdminClientSecret: loaded.tenantAdminClientSecret,
    requestId: run.requestId,
    actorId: run.actorId,
  });
};

const cleanupNewRealmAfterPostProvisioningFailure = async (
  deps: InstanceRegistryServiceDeps,
  provisioningInput: QueuedProvisioningInput,
  failure: unknown
): Promise<void> => {
  if (provisioningInput.realmMode !== 'new') return;
  let current;
  try {
    current = await loadInstanceWithSecret(deps, provisioningInput.instanceId);
  } catch (stateError) {
    const cleanupUnverified = new Error(
      'new_realm_cleanup_state_unavailable_requires_manual_action'
    ) as Error & { cause?: unknown };
    cleanupUnverified.cause = stateError;
    throw cleanupUnverified;
  }
  if (!current) return;
  if (current.instance.realmMode === 'existing') {
    const retrySafeFailure = new Error(
      'new_realm_accepted_post_provisioning_sync_failed_retry_safe'
    ) as Error & { cause?: unknown };
    retrySafeFailure.cause = failure;
    throw annotateInstanceRegistryError(
      retrySafeFailure,
      readInstanceRegistryStepKey(failure) ?? 'admin_bootstrap'
    );
  }
  if (current.instance.realmMode !== 'new') return;
  if (!deps.deleteProvisionedRealm) {
    const cleanupUnavailable = new Error(
      'new_realm_post_provisioning_cleanup_unavailable_requires_manual_action'
    ) as Error & { cause?: unknown };
    cleanupUnavailable.cause = failure;
    throw cleanupUnavailable;
  }
  try {
    await deps.deleteProvisionedRealm(provisioningInput.authRealm);
  } catch (cleanupError) {
    const manualActionError = new Error(
      'new_realm_post_provisioning_cleanup_failed_requires_manual_action'
    ) as Error & { cause?: unknown };
    manualActionError.cause = cleanupError;
    throw manualActionError;
  }
};

const finalizeProvisionedRun = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>,
  tenantAdminTemporaryPassword: string | undefined,
  provisioningInput: QueuedProvisioningInput
) => {
  try {
    await runInstanceRegistryStep('secret_sync', () =>
      syncClientSecretAfterProvisioning(deps, run, loaded)
    );
    const finalRunStatus = await runInstanceRegistryStep('worker_complete', () =>
      completeRun(deps, {
        loaded,
        runId: run.id,
        requestId: run.requestId,
        actorId: run.actorId,
        intent: run.intent,
        tenantAdminTemporaryPassword,
        pluginOidcClients: provisioningInput.pluginOidcClients,
      })
    );
    if (finalRunStatus === 'succeeded') {
      await runInstanceRegistryStep('admin_bootstrap', () =>
        syncTenantAdminBootstrapAccountAfterProvisioning(deps, run, loaded)
      );
    }
    return finalRunStatus;
  } catch (error) {
    await cleanupNewRealmAfterPostProvisioningFailure(deps, provisioningInput, error);
    throw error;
  }
};

const executeClaimedRun = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>,
  tenantAdminTemporaryPassword: string | undefined,
  provisioningInput: QueuedProvisioningInput,
  confirmedPlanFingerprint: string,
  realmBaselineApplicable: boolean
) => {
  assertProvisioningIntentAllowed(provisioningInput.realmMode, run.intent);
  const secretVersions = await loadKeycloakSnapshotSecretVersions(
    deps.repository,
    loaded.instance.instanceId
  );
  const inputFingerprint = buildKeycloakSnapshotInputFingerprint(
    loaded.instance,
    secretVersions,
    provisioningInput.pluginOidcClients
  );
  const preflight = await runInstanceRegistryStep('worker_preflight', () =>
    appendPreflightSnapshot(deps, run, provisioningInput, inputFingerprint)
  );
  const plan = await runInstanceRegistryStep('worker_plan', () =>
    appendPlanSnapshot(deps, run, provisioningInput, inputFingerprint, realmBaselineApplicable)
  );
  if (plan.fingerprint !== confirmedPlanFingerprint) {
    throw createPlanStaleError({
      comparisonStage: 'worker_plan',
      stepKey: 'worker_plan',
      expectedFingerprint: confirmedPlanFingerprint,
      actualPlan: plan,
    });
  }

  const rotatingMissingTenantSecret =
    run.intent === 'rotate_client_secret' && !loaded.authClientSecret;
  if (
    run.mode === 'existing' &&
    run.intent !== 'provision_admin_client' &&
    !rotatingMissingTenantSecret &&
    !loaded.authClientSecret
  ) {
    throw new Error('tenant_auth_client_secret_missing');
  }
  const secretRotationRecovery =
    rotatingMissingTenantSecret &&
    preflight.checks.every(
      (check) => check.checkKey === 'tenant_secret' || check.status !== 'blocked'
    );
  if (
    !secretRotationRecovery &&
    (preflight.overallStatus === 'blocked' || plan.overallStatus === 'blocked')
  ) {
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
