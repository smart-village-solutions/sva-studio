import { createSdkLogger } from '@sva/server-runtime';
import {
  areAllInstanceKeycloakRequirementsSatisfied,
  isInstanceTenantAdminRequired,
  type InstanceRegistryRecord,
} from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

import {
  buildSmtpPasswordPlanStep,
  KEYCLOAK_REALM_BASELINE,
  KEYCLOAK_REALM_BASELINE_FINGERPRINT,
} from './keycloak-realm-baseline.js';
import type { KeycloakTenantPlan, KeycloakTenantStatus } from './keycloak-types.js';
import { KEYCLOAK_SNAPSHOT_POLICY_VERSION } from './provisioning-auth-policy.js';
import {
  decryptAuthClientSecret,
  decryptTenantAdminClientSecret,
  loadInstanceWithSecret,
  loadPersistedSnapshotSecretVersions,
} from './service-keycloak-secrets.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { readLatestQueuedPluginOidcClientRequirements } from './service-keycloak-execution-payload.js';
import type { PluginOidcClientRequirement } from './provisioning-auth-types.js';
import { buildKeycloakPlanFingerprint } from './provisioning-auth-plan.js';

type ProvisioningRuns = readonly Awaited<
  ReturnType<InstanceRegistryRepository['listKeycloakProvisioningRuns']>
>[number][];
type ProvisioningRun = ProvisioningRuns[number];
type SnapshotInputFingerprint =
  string | readonly string[] | ((run: ProvisioningRun) => string | readonly string[]);

const logger = createSdkLogger({
  component: 'iam-instance-registry-keycloak-snapshots',
  level: 'info',
});

export const isLiveKeycloakStatusReadyForActivation = async (
  deps: InstanceRegistryServiceDeps,
  instanceId: string,
  pluginOidcClients?: readonly PluginOidcClientRequirement[]
): Promise<boolean> => {
  try {
    const loaded = await loadInstanceWithSecret(deps, instanceId);
    if (!loaded || !deps.getKeycloakStatus) return false;
    const runs = pluginOidcClients
      ? []
      : await deps.repository.listKeycloakProvisioningRuns(instanceId);
    const scopedPluginOidcClients =
      pluginOidcClients ??
      readLatestQueuedPluginOidcClientRequirements(
        runs,
        loaded.instance,
        deps.readPluginOidcClientRequirements?.()
      );
    const status = await deps.getKeycloakStatus({
      ...loaded.instance,
      authClientSecret: loaded.authClientSecret,
      tenantAdminClientSecret: loaded.tenantAdminClientSecret,
      pluginOidcClients: scopedPluginOidcClients,
    });
    return areAllInstanceKeycloakRequirementsSatisfied(status, {
      requireTenantAdmin: isInstanceTenantAdminRequired(loaded.instance),
    });
  } catch {
    return false;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasCompletedStep = (
  run: ProvisioningRuns[number],
  stepKey: string,
  status: 'done' | 'failed'
): boolean => run.steps.some((step) => step.stepKey === stepKey && step.status === status);

const hasCurrentStatusSnapshot = (
  run: ProvisioningRuns[number],
  authRealm: string,
  authClientId: string
): boolean =>
  run.steps.some(
    (step) =>
      step.stepKey === 'status_snapshot' &&
      step.status === 'done' &&
      isRecord(step.details) &&
      step.details.policyVersion === KEYCLOAK_SNAPSHOT_POLICY_VERSION &&
      step.details.authRealm === authRealm &&
      step.details.authClientId === authClientId &&
      step.details.realmBaselineVersion === KEYCLOAK_REALM_BASELINE.version &&
      step.details.realmBaselineFingerprint === KEYCLOAK_REALM_BASELINE_FINGERPRINT
  );

export const isRealmBaselineApplicable = (
  realmMode: 'new' | 'existing',
  runs: ProvisioningRuns,
  authRealm: string,
  authClientId: string
): boolean =>
  realmMode === 'new' ||
  runs.some(
    (run) =>
      run.mode === 'new' &&
      hasCompletedStep(run, 'realm_baseline', 'done') &&
      hasCurrentStatusSnapshot(run, authRealm, authClientId) &&
      (run.overallStatus === 'succeeded' ||
        (run.overallStatus === 'failed' && hasCompletedStep(run, 'admin_bootstrap', 'failed')))
  );

export const loadRealmBaselineApplicability = async (
  deps: InstanceRegistryServiceDeps,
  instance: InstanceRegistryRecord,
  runs?: ProvisioningRuns
): Promise<boolean> => {
  if (instance.realmMode === 'new') return true;
  return isRealmBaselineApplicable(
    instance.realmMode,
    runs ?? (await deps.repository.listKeycloakProvisioningRuns(instance.instanceId)),
    instance.authRealm,
    instance.authClientId
  );
};

export const refreshManagedRealmSmtpPasswordStatus = async (
  deps: InstanceRegistryServiceDeps,
  instance: NonNullable<Awaited<ReturnType<InstanceRegistryRepository['getInstanceById']>>>,
  runs: Awaited<ReturnType<InstanceRegistryRepository['listKeycloakProvisioningRuns']>>,
  secretVersions: Awaited<ReturnType<typeof loadPersistedSnapshotSecretVersions>>,
  status: KeycloakTenantStatus
): Promise<KeycloakTenantStatus> => {
  if (
    !deps.getKeycloakStatus ||
    !deps.revealSecret ||
    !isRealmBaselineApplicable(instance.realmMode, runs, instance.authRealm, instance.authClientId)
  ) {
    return status;
  }

  try {
    const liveStatus = await deps.getKeycloakStatus({
      instanceId: instance.instanceId,
      primaryHostname: instance.primaryHostname,
      realmMode: instance.realmMode,
      authRealm: instance.authRealm,
      authClientId: instance.authClientId,
      authIssuerUrl: instance.authIssuerUrl,
      authClientSecretConfigured: instance.authClientSecretConfigured,
      authClientSecret: decryptAuthClientSecret(
        deps,
        instance.instanceId,
        secretVersions?.authClientSecretCiphertext
      ),
      tenantAdminClient: instance.tenantAdminClient,
      tenantAdminClientSecret: decryptTenantAdminClientSecret(
        deps,
        instance.instanceId,
        secretVersions?.tenantAdminClientSecretCiphertext
      ),
      tenantAdminBootstrap: instance.tenantAdminBootstrap,
    });
    return {
      ...status,
      smtpPasswordConfigured: liveStatus.smtpPasswordConfigured ?? false,
    };
  } catch (error) {
    logger.warn('keycloak_smtp_password_status_refresh_failed', {
      operation: 'get_keycloak_status',
      instance_id: instance.instanceId,
      error_type: error instanceof Error ? error.constructor.name : typeof error,
    });
    return status;
  }
};

export const readSnapshotFromRuns = <T>(
  runs: ProvisioningRuns,
  stepKeys: readonly string[],
  field: 'status' | 'preflight' | 'plan',
  policyVersion: number,
  inputFingerprint: SnapshotInputFingerprint
): T | null => {
  for (const run of runs) {
    const expectedFingerprint =
      typeof inputFingerprint === 'function' ? inputFingerprint(run) : inputFingerprint;
    const acceptedFingerprints = new Set(
      typeof expectedFingerprint === 'string' ? [expectedFingerprint] : expectedFingerprint
    );
    for (const stepKey of stepKeys) {
      const step = run.steps.find((candidate) => candidate.stepKey === stepKey);
      if (
        isRecord(step?.details) &&
        step.details.policyVersion === policyVersion &&
        typeof step.details.inputFingerprint === 'string' &&
        acceptedFingerprints.has(step.details.inputFingerprint) &&
        step.details[field]
      ) {
        return step.details[field] as T;
      }
    }
  }
  return null;
};

export const readManagedRealmPlanSnapshot = async (
  deps: InstanceRegistryServiceDeps,
  instance: NonNullable<Awaited<ReturnType<InstanceRegistryRepository['getInstanceById']>>>,
  runs: Awaited<ReturnType<InstanceRegistryRepository['listKeycloakProvisioningRuns']>>,
  secretVersions: Awaited<ReturnType<typeof loadPersistedSnapshotSecretVersions>>,
  inputFingerprint: SnapshotInputFingerprint
): Promise<KeycloakTenantPlan | null> => {
  const plan = readSnapshotFromRuns<KeycloakTenantPlan>(
    runs,
    ['status_snapshot', 'worker_plan_snapshot'],
    'plan',
    KEYCLOAK_SNAPSHOT_POLICY_VERSION,
    inputFingerprint
  );
  if (!plan) return null;

  const status = readSnapshotFromRuns<KeycloakTenantStatus>(
    runs,
    ['status_snapshot'],
    'status',
    KEYCLOAK_SNAPSHOT_POLICY_VERSION,
    inputFingerprint
  );
  if (!status) return plan;

  const refreshedStatus = await refreshManagedRealmSmtpPasswordStatus(
    deps,
    instance,
    runs,
    secretVersions,
    status
  );
  if (refreshedStatus.smtpPasswordConfigured === status.smtpPasswordConfigured) return plan;

  const refreshedPlan = {
    ...plan,
    steps: plan.steps.map((step) =>
      step.stepKey === 'smtp_password'
        ? buildSmtpPasswordPlanStep(
            Boolean(refreshedStatus.smtpPasswordConfigured),
            step.status === 'blocked',
            step.details.applicable === true
          )
        : step
    ),
  };
  return {
    ...refreshedPlan,
    fingerprint: buildKeycloakPlanFingerprint(instance.instanceId, refreshedPlan),
  };
};
