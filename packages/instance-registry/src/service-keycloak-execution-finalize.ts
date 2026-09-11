import {
  areAllInstanceKeycloakRequirementsSatisfied,
  isInstanceTenantAdminRequired,
  type InstanceRegistryRecord,
} from '@sva/core';

import type { KeycloakTenantStatus } from './keycloak-types.js';
import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import type { KeycloakProvisioningInput, KeycloakReadState } from './provisioning-auth-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { loadInstanceWithSecret, loadKeycloakSnapshotSecretVersions } from './service-keycloak-secrets.js';
import { appendRunStep, buildFinalRunSteps } from './service-keycloak-run-steps.js';
import { buildProvisioningInput } from './service-keycloak-execution-payload.js';
import {
  buildKeycloakSnapshotInputFingerprint,
  KEYCLOAK_SNAPSHOT_POLICY_VERSION,
} from './provisioning-auth-policy.js';
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
  state: KeycloakReadState
) => {
  const finalProvisioningInput = buildProvisioningInput({ ...input.loaded, instance: snapshotInstance });
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
        await loadKeycloakSnapshotSecretVersions(deps.repository, snapshotInstance.instanceId)
      ),
      status,
      preflight,
      plan,
    },
    requestId: input.requestId,
  });
};

export const completeRun = async (
  deps: InstanceRegistryServiceDeps,
  input: CompleteRunInput
) => {
  const readKeycloakState = deps.readKeycloakStateViaProvisioner;
  if (!readKeycloakState) {
    throw new Error('dependency_missing_readKeycloakStateViaProvisioner');
  }
  const provisioningInput = buildProvisioningInput(input.loaded);
  const state = await readKeycloakState(provisioningInput);
  const status = buildStatusFromState(provisioningInput, state);
  const requireTenantAdmin = isInstanceTenantAdminRequired(input.loaded.instance);

  const completionSteps = buildFinalRunSteps({
    status,
    intent: input.intent,
    usedTemporaryPassword: Boolean(input.tenantAdminTemporaryPassword),
    requireTenantAdmin,
  });

  const completionSatisfied = completionSteps.every((step) => step.ok);
  const finalRunStatus =
    completionSatisfied &&
    (input.intent === 'reset_tenant_admin' ||
      areAllInstanceKeycloakRequirementsSatisfied(status, { requireTenantAdmin }))
      ? 'succeeded'
      : 'failed';

  let snapshotInstance = input.loaded.instance;

  if (
    finalRunStatus === 'succeeded' &&
    input.intent !== 'reset_tenant_admin' &&
    input.loaded.instance.realmMode === 'new'
  ) {
    snapshotInstance =
      (await deps.repository.setInstanceRealmMode({
        instanceId: input.loaded.instance.instanceId,
        realmMode: 'existing',
        actorId: input.actorId,
        requestId: input.requestId,
      })) ?? snapshotInstance;
  }

  if (finalRunStatus === 'succeeded' && input.loaded.instance.status !== 'active') {
    snapshotInstance =
      (await deps.repository.setInstanceStatus({
        instanceId: input.loaded.instance.instanceId,
        status: 'provisioning',
        actorId: input.actorId,
        requestId: input.requestId,
      })) ?? snapshotInstance;
  }

  await appendFinalStatusSnapshot(deps, input, snapshotInstance, state);

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
