import {
  areAllInstanceKeycloakRequirementsSatisfied,
  isInstanceTenantAdminRequired,
  type InstanceRegistryRecord,
  type InstanceProvisioningRun,
} from '@sva/core';

import type { KeycloakTenantStatus } from './keycloak-types.js';
import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import type { KeycloakProvisioningInput, KeycloakReadState } from './provisioning-auth-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import {
  loadInstanceWithSecret,
  loadKeycloakSnapshotSecretVersions,
} from './service-keycloak-secrets.js';
import { appendRunStep, buildFinalRunSteps } from './service-keycloak-run-steps.js';
import { buildProvisioningInput } from './service-keycloak-execution-payload.js';
import {
  buildKeycloakSnapshotInputFingerprint,
  KEYCLOAK_SNAPSHOT_POLICY_VERSION,
} from './provisioning-auth-policy.js';
import { isRealmBaselineApplicable } from './service-keycloak-snapshot-reader.js';
import {
  buildKeycloakStatus,
  buildMissingRealmStatus,
  buildPlan,
  buildPreflightChecks,
  toOverallPreflightStatus,
} from './provisioning-auth-evaluation.js';

type CompleteRunInput = {
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>;
  runId: string;
  requestId?: string;
  actorId?: string;
  intent: ExecuteInstanceKeycloakProvisioningInput['intent'];
  tenantAdminTemporaryPassword?: string;
  pluginOidcClients?: KeycloakProvisioningInput['pluginOidcClients'];
};

const resolveFinalSnapshotInstance = (
  input: CompleteRunInput,
  snapshotInstance: InstanceRegistryRecord,
  finalRunStatus: 'succeeded' | 'failed',
  transitionNewRealm: boolean
): InstanceRegistryRecord | undefined => {
  if (finalRunStatus === 'failed' && input.loaded.instance.realmMode === 'new') return undefined;
  return transitionNewRealm ? { ...snapshotInstance, realmMode: 'existing' } : snapshotInstance;
};

const assertParentProvisioningRunActive = (
  provisioningRuns: readonly InstanceProvisioningRun[],
  input: CompleteRunInput
): void => {
  const parent = provisioningRuns.find((run) => run.childKeycloakRunId === input.runId);
  if (parent && !['requested', 'validated', 'provisioning'].includes(parent.status)) {
    throw new Error('keycloak_parent_provisioning_run_inactive');
  }
};

const loadRealmBaselineApplicability = async (
  deps: InstanceRegistryServiceDeps,
  instance: InstanceRegistryRecord
): Promise<boolean> => {
  if (instance.realmMode === 'new') return true;
  return isRealmBaselineApplicable(
    instance.realmMode,
    await deps.repository.listKeycloakProvisioningRuns(instance.instanceId)
  );
};

const buildStatusFromState = (
  provisioningInput: KeycloakProvisioningInput,
  state: KeycloakReadState
): KeycloakTenantStatus =>
  state.realm
    ? buildKeycloakStatus({ ...provisioningInput, state })
    : buildMissingRealmStatus(
        provisioningInput.authClientSecretConfigured,
        provisioningInput.authClientSecret,
        provisioningInput.tenantAdminClient,
        provisioningInput.tenantAdminClientSecret,
        (provisioningInput.pluginOidcClients?.length ?? 0) === 0
      );

const appendFinalStatusSnapshot = async (
  deps: InstanceRegistryServiceDeps,
  input: CompleteRunInput,
  snapshotInstance: InstanceRegistryRecord,
  state: KeycloakReadState,
  realmBaselineApplicable: boolean
) => {
  const finalProvisioningInput = {
    ...buildProvisioningInput({ ...input.loaded, instance: snapshotInstance }),
    pluginOidcClients: input.pluginOidcClients ?? [],
  };
  const status = buildStatusFromState(finalProvisioningInput, state);
  const checks = buildPreflightChecks({
    realmMode: finalProvisioningInput.realmMode,
    authClientSecretConfigured: finalProvisioningInput.authClientSecretConfigured,
    authClientSecret: finalProvisioningInput.authClientSecret,
    tenantAdminClient: finalProvisioningInput.tenantAdminClient,
    tenantAdminClientSecret: finalProvisioningInput.tenantAdminClientSecret,
    tenantAdminBootstrap: finalProvisioningInput.tenantAdminBootstrap,
    state,
  });
  const preflight = {
    overallStatus: toOverallPreflightStatus(checks),
    checkedAt: new Date().toISOString(),
    checks,
  };
  const plan = buildPlan({
    instanceId: finalProvisioningInput.instanceId,
    realmMode: finalProvisioningInput.realmMode,
    authClientSecret: finalProvisioningInput.authClientSecret,
    tenantAdminClient: finalProvisioningInput.tenantAdminClient,
    tenantAdminClientSecret: finalProvisioningInput.tenantAdminClientSecret,
    tenantAdminBootstrap: finalProvisioningInput.tenantAdminBootstrap,
    pluginOidcClients: finalProvisioningInput.pluginOidcClients,
    realmBaselineApplicable,
    preflight,
    state,
  });
  await appendRunStep(deps, {
    runId: input.runId,
    stepKey: 'status_snapshot',
    title: 'Keycloak-Status aufnehmen',
    status: 'done',
    summary: 'Der Worker hat den Keycloak-Istzustand nach dem Lauf gespeichert.',
    details: {
      policyVersion: KEYCLOAK_SNAPSHOT_POLICY_VERSION,
      inputFingerprint: buildKeycloakSnapshotInputFingerprint(
        snapshotInstance,
        await loadKeycloakSnapshotSecretVersions(deps.repository, snapshotInstance.instanceId),
        input.pluginOidcClients ?? []
      ),
      status,
      preflight,
      plan,
    },
    requestId: input.requestId,
  });
};

export const completeRun = async (deps: InstanceRegistryServiceDeps, input: CompleteRunInput) => {
  const readKeycloakState = deps.readKeycloakStateViaProvisioner;
  if (!readKeycloakState) {
    throw new Error('dependency_missing_readKeycloakStateViaProvisioner');
  }
  const provisioningInput = {
    ...buildProvisioningInput(input.loaded),
    pluginOidcClients: input.pluginOidcClients ?? [],
  };
  const state = await readKeycloakState(provisioningInput);
  const status = buildStatusFromState(provisioningInput, state);
  const requireTenantAdmin = isInstanceTenantAdminRequired(input.loaded.instance);
  const provisioningRuns = await deps.repository.listProvisioningRuns(provisioningInput.instanceId);
  const realmBaselineApplicable = await loadRealmBaselineApplicability(
    deps,
    input.loaded.instance
  );

  const completionSteps = buildFinalRunSteps({
    status,
    intent: input.intent,
    usedTemporaryPassword: Boolean(input.tenantAdminTemporaryPassword),
    requireTenantAdmin,
    requireRealmBaseline: realmBaselineApplicable,
  });

  const completionSatisfied = completionSteps.every((step) => step.ok);
  const finalRunStatus =
    completionSatisfied &&
    (input.intent === 'reset_tenant_admin' ||
      areAllInstanceKeycloakRequirementsSatisfied(status, { requireTenantAdmin }))
      ? 'succeeded'
      : 'failed';
  const transitionNewRealm =
    finalRunStatus === 'succeeded' &&
    input.intent !== 'reset_tenant_admin' &&
    input.loaded.instance.realmMode === 'new';

  assertParentProvisioningRunActive(provisioningRuns, input);

  let snapshotInstance = input.loaded.instance;

  if (finalRunStatus === 'succeeded' && input.loaded.instance.status !== 'active') {
    snapshotInstance =
      (await deps.repository.setInstanceStatus({
        instanceId: input.loaded.instance.instanceId,
        status: 'provisioning',
        actorId: input.actorId,
        requestId: input.requestId,
      })) ?? snapshotInstance;
  }

  const finalSnapshotInstance = resolveFinalSnapshotInstance(
    input,
    snapshotInstance,
    finalRunStatus,
    transitionNewRealm
  );
  if (finalSnapshotInstance) {
    await appendFinalStatusSnapshot(
      deps,
      input,
      finalSnapshotInstance,
      state,
      realmBaselineApplicable
    );
  }

  for (const step of completionSteps) {
    await appendRunStep(deps, {
      runId: input.runId,
      stepKey: step.stepKey,
      title: step.title,
      status: step.status ?? (step.ok ? 'done' : 'failed'),
      summary: step.summary,
      details: step.details,
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

  if (transitionNewRealm) {
    await deps.repository.setInstanceRealmMode({
      instanceId: input.loaded.instance.instanceId,
      realmMode: 'existing',
      actorId: input.actorId,
      requestId: input.requestId,
    });
  }
  return finalRunStatus;
};
