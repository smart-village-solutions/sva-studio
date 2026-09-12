import { buildPrimaryHostname, normalizeHost } from '@sva/core';
import type { InstanceRegistryRecord } from '@sva/core';

import type {
  CreateInstanceProvisioningInput,
  CreateInstanceProvisioningResult,
} from './mutation-types.js';
import { createReconcileModuleActivationPoliciesHandler } from './service-module-activation.js';
import {
  buildCreateInstancePayloadFingerprint,
  matchesPersistedCreateSecrets,
} from './service-instance-create-fingerprint.js';
import { toListItem } from './service-helpers.js';
import {
  DEFAULT_TENANT_ADMIN_CLIENT_ID,
  encryptAuthClientSecret,
  encryptTenantAdminClientSecret,
  invalidateHostWithLog,
} from './service-shared.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const assertIdempotentCreateRetry = async (
  deps: InstanceRegistryServiceDeps,
  input: CreateInstanceProvisioningInput,
  instance: InstanceRegistryRecord
) => {
  const matchingRun = (await deps.repository.listProvisioningRuns(input.instanceId)).find(
    (run) => run.operation === 'create' && run.idempotencyKey === input.idempotencyKey
  );
  if (!matchingRun) return null;
  if (
    !matchingRun.payloadFingerprint ||
    matchingRun.payloadFingerprint !== buildCreateInstancePayloadFingerprint(input) ||
    !(await matchesPersistedCreateSecrets(deps, input, instance))
  ) {
    throw new Error('idempotency_key_reuse');
  }
  return matchingRun;
};

export const resolveIdempotentCreateRetry = async (
  deps: InstanceRegistryServiceDeps,
  input: CreateInstanceProvisioningInput,
  instance: InstanceRegistryRecord
): Promise<CreateInstanceProvisioningResult | null> => {
  const matchingRun = await assertIdempotentCreateRetry(deps, input, instance);
  if (!matchingRun) return null;
  if (matchingRun.status !== 'failed' || matchingRun.snapshotVersion !== '2.0') {
    await createReconcileModuleActivationPoliciesHandler(deps, { forceIamSync: true })({
      instanceId: instance.instanceId,
      actorId: input.actorId,
      requestId: input.requestId,
    });
    invalidateHostWithLog(deps.invalidateHost, instance.primaryHostname, instance.instanceId);
    return { ok: true, instance: toListItem(instance) };
  }
  const retriedRun = await deps.repository.retryProvisioningRun({
    instanceId: instance.instanceId,
    idempotencyKey: input.idempotencyKey,
    actorId: input.actorId,
    requestId: input.requestId,
    deadlineAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  if (!retriedRun) throw new Error('provisioning_retry_conflict');
  const requestedInstance =
    (await deps.repository.setInstanceStatus({
      instanceId: instance.instanceId,
      status: 'requested',
      actorId: input.actorId,
      requestId: input.requestId,
    })) ?? instance;
  invalidateHostWithLog(
    deps.invalidateHost,
    requestedInstance.primaryHostname,
    requestedInstance.instanceId
  );
  return { ok: true, instance: toListItem(requestedInstance, retriedRun) };
};

const concurrentCreateRetryDelaysMs = [0, 25, 100, 400] as const;

export const resolveConcurrentIdempotentCreateRetry = async (
  deps: InstanceRegistryServiceDeps,
  input: CreateInstanceProvisioningInput,
  instance: InstanceRegistryRecord
): Promise<CreateInstanceProvisioningResult | null> => {
  for (const delayMs of concurrentCreateRetryDelaysMs) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const retry = await resolveIdempotentCreateRetry(deps, input, instance);
    if (retry) return retry;
  }
  return null;
};

export const createRequestedInstance = (
  deps: InstanceRegistryServiceDeps,
  input: CreateInstanceProvisioningInput
) => {
  const normalizedParentDomain = normalizeHost(input.parentDomain);
  const tenantAdminClient = input.tenantAdminClient ?? {
    clientId: DEFAULT_TENANT_ADMIN_CLIENT_ID,
  };
  return deps.repository.createInstance({
    instanceId: input.instanceId,
    displayName: input.displayName,
    status: 'requested',
    parentDomain: normalizedParentDomain,
    primaryHostname: buildPrimaryHostname(input.instanceId, normalizedParentDomain),
    realmMode: input.realmMode,
    authRealm: input.authRealm,
    authClientId: input.authClientId,
    authIssuerUrl: input.authIssuerUrl,
    authClientSecretCiphertext: encryptAuthClientSecret(
      deps,
      input.instanceId,
      input.authClientSecret
    ),
    tenantAdminClient: {
      clientId: tenantAdminClient.clientId,
      secretCiphertext: encryptTenantAdminClientSecret(
        deps,
        input.instanceId,
        tenantAdminClient.secret
      ),
    },
    tenantAdminBootstrap: input.tenantAdminBootstrap,
    actorId: input.actorId,
    requestId: input.requestId,
    themeKey: input.themeKey,
    featureFlags: input.featureFlags,
    mainserverConfigRef: input.mainserverConfigRef,
  });
};
