import { createSdkLogger } from '@sva/server-runtime';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

import type { KeycloakTenantStatus } from './keycloak-types.js';
import {
  decryptAuthClientSecret,
  decryptTenantAdminClientSecret,
  loadPersistedSnapshotSecretVersions,
} from './service-keycloak-secrets.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

type ProvisioningRuns = readonly Awaited<
  ReturnType<InstanceRegistryRepository['listKeycloakProvisioningRuns']>
>[number][];

const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak-snapshots', level: 'info' });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isRealmBaselineApplicable = (
  realmMode: 'new' | 'existing',
  runs: ProvisioningRuns
): boolean =>
  realmMode === 'new' ||
  runs.some(
    (run) =>
      run.mode === 'new' &&
      run.steps.some((step) => step.stepKey === 'realm_baseline' && step.status === 'done')
  );

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
    !isRealmBaselineApplicable(instance.realmMode, runs)
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
  inputFingerprint: string
): T | null => {
  for (const run of runs) {
    for (const stepKey of stepKeys) {
      const step = run.steps.find((candidate) => candidate.stepKey === stepKey);
      if (
        isRecord(step?.details) &&
        step.details.policyVersion === policyVersion &&
        step.details.inputFingerprint === inputFingerprint &&
        step.details[field]
      ) {
        return step.details[field] as T;
      }
    }
  }
  return null;
};
