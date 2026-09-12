import type { InstanceProvisioningRun, InstanceRegistryRecord } from '@sva/core';

import type { CreateInstanceProvisioningInput } from './mutation-types.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';

const registryConfiguration = (instance: InstanceRegistryRecord) => ({
  instanceId: instance.instanceId,
  displayName: instance.displayName,
  parentDomain: instance.parentDomain,
  primaryHostname: instance.primaryHostname,
  realmMode: instance.realmMode,
  authRealm: instance.authRealm,
  authClientId: instance.authClientId,
  authIssuerUrl: instance.authIssuerUrl,
  tenantAdminClientId: instance.tenantAdminClient?.clientId,
  tenantAdminBootstrap: instance.tenantAdminBootstrap,
  themeKey: instance.themeKey,
  assignedModules: [...instance.assignedModules].sort(),
  featureFlags: instance.featureFlags,
  mainserverConfigRef: instance.mainserverConfigRef,
});

export const buildTenantProvisioningSnapshot = (
  instance: InstanceRegistryRecord,
  input: CreateInstanceProvisioningInput,
  payloadFingerprint: string,
  automationMode: 'external' | 'kassel-traefik-file' = 'external'
) => ({
  ...registryConfiguration(instance),
  registryFingerprint: buildPayloadFingerprint(registryConfiguration(instance)),
  authClientSecretRequired: Boolean(input.authClientSecret?.trim()),
  tenantAdminClientSecretRequired: Boolean(input.tenantAdminClient?.secret?.trim()),
  automationMode,
  payloadFingerprint,
});

export const assertTenantProvisioningSnapshotCurrent = (
  run: InstanceProvisioningRun,
  instance: InstanceRegistryRecord
): void => {
  const snapshot = run.desiredSnapshot;
  const expectedRealmTransition =
    snapshot.realmMode === 'new' &&
    instance.realmMode === 'existing' &&
    typeof run.childKeycloakRunId === 'string';
  const fingerprintInput = expectedRealmTransition
    ? { ...instance, realmMode: 'new' as const }
    : instance;
  const registryFingerprint = buildPayloadFingerprint(registryConfiguration(fingerprintInput));
  const secretRequirementsMet =
    (snapshot.authClientSecretRequired !== true || instance.authClientSecretConfigured) &&
    (snapshot.tenantAdminClientSecretRequired !== true ||
      instance.tenantAdminClient?.secretConfigured === true);
  if (
    run.snapshotVersion !== '2.0' ||
    snapshot.automationMode !== 'kassel-traefik-file' ||
    snapshot.registryFingerprint !== registryFingerprint ||
    snapshot.payloadFingerprint !== run.payloadFingerprint ||
    !secretRequirementsMet
  ) {
    throw new Error('provisioning_snapshot_drift');
  }
};
