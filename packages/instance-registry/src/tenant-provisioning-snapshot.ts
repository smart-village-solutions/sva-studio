import type { InstanceProvisioningRun, InstanceRegistryRecord } from '@sva/core';

import type { CreateInstanceProvisioningInput } from './mutation-types.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';
import type {
  InstanceRegistryServiceDeps,
  ProvisioningPluginTenantLifecycleContract,
} from './service-types.js';

type PluginOidcClients = NonNullable<
  ReturnType<NonNullable<InstanceRegistryServiceDeps['readPluginOidcClientRequirements']>>
>;

const copyLifecycle = (lifecycle: ProvisioningPluginTenantLifecycleContract) => ({
  ...lifecycle,
  operations: lifecycle.operations.map((operation) => ({ ...operation })),
  readinessChecks: lifecycle.readinessChecks.map((check) => ({ ...check })),
});

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const lifecycleOperations = new Set([
  'provision',
  'reconcile',
  'suspend',
  'reactivate',
  'readiness',
]);
const repairOperations = new Set(['provision', 'reconcile', 'suspend', 'reactivate']);

const isLifecycleOperation = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.operation === 'string' &&
  lifecycleOperations.has(value.operation) &&
  typeof value.jobTypeId === 'string' &&
  value.jobTypeId.length > 0 &&
  (value.supportsCancellation === undefined || typeof value.supportsCancellation === 'boolean');

const isReadinessCheck = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.checkId === 'string' &&
  value.checkId.length > 0 &&
  typeof value.titleKey === 'string' &&
  value.titleKey.length > 0 &&
  typeof value.required === 'boolean' &&
  (value.repairOperation === undefined ||
    (typeof value.repairOperation === 'string' && repairOperations.has(value.repairOperation)));

const isLifecycleContract = (value: unknown): value is ProvisioningPluginTenantLifecycleContract =>
  isRecord(value) &&
  typeof value.pluginId === 'string' &&
  value.pluginId.length > 0 &&
  value.contractVersion === 1 &&
  typeof value.contractRevision === 'string' &&
  value.contractRevision.length > 0 &&
  Array.isArray(value.operations) &&
  value.operations.every(isLifecycleOperation) &&
  Array.isArray(value.readinessChecks) &&
  value.readinessChecks.every(isReadinessCheck);

const isPluginOidcClient = (value: unknown): value is PluginOidcClients[number] =>
  isRecord(value) &&
  typeof value.pluginId === 'string' &&
  typeof value.clientId === 'string' &&
  typeof value.audience === 'string' &&
  value.enabled === false &&
  (value.contractVersion === '1.0' ||
    (value.contractVersion === '2.0' &&
      Array.isArray(value.redirectUris) &&
      value.redirectUris.every((uri) => typeof uri === 'string') &&
      Array.isArray(value.webOrigins) &&
      value.webOrigins.every((origin) => typeof origin === 'string')));

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
  assignedModules: [...(instance.assignedModules ?? [])].sort(),
  featureFlags: instance.featureFlags,
  mainserverConfigRef: instance.mainserverConfigRef,
});

export const buildTenantProvisioningSnapshot = (
  instance: InstanceRegistryRecord,
  input: CreateInstanceProvisioningInput,
  payloadFingerprint: string,
  automationMode: 'external' | 'kassel-traefik-file' = 'external',
  pluginSnapshot: Readonly<{
    lifecycles: readonly ProvisioningPluginTenantLifecycleContract[];
    oidcClients: PluginOidcClients;
  }> = { lifecycles: [], oidcClients: [] }
) => ({
  ...registryConfiguration(instance),
  registryFingerprint: buildPayloadFingerprint(registryConfiguration(instance)),
  authClientSecretRequired: Boolean(input.authClientSecret?.trim()),
  tenantAdminClientSecretRequired: Boolean(input.tenantAdminClient?.secret?.trim()),
  automationMode,
  pluginSnapshotVersion: '1.0',
  pluginLifecycles: pluginSnapshot.lifecycles.map(copyLifecycle),
  pluginOidcClients: pluginSnapshot.oidcClients.map((client) => ({
    ...client,
    ...('redirectUris' in client ? { redirectUris: [...client.redirectUris] } : {}),
    ...('webOrigins' in client ? { webOrigins: [...client.webOrigins] } : {}),
  })),
  payloadFingerprint,
});

export const readTenantProvisioningPluginSnapshot = (
  run: InstanceProvisioningRun
): Readonly<{
  lifecycles: readonly ProvisioningPluginTenantLifecycleContract[];
  oidcClients: PluginOidcClients;
}> => {
  const snapshot = run.desiredSnapshot;
  if (
    snapshot.pluginSnapshotVersion !== '1.0' ||
    !Array.isArray(snapshot.pluginLifecycles) ||
    snapshot.pluginLifecycles.length === 0 ||
    !snapshot.pluginLifecycles.every(isLifecycleContract) ||
    new Set(snapshot.pluginLifecycles.map(({ pluginId }) => pluginId)).size !==
      snapshot.pluginLifecycles.length ||
    !Array.isArray(snapshot.pluginOidcClients) ||
    !snapshot.pluginOidcClients.every(isPluginOidcClient) ||
    new Set(snapshot.pluginOidcClients.map(({ clientId }) => clientId)).size !==
      snapshot.pluginOidcClients.length
  ) {
    throw new Error('provisioning_plugin_snapshot_missing');
  }
  return {
    lifecycles: snapshot.pluginLifecycles,
    oidcClients: snapshot.pluginOidcClients,
  };
};

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
  readTenantProvisioningPluginSnapshot(run);
};
