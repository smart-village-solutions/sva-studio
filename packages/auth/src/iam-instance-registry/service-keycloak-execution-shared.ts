import { areAllInstanceKeycloakRequirementsSatisfied } from '@sva/core';

import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { loadInstanceWithSecret } from './service-keycloak.js';
import { appendRunStep, buildFinalRunSteps } from './service-keycloak-run-steps.js';
import { protectField, revealField } from '../iam-account-management/encryption.js';
import { readKeycloakStateViaProvisioner } from './provisioning-auth-state.js';

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

export const readQueuedTemporaryPassword = (
  runId: string,
  details: Readonly<Record<string, unknown>> | undefined
): string | undefined => {
  const ciphertext =
    typeof details?.tenantAdminTemporaryPasswordCiphertext === 'string'
      ? details.tenantAdminTemporaryPasswordCiphertext
      : undefined;
  return revealField(ciphertext, buildTempPasswordAad(runId));
};

export const createQueuedRun = async (
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

export const syncRotatedClientSecretToRegistry = async (
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

export const syncProvisionedClientSecretToRegistry = async (
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

export const completeRun = async (
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
  const getKeycloakStatus = deps.getKeycloakStatus;
  if (!getKeycloakStatus) {
    throw new Error('dependency_missing_getKeycloakStatus');
  }
  const status = await getKeycloakStatus(buildProvisioningInput(input.loaded));

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

