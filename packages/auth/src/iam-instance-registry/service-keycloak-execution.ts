import { createSdkLogger } from '@sva/sdk/server';
import { areAllInstanceKeycloakRequirementsSatisfied, type InstanceKeycloakProvisioningRun } from '@sva/core';

import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { createGetKeycloakStatusHandler, loadInstanceWithSecret } from './service-keycloak.js';
import { appendRunStep, buildFinalRunSteps } from './service-keycloak-run-steps.js';
import { protectField, revealField } from '../iam-account-management/encryption.js';
import { readKeycloakStateViaProvisioner } from './provisioning-auth-state.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

const buildTempPasswordAad = (runId: string): string => `iam.instances.keycloak_run_temp_password:${runId}`;
const buildAuthClientSecretAad = (instanceId: string): string => `iam.instances.auth_client_secret:${instanceId}`;

export const buildProvisioningInput = (
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>
) => ({
  instanceId: loaded.instance.instanceId,
  primaryHostname: loaded.instance.primaryHostname,
  realmMode: loaded.instance.realmMode,
  authRealm: loaded.instance.authRealm,
  authClientId: loaded.instance.authClientId,
  authIssuerUrl: loaded.instance.authIssuerUrl,
  authClientSecretConfigured: loaded.instance.authClientSecretConfigured,
  authClientSecret: loaded.authClientSecret,
  tenantAdminBootstrap: loaded.instance.tenantAdminBootstrap,
});

const readQueuedTemporaryPassword = (runId: string, details: Readonly<Record<string, unknown>> | undefined): string | undefined => {
  const ciphertext = typeof details?.tenantAdminTemporaryPasswordCiphertext === 'string'
    ? details.tenantAdminTemporaryPasswordCiphertext
    : undefined;
  return revealField(ciphertext, buildTempPasswordAad(runId));
};

const createQueuedRun = async (
  deps: InstanceRegistryServiceDeps,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>,
  input: ExecuteInstanceKeycloakProvisioningInput
) => {
  const provisioningInput = buildProvisioningInput(loaded);
  const run = await deps.repository.createKeycloakProvisioningRun({
    instanceId: loaded.instance.instanceId,
    mode: loaded.instance.realmMode,
    intent: input.intent,
    overallStatus: 'planned',
    driftSummary: 'Provisioning-Auftrag erstellt und für den Worker vorgemerkt.',
    actorId: input.actorId,
    requestId: input.requestId,
  });

  await appendRunStep(deps, {
    runId: run.id,
    stepKey: 'queued',
    title: 'Provisioning-Auftrag einreihen',
    status: 'pending',
    summary: 'Der Auftrag wurde gespeichert und wartet auf die Abarbeitung durch den Provisioning-Worker.',
    details: {
      intent: input.intent,
      mode: loaded.instance.realmMode,
      authRealm: loaded.instance.authRealm,
      authClientId: loaded.instance.authClientId,
      primaryHostname: loaded.instance.primaryHostname,
      tenantAdminTemporaryPasswordCiphertext: input.tenantAdminTemporaryPassword
        ? protectField(input.tenantAdminTemporaryPassword, buildTempPasswordAad(run.id))
        : undefined,
    },
    requestId: input.requestId,
  });

  return { provisioningInput, run };
};

const encryptAuthClientSecret = (instanceId: string, secret: string | undefined): string | undefined => {
  const normalizedSecret = secret?.trim();
  if (!normalizedSecret) {
    return undefined;
  }
  return protectField(normalizedSecret, buildAuthClientSecretAad(instanceId)) ?? undefined;
};

const syncRotatedClientSecretToRegistry = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>;
    requestId?: string;
    actorId?: string;
  }
) => {
  const state = await readKeycloakStateViaProvisioner(buildProvisioningInput(input.loaded));
  const rotatedSecret = state.keycloakClientSecret;
  if (!rotatedSecret) {
    throw new Error('tenant_auth_client_secret_missing_after_rotation');
  }

  await deps.repository.updateInstance({
    instanceId: input.loaded.instance.instanceId,
    displayName: input.loaded.instance.displayName,
    parentDomain: input.loaded.instance.parentDomain,
    primaryHostname: input.loaded.instance.primaryHostname,
    realmMode: input.loaded.instance.realmMode,
    authRealm: input.loaded.instance.authRealm,
    authClientId: input.loaded.instance.authClientId,
    authIssuerUrl: input.loaded.instance.authIssuerUrl,
    authClientSecretCiphertext: encryptAuthClientSecret(input.loaded.instance.instanceId, rotatedSecret),
    keepExistingAuthClientSecret: false,
    tenantAdminBootstrap: input.loaded.instance.tenantAdminBootstrap,
    actorId: input.actorId,
    requestId: input.requestId,
    themeKey: input.loaded.instance.themeKey,
    featureFlags: input.loaded.instance.featureFlags,
    mainserverConfigRef: input.loaded.instance.mainserverConfigRef,
  });

  input.loaded.authClientSecret = rotatedSecret;
};

const syncProvisionedClientSecretToRegistry = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>;
    requestId?: string;
    actorId?: string;
  }
) => {
  if (input.loaded.authClientSecret) {
    return;
  }

  const state = await readKeycloakStateViaProvisioner(buildProvisioningInput(input.loaded));
  const provisionedSecret = state.keycloakClientSecret;
  if (!provisionedSecret) {
    return;
  }

  await deps.repository.updateInstance({
    instanceId: input.loaded.instance.instanceId,
    displayName: input.loaded.instance.displayName,
    parentDomain: input.loaded.instance.parentDomain,
    primaryHostname: input.loaded.instance.primaryHostname,
    realmMode: input.loaded.instance.realmMode,
    authRealm: input.loaded.instance.authRealm,
    authClientId: input.loaded.instance.authClientId,
    authIssuerUrl: input.loaded.instance.authIssuerUrl,
    authClientSecretCiphertext: encryptAuthClientSecret(input.loaded.instance.instanceId, provisionedSecret),
    keepExistingAuthClientSecret: false,
    tenantAdminBootstrap: input.loaded.instance.tenantAdminBootstrap,
    actorId: input.actorId,
    requestId: input.requestId,
    themeKey: input.loaded.instance.themeKey,
    featureFlags: input.loaded.instance.featureFlags,
    mainserverConfigRef: input.loaded.instance.mainserverConfigRef,
  });

  input.loaded.authClientSecret = provisionedSecret;
};

const completeRun = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>;
    runId: string;
    requestId?: string;
    actorId?: string;
    intent: ExecuteInstanceKeycloakProvisioningInput['intent'];
    tenantAdminTemporaryPassword?: string;
  }
) => {
  const status = await deps.getKeycloakStatus!(buildProvisioningInput(input.loaded));

  await appendRunStep(deps, {
    runId: input.runId,
    stepKey: 'status_snapshot',
    title: 'Keycloak-Status aufnehmen',
    status: 'done',
    summary: 'Der Worker hat den Keycloak-Istzustand nach dem Lauf gespeichert.',
    details: { status },
    requestId: input.requestId,
  });

  const completionSteps = buildFinalRunSteps({
    status,
    intent: input.intent,
    usedTemporaryPassword: Boolean(input.tenantAdminTemporaryPassword),
  });

  for (const step of completionSteps) {
    await appendRunStep(deps, {
      runId: input.runId,
      stepKey: step.stepKey,
      title: step.title,
      status: step.ok ? 'done' : 'failed',
      summary: step.summary,
      details: step.details,
      requestId: input.requestId,
    });
  }

  const finalRunStatus =
    completionSteps.every((step) => step.ok) && areAllInstanceKeycloakRequirementsSatisfied(status)
      ? 'succeeded'
      : 'failed';

  if (finalRunStatus === 'succeeded' && input.loaded.instance.status !== 'active') {
    await deps.repository.setInstanceStatus({
      instanceId: input.loaded.instance.instanceId,
      status: 'provisioning',
      actorId: input.actorId,
      requestId: input.requestId,
    });
  }

  await deps.repository.updateKeycloakProvisioningRun({
    runId: input.runId,
    overallStatus: finalRunStatus,
    driftSummary:
      finalRunStatus === 'succeeded'
        ? 'Provisioning erfolgreich abgeschlossen.'
        : 'Provisioning abgeschlossen, aber einzelne Sollzustände weichen weiterhin ab.',
  });
  return finalRunStatus;
};

const failRun = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    runId: string;
    requestId?: string;
    error: unknown;
  }
) => {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  await appendRunStep(deps, {
    runId: input.runId,
    stepKey: 'execution',
    title: 'Provisioning ausführen',
    status: 'failed',
    summary: message,
    details: { error: message },
    requestId: input.requestId,
  });
  await deps.repository.updateKeycloakProvisioningRun({
    runId: input.runId,
    overallStatus: 'failed',
    driftSummary: 'Provisioning wurde mit einem Fehler abgebrochen.',
  });
};

const failClaimedRun = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    runId: string;
    requestId?: string;
    summary: string;
    details?: Readonly<Record<string, unknown>>;
  }
) => {
  await appendRunStep(deps, {
    runId: input.runId,
    stepKey: 'worker',
    title: 'Provisioning-Worker',
    status: 'failed',
    summary: input.summary,
    details: input.details,
    requestId: input.requestId,
  });
  await deps.repository.updateKeycloakProvisioningRun({
    runId: input.runId,
    overallStatus: 'failed',
    driftSummary: input.summary,
  });
};

export const processClaimedKeycloakProvisioningRun = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun | null
) => {
  if (!run) {
    return null;
  }

  if (!deps.provisionInstanceAuth || !deps.getKeycloakStatus || !deps.getKeycloakPreflight || !deps.planKeycloakProvisioning) {
    await failClaimedRun(deps, {
      runId: run.id,
      requestId: run.requestId,
      summary: 'Provisioning-Worker ist unvollständig konfiguriert.',
      details: { reason: 'dependency_missing' },
    });
    return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
  }

  const loaded = await loadInstanceWithSecret(deps, run.instanceId);
  if (!loaded) {
    await failClaimedRun(deps, {
      runId: run.id,
      requestId: run.requestId,
      summary: 'Die Instanz konnte für den Provisioning-Lauf nicht mehr geladen werden.',
      details: { reason: 'instance_not_found' },
    });
    return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
  }

  const queueStep = run.steps.find((step: InstanceKeycloakProvisioningRun['steps'][number]) => step.stepKey === 'queued');
  const tenantAdminTemporaryPassword = readQueuedTemporaryPassword(run.id, queueStep?.details);
  const provisioningInput = buildProvisioningInput(loaded);

  await appendRunStep(deps, {
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

  try {
    const preflight = await deps.getKeycloakPreflight(provisioningInput);
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

    const plan = await deps.planKeycloakProvisioning(provisioningInput);
    await appendRunStep(deps, {
      runId: run.id,
      stepKey: 'worker_plan_snapshot',
      title: 'Soll-Ist-Abgleich planen',
      status: plan.overallStatus === 'blocked' ? 'failed' : 'done',
      summary: plan.driftSummary,
      details: { plan },
      requestId: run.requestId,
    });

    if (run.mode === 'existing' && !loaded.authClientSecret) {
      throw new Error('tenant_auth_client_secret_missing');
    }

    if (preflight.overallStatus === 'blocked' || plan.overallStatus === 'blocked') {
      await deps.repository.updateKeycloakProvisioningRun({
        runId: run.id,
        overallStatus: 'failed',
        driftSummary: 'Provisioning blockiert: Worker-Preflight oder Plan melden Blocker.',
      });
      return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
    }

    await deps.provisionInstanceAuth({
      ...provisioningInput,
      tenantAdminTemporaryPassword,
      rotateClientSecret: run.intent === 'rotate_client_secret',
    });

    if (run.intent === 'rotate_client_secret') {
      await syncRotatedClientSecretToRegistry(deps, {
        loaded,
        requestId: run.requestId,
        actorId: run.actorId,
      });
    } else {
      await syncProvisionedClientSecretToRegistry(deps, {
        loaded,
        requestId: run.requestId,
        actorId: run.actorId,
      });
    }

    const finalRunStatus = await completeRun(deps, {
      loaded,
      runId: run.id,
      requestId: run.requestId,
      actorId: run.actorId,
      intent: run.intent,
      tenantAdminTemporaryPassword,
    });

    logger.info('keycloak_provisioning_completed', {
      operation: 'process_keycloak_provisioning_run',
      instance_id: loaded.instance.instanceId,
      request_id: run.requestId,
      run_id: run.id,
      overall_status: finalRunStatus,
    });

    return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
  } catch (error) {
    await failRun(deps, { runId: run.id, requestId: run.requestId, error });
    logger.error('keycloak_provisioning_failed', {
      operation: 'process_keycloak_provisioning_run',
      instance_id: run.instanceId,
      request_id: run.requestId,
      run_id: run.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
  }
};

export const processNextQueuedKeycloakProvisioningRun = async (deps: InstanceRegistryServiceDeps) =>
  processClaimedKeycloakProvisioningRun(
    deps,
    await (
      deps.repository as InstanceRegistryServiceDeps['repository'] & {
        claimNextKeycloakProvisioningRun: () => Promise<InstanceKeycloakProvisioningRun | null>;
      }
    ).claimNextKeycloakProvisioningRun()
  );

export const createExecuteKeycloakProvisioningHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (input: ExecuteInstanceKeycloakProvisioningInput) => {
    logger.info('keycloak_provisioning_enqueued', {
      operation: 'execute_keycloak_provisioning',
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

    const { run } = await createQueuedRun(deps, loaded, input);
    return deps.repository.getKeycloakProvisioningRun(loaded.instance.instanceId, run.id);
  };

export const createReconcileKeycloakHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (input: {
    instanceId: string;
    actorId: string;
    requestId: string;
    tenantAdminTemporaryPassword?: string;
    rotateClientSecret?: boolean;
  }) => {
    const loaded = await loadInstanceWithSecret(deps, input.instanceId);
    if (!loaded) {
      return null;
    }

    if (loaded.instance.realmMode === 'existing' && !loaded.authClientSecret) {
      throw new Error('tenant_auth_client_secret_missing');
    }

    const run = await createExecuteKeycloakProvisioningHandler(deps)({
      instanceId: input.instanceId,
      actorId: input.actorId,
      requestId: input.requestId,
      tenantAdminTemporaryPassword: input.tenantAdminTemporaryPassword,
      intent: input.rotateClientSecret ? 'rotate_client_secret' : 'provision',
    });
    if (!run) {
      return null;
    }

    return createGetKeycloakStatusHandler(deps)(input.instanceId);
  };
