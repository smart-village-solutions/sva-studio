import { buildPrimaryHostname, canTransitionInstanceStatus, normalizeHost } from '@sva/core';
import type { InstanceRegistryRecord } from '@sva/core';

import type {
  CreateInstanceProvisioningInput,
  CreateInstanceProvisioningResult,
  UpdateInstanceInput,
} from './mutation-types.js';
import { createGetInstanceDetail } from './service-detail.js';
import { createStatusArtifacts, toListItem } from './service-helpers.js';
import { createProvisioningArtifacts } from './service-provisioning.js';
import { buildCreateInstancePayloadFingerprint } from './service-instance-create-fingerprint.js';
import {
  DEFAULT_TENANT_ADMIN_CLIENT_ID,
  encryptAuthClientSecret,
  encryptTenantAdminClientSecret,
  instanceRegistryServiceLogger,
  invalidateHostWithLog,
} from './service-shared.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';
import { createReconcileModuleActivationPoliciesHandler } from './service-module-activation.js';
import { annotateInstanceRegistryError, runInstanceRegistryStep } from './observability.js';

const assertIdempotentCreateRetry = async (
  deps: InstanceRegistryServiceDeps,
  input: CreateInstanceProvisioningInput
): Promise<boolean> => {
  const matchingRun = (await deps.repository.listProvisioningRuns(input.instanceId)).find(
    (run) => run.operation === 'create' && run.idempotencyKey === input.idempotencyKey
  );
  if (!matchingRun) {
    return false;
  }
  if (
    !matchingRun.payloadFingerprint ||
    matchingRun.payloadFingerprint !== buildCreateInstancePayloadFingerprint(input)
  ) {
    throw new Error('idempotency_key_reuse');
  }
  return true;
};

const resolveIdempotentCreateRetry = async (
  deps: InstanceRegistryServiceDeps,
  input: CreateInstanceProvisioningInput,
  instance: InstanceRegistryRecord
): Promise<CreateInstanceProvisioningResult | null> => {
  if (!(await assertIdempotentCreateRetry(deps, input))) {
    return null;
  }
  await createReconcileModuleActivationPoliciesHandler(deps, { forceIamSync: true })({
    instanceId: instance.instanceId,
    actorId: input.actorId,
    requestId: input.requestId,
  });
  invalidateHostWithLog(deps.invalidateHost, instance.primaryHostname, instance.instanceId);
  return { ok: true, instance: toListItem(instance) };
};

const concurrentCreateRetryDelaysMs = [0, 25, 100, 400] as const;

const resolveConcurrentIdempotentCreateRetry = async (
  deps: InstanceRegistryServiceDeps,
  input: CreateInstanceProvisioningInput,
  instance: InstanceRegistryRecord
): Promise<CreateInstanceProvisioningResult | null> => {
  for (const delayMs of concurrentCreateRetryDelaysMs) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const retry = await resolveIdempotentCreateRetry(deps, input, instance);
    if (retry) return retry;
  }
  return null;
};

export const createProvisioningRequestHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['createProvisioningRequest'] =>
  async (input: CreateInstanceProvisioningInput) => {
    instanceRegistryServiceLogger.info('instance_create_requested', {
      operation: 'create_instance',
      instance_id: input.instanceId,
      request_id: input.requestId,
      actor_id: input.actorId,
    });
    const existing = await runInstanceRegistryStep('registry_lookup', () =>
      deps.repository.getInstanceById(input.instanceId)
    );
    if (existing) {
      const retry = await resolveIdempotentCreateRetry(deps, input, existing);
      if (retry) return retry;
      instanceRegistryServiceLogger.warn('instance_create_rejected_duplicate', {
        operation: 'create_instance',
        instance_id: input.instanceId,
        request_id: input.requestId,
      });
      return { ok: false, reason: 'already_exists' as const };
    }

    const normalizedParentDomain = normalizeHost(input.parentDomain);
    const primaryHostname = buildPrimaryHostname(input.instanceId, normalizedParentDomain);
    const tenantAdminClient = input.tenantAdminClient ?? {
      clientId: DEFAULT_TENANT_ADMIN_CLIENT_ID,
    };
    const instance = await runInstanceRegistryStep('registry_insert', () =>
      deps.repository.createInstance({
        instanceId: input.instanceId,
        displayName: input.displayName,
        status: 'requested',
        parentDomain: normalizedParentDomain,
        primaryHostname,
        realmMode: input.realmMode,
        authRealm: input.authRealm,
        authClientId: input.authClientId,
        authIssuerUrl: input.authIssuerUrl,
        authClientSecretCiphertext: encryptAuthClientSecret(
          deps,
          input.instanceId,
          input.authClientSecret
        ),
        tenantAdminClient: tenantAdminClient
          ? {
              clientId: tenantAdminClient.clientId,
              secretCiphertext: encryptTenantAdminClientSecret(
                deps,
                input.instanceId,
                tenantAdminClient.secret
              ),
            }
          : undefined,
        tenantAdminBootstrap: input.tenantAdminBootstrap,
        actorId: input.actorId,
        requestId: input.requestId,
        themeKey: input.themeKey,
        featureFlags: input.featureFlags,
        mainserverConfigRef: input.mainserverConfigRef,
      })
    );
    if (!instance) {
      const concurrentInstance = await runInstanceRegistryStep('registry_lookup', () =>
        deps.repository.getInstanceById(input.instanceId)
      );
      if (concurrentInstance) {
        const retry = await resolveConcurrentIdempotentCreateRetry(deps, input, concurrentInstance);
        if (retry) return retry;
      }
      instanceRegistryServiceLogger.warn('instance_create_rejected_duplicate', {
        operation: 'create_instance',
        instance_id: input.instanceId,
        request_id: input.requestId,
      });
      return { ok: false, reason: 'already_exists' as const };
    }

    await createProvisioningArtifacts(deps.repository, instance, input);
    await createReconcileModuleActivationPoliciesHandler(deps)({
      instanceId: instance.instanceId,
      actorId: input.actorId,
      requestId: input.requestId,
    });
    try {
      invalidateHostWithLog(deps.invalidateHost, instance.primaryHostname, instance.instanceId);
    } catch (error) {
      throw annotateInstanceRegistryError(error, 'host_cache_invalidate');
    }
    instanceRegistryServiceLogger.info('instance_create_completed', {
      operation: 'create_instance',
      instance_id: instance.instanceId,
      status: instance.status,
      request_id: input.requestId,
    });
    const reconciledInstance =
      (await deps.repository.getInstanceById(instance.instanceId)) ?? instance;
    return { ok: true, instance: toListItem(reconciledInstance) };
  };

export const createChangeStatusHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['changeStatus'] =>
  async (input) => {
    const current = await deps.repository.getInstanceById(input.instanceId);
    if (!current) {
      return { ok: false, reason: 'not_found' as const };
    }

    if (!canTransitionInstanceStatus(current.status, input.nextStatus)) {
      instanceRegistryServiceLogger.warn('instance_status_transition_rejected', {
        operation: 'change_instance_status',
        instance_id: input.instanceId,
        current_status: current.status,
        next_status: input.nextStatus,
        request_id: input.requestId,
      });
      return { ok: false, reason: 'invalid_transition' as const, currentStatus: current.status };
    }

    const updated = await deps.repository.setInstanceStatus({
      instanceId: input.instanceId,
      status: input.nextStatus,
      actorId: input.actorId,
      requestId: input.requestId,
    });
    if (!updated) {
      return { ok: false, reason: 'not_found' as const };
    }

    await createStatusArtifacts(deps.repository, input, current.status);
    invalidateHostWithLog(deps.invalidateHost, updated.primaryHostname, updated.instanceId);
    instanceRegistryServiceLogger.info('instance_status_transition_completed', {
      operation: 'change_instance_status',
      instance_id: updated.instanceId,
      previous_status: current.status,
      next_status: updated.status,
      request_id: input.requestId,
    });
    return { ok: true, instance: toListItem(updated) };
  };

export const createUpdateInstanceHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['updateInstance'] =>
  async (input: UpdateInstanceInput) => {
    instanceRegistryServiceLogger.info('instance_update_started', {
      operation: 'update_instance',
      instance_id: input.instanceId,
      request_id: input.requestId,
      actor_id: input.actorId,
    });
    const existing = await deps.repository.getInstanceById(input.instanceId);
    if (!existing) {
      return null;
    }

    const normalizedParentDomain = normalizeHost(input.parentDomain);
    const primaryHostname = buildPrimaryHostname(input.instanceId, normalizedParentDomain);
    const updated = await deps.repository.updateInstance({
      instanceId: input.instanceId,
      displayName: input.displayName,
      parentDomain: normalizedParentDomain,
      primaryHostname,
      realmMode: input.realmMode,
      authRealm: input.authRealm,
      authClientId: input.authClientId,
      authIssuerUrl: input.authIssuerUrl,
      authClientSecretCiphertext: encryptAuthClientSecret(
        deps,
        input.instanceId,
        input.authClientSecret
      ),
      keepExistingAuthClientSecret: !input.authClientSecret?.trim(),
      tenantAdminClient: input.tenantAdminClient
        ? {
            clientId: input.tenantAdminClient.clientId,
            secretCiphertext: encryptTenantAdminClientSecret(
              deps,
              input.instanceId,
              input.tenantAdminClient.secret
            ),
          }
        : undefined,
      keepExistingTenantAdminClientSecret: !input.tenantAdminClient?.secret?.trim(),
      tenantAdminBootstrap: input.tenantAdminBootstrap,
      actorId: input.actorId,
      requestId: input.requestId,
      themeKey: input.themeKey,
      featureFlags: input.featureFlags,
      mainserverConfigRef: input.mainserverConfigRef,
    });
    if (!updated) {
      return null;
    }

    invalidateHostWithLog(deps.invalidateHost, existing.primaryHostname, updated.instanceId);
    invalidateHostWithLog(deps.invalidateHost, updated.primaryHostname, updated.instanceId);

    instanceRegistryServiceLogger.info('instance_update_completed', {
      operation: 'update_instance',
      instance_id: updated.instanceId,
      request_id: input.requestId,
      previous_hostname: existing.primaryHostname,
      next_hostname: updated.primaryHostname,
    });
    return createGetInstanceDetail(deps)(updated.instanceId);
  };
