import { buildPrimaryHostname, normalizeHost } from '@sva/core';
import type { InstanceRegistryRecord } from '@sva/core';

import type {
  CreateInstanceProvisioningInput,
  CreateInstanceProvisioningResult,
  RetryTenantProvisioningInput,
} from './mutation-types.js';
import { createReconcileModuleActivationPoliciesHandler } from './service-module-activation.js';
import {
  buildCreateInstancePayloadFingerprint,
  matchesPersistedCreateSecrets,
} from './service-instance-create-fingerprint.js';
import { toListItem } from './service-helpers.js';
import {
  reserveAndPrepareProvisioningRetry,
  retryReservedProvisioningRun,
} from './service-instance-retry.js';
import {
  DEFAULT_TENANT_ADMIN_CLIENT_ID,
  encryptAuthClientSecret,
  encryptTenantAdminClientSecret,
  invalidateHostWithLog,
} from './service-shared.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { createAssignModuleHandler } from './service-module-mutations.js';
import {
  isTenantProvisioningFailureRetryable,
  requiresAutomatedProvisioningEvidence,
  shouldExposeAutomatedProvisioning,
} from './service-active-provisioning.js';

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
    const automatedRun = requiresAutomatedProvisioningEvidence(matchingRun)
      ? matchingRun
      : undefined;
    return { ok: true, instance: toListItem(instance, automatedRun) };
  }
  if (instance.status !== 'failed') {
    throw new Error('provisioning_retry_instance_status_invalid');
  }
  if (
    matchingRun.desiredSnapshot.automationMode !== 'kassel-traefik-file' ||
    !shouldExposeAutomatedProvisioning(deps, instance)
  ) {
    throw new Error('provisioning_retry_mode_invalid');
  }
  if (!isTenantProvisioningFailureRetryable(matchingRun)) {
    throw new Error('provisioning_retry_not_safe');
  }
  const { desiredSnapshot, keycloakReconcileRequired, leaseOwner } =
    await reserveAndPrepareProvisioningRetry(deps, matchingRun, input);
  const retriedRun = await retryReservedProvisioningRun(deps, {
    instanceId: instance.instanceId,
    idempotencyKey: input.idempotencyKey,
    leaseOwner,
    actorId: input.actorId,
    requestId: input.requestId,
    deadlineAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    desiredSnapshot,
    keycloakReconcileRequired,
  });
  const resumedStatus = retriedRun.stepKey === 'registry' ? 'requested' : 'provisioning';
  const requestedInstance =
    (await deps.repository.setInstanceStatus({
      instanceId: instance.instanceId,
      status: resumedStatus,
      actorId: input.actorId,
      requestId: input.requestId,
    })) ?? instance;
  invalidateHostWithLog(
    deps.invalidateHost,
    requestedInstance.primaryHostname,
    requestedInstance.instanceId
  );
  return {
    ok: true,
    instance: toListItem(
      requestedInstance,
      shouldExposeAutomatedProvisioning(deps, requestedInstance) ? retriedRun : undefined
    ),
  };
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

export const createRetryTenantProvisioningHandler =
  (deps: InstanceRegistryServiceDeps) => async (input: RetryTenantProvisioningInput) => {
    const instance = await deps.repository.getInstanceById(input.instanceId);
    if (!instance) return null;

    const latestCreateRun = (await deps.repository.listProvisioningRuns(input.instanceId)).find(
      (run) => run.operation === 'create'
    );
    if (
      !latestCreateRun ||
      latestCreateRun.snapshotVersion !== '2.0' ||
      latestCreateRun.desiredSnapshot.automationMode !== 'kassel-traefik-file' ||
      !shouldExposeAutomatedProvisioning(deps, instance)
    ) {
      throw new Error('provisioning_retry_mode_invalid');
    }
    if (
      (latestCreateRun.status === 'requested' || latestCreateRun.status === 'provisioning') &&
      (instance.status === 'requested' || instance.status === 'provisioning')
    ) {
      return toListItem(instance, latestCreateRun);
    }
    if (latestCreateRun.status !== 'failed' || instance.status !== 'failed') {
      throw new Error('provisioning_retry_instance_status_invalid');
    }
    if (!isTenantProvisioningFailureRetryable(latestCreateRun)) {
      throw new Error('provisioning_retry_not_safe');
    }

    const { desiredSnapshot, keycloakReconcileRequired, leaseOwner } =
      await reserveAndPrepareProvisioningRetry(deps, latestCreateRun, input);
    const retriedRun = await retryReservedProvisioningRun(deps, {
      instanceId: instance.instanceId,
      idempotencyKey: latestCreateRun.idempotencyKey,
      leaseOwner,
      actorId: input.actorId,
      requestId: input.requestId,
      deadlineAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      desiredSnapshot,
      keycloakReconcileRequired,
    });
    const resumedStatus = retriedRun.stepKey === 'registry' ? 'requested' : 'provisioning';
    const requestedInstance = await deps.repository.setInstanceStatus({
      instanceId: instance.instanceId,
      status: resumedStatus,
      actorId: input.actorId,
      requestId: input.requestId,
    });
    if (!requestedInstance) throw new Error('provisioning_retry_conflict');

    invalidateHostWithLog(
      deps.invalidateHost,
      requestedInstance.primaryHostname,
      requestedInstance.instanceId
    );
    return toListItem(requestedInstance, retriedRun);
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

export const assignRequestedCreateModules = async (
  deps: InstanceRegistryServiceDeps,
  input: CreateInstanceProvisioningInput,
  instance: NonNullable<Awaited<ReturnType<typeof createRequestedInstance>>>
) => {
  const requestedModuleIds = [...new Set(input.moduleIds ?? [])];
  for (const moduleId of requestedModuleIds) {
    const assignment = await createAssignModuleHandler(deps)({
      instanceId: instance.instanceId,
      moduleId,
      idempotencyKey: `${input.idempotencyKey}:module:${moduleId}`,
      actorId: input.actorId,
      requestId: input.requestId,
    });
    if (!assignment.ok) {
      throw new Error(`instance_create_module_assignment_failed:${moduleId}:${assignment.reason}`);
    }
  }
  return requestedModuleIds.length > 0
    ? ((await deps.repository.getInstanceById(instance.instanceId)) ?? instance)
    : instance;
};
