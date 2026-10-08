import type { InstanceKeycloakProvisioningRun } from '@sva/core';
import type { KeycloakProvisioningInput } from './provisioning-auth-types.js';
import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { appendRunStep } from './service-keycloak-run-steps.js';
import { buildProvisioningInput } from './service-keycloak-execution-shared.js';
import {
  loadInstanceWithSecret,
  loadKeycloakSnapshotSecretVersions,
} from './service-keycloak-secrets.js';
import type { KeycloakTenantPlan, KeycloakTenantPreflight } from './keycloak-types.js';
import {
  annotateInstanceRegistryError,
  buildKeycloakPlanComparisonDiagnostics,
  runInstanceRegistryStep,
} from './observability.js';
import {
  buildKeycloakSnapshotInputFingerprint,
  KEYCLOAK_SNAPSHOT_POLICY_VERSION,
} from './provisioning-auth-policy.js';

export type QueuedProvisioningInput = ReturnType<typeof buildProvisioningInput> & {
  pluginOidcClients: NonNullable<KeycloakProvisioningInput['pluginOidcClients']>;
};

export const createPlanStaleError = (input: {
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

export const assertProvisioningIntentAllowed = (
  realmMode: KeycloakProvisioningInput['realmMode'],
  intent: ExecuteInstanceKeycloakProvisioningInput['intent']
): void => {
  if (realmMode === 'new' && intent === 'reset_tenant_admin') {
    throw new Error('reset_tenant_admin_requires_existing_realm');
  }
};
export const appendPreflightSnapshot = async (
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

export const appendPlanSnapshot = async (
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

const isMissingLoginClientBootstrap = (
  intent: InstanceKeycloakProvisioningRun['intent'],
  plan: KeycloakTenantPlan,
  preflight: KeycloakTenantPreflight
): boolean =>
  intent === 'provision' &&
  Boolean(
    plan.steps?.some(
      (step) => step.stepKey === 'client' && step.action === 'create' && step.status === 'ready'
    )
  ) &&
  preflight.checks.some(
    (check) =>
      check.checkKey === 'tenant_secret' &&
      check.status === 'warning' &&
      check.details.generatedDuringProvisioning === true
  );

export const validateWorkerSnapshot = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>,
  provisioningInput: QueuedProvisioningInput,
  confirmedPlanFingerprint: string,
  realmBaselineApplicable: boolean
): Promise<boolean> => {
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
  const bootstrappingMissingLoginClient = isMissingLoginClientBootstrap(
    run.intent,
    plan,
    preflight
  );
  if (
    run.mode === 'existing' &&
    run.intent !== 'provision_admin_client' &&
    !rotatingMissingTenantSecret &&
    !bootstrappingMissingLoginClient &&
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
    return false;
  }
  return true;
};
