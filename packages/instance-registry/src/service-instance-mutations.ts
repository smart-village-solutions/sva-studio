import { buildPrimaryHostname, canTransitionInstanceStatus, normalizeHost } from '@sva/core';

import type { CreateInstanceProvisioningInput, UpdateInstanceInput } from './mutation-types.js';
import { createGetInstanceDetail } from './service-detail.js';
import { createStatusArtifacts, toListItem } from './service-helpers.js';
import { createProvisioningArtifacts } from './service-provisioning.js';
import {
  encryptAuthClientSecret,
  encryptTenantAdminClientSecret,
  instanceRegistryServiceLogger,
  invalidateHostWithLog,
} from './service-shared.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';
import { createReconcileModuleActivationPoliciesHandler } from './service-module-activation.js';
import {
  assertOidcClientIdsNotReserved,
  assertTenantHostnameAvailable,
} from './service-reservations.js';
import { annotateInstanceRegistryError, runInstanceRegistryStep } from './observability.js';
import {
  assertNoActiveTenantProvisioning,
  shouldExposeAutomatedProvisioning,
} from './service-active-provisioning.js';
import {
  createRequestedInstance,
  resolveConcurrentIdempotentCreateRetry,
  resolveIdempotentCreateRetry,
} from './service-instance-create.js';

export const createProvisioningRequestHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['createProvisioningRequest'] =>
  async (input: CreateInstanceProvisioningInput) => {
    const authIssuerUrl = deps.resolveProvisioningAuthIssuerUrl?.({
      parentDomain: input.parentDomain,
      authRealm: input.authRealm,
      authIssuerUrl: input.authIssuerUrl,
    });
    const effectiveInput = authIssuerUrl ? { ...input, authIssuerUrl } : input;
    assertOidcClientIdsNotReserved(deps, effectiveInput);
    assertTenantHostnameAvailable(
      deps,
      buildPrimaryHostname(effectiveInput.instanceId, effectiveInput.parentDomain)
    );
    instanceRegistryServiceLogger.info('instance_create_requested', {
      operation: 'create_instance',
      instance_id: effectiveInput.instanceId,
      request_id: effectiveInput.requestId,
      actor_id: effectiveInput.actorId,
    });
    const existing = await runInstanceRegistryStep('registry_lookup', () =>
      deps.repository.getInstanceById(effectiveInput.instanceId)
    );
    if (existing) {
      const retry = await resolveIdempotentCreateRetry(deps, effectiveInput, existing);
      if (retry) return retry;
      instanceRegistryServiceLogger.warn('instance_create_rejected_duplicate', {
        operation: 'create_instance',
        instance_id: effectiveInput.instanceId,
        request_id: effectiveInput.requestId,
      });
      return { ok: false, reason: 'already_exists' as const };
    }

    const instance = await runInstanceRegistryStep('registry_insert', () =>
      createRequestedInstance(deps, effectiveInput)
    );
    if (!instance) {
      const concurrentInstance = await runInstanceRegistryStep('registry_lookup', () =>
        deps.repository.getInstanceById(effectiveInput.instanceId)
      );
      if (concurrentInstance) {
        const retry = await resolveConcurrentIdempotentCreateRetry(
          deps,
          effectiveInput,
          concurrentInstance
        );
        if (retry) return retry;
      }
      instanceRegistryServiceLogger.warn('instance_create_rejected_duplicate', {
        operation: 'create_instance',
        instance_id: effectiveInput.instanceId,
        request_id: effectiveInput.requestId,
      });
      return { ok: false, reason: 'already_exists' as const };
    }

    await createReconcileModuleActivationPoliciesHandler(deps)({
      instanceId: instance.instanceId,
      actorId: effectiveInput.actorId,
      requestId: effectiveInput.requestId,
    });
    const reconciledInstance =
      (await deps.repository.getInstanceById(instance.instanceId)) ?? instance;
    const automated = shouldExposeAutomatedProvisioning(deps, reconciledInstance);
    const provisioningRun = await createProvisioningArtifacts(
      deps.repository,
      reconciledInstance,
      effectiveInput,
      automated ? 'kassel-traefik-file' : 'external'
    );
    try {
      invalidateHostWithLog(deps.invalidateHost, instance.primaryHostname, instance.instanceId);
    } catch (error) {
      throw annotateInstanceRegistryError(error, 'host_cache_invalidate');
    }
    instanceRegistryServiceLogger.info('instance_create_completed', {
      operation: 'create_instance',
      instance_id: instance.instanceId,
      status: instance.status,
      request_id: effectiveInput.requestId,
    });
    return {
      ok: true,
      instance: toListItem(reconciledInstance, automated ? provisioningRun : undefined),
    };
  };

export const createChangeStatusHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['changeStatus'] =>
  async (input) => {
    const current = await deps.repository.getInstanceById(input.instanceId);
    if (!current) {
      return { ok: false, reason: 'not_found' as const };
    }
    await assertNoActiveTenantProvisioning(deps.repository, input.instanceId);

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
    assertOidcClientIdsNotReserved(deps, input);
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
    await assertNoActiveTenantProvisioning(deps.repository, input.instanceId);
    const normalizedParentDomain = normalizeHost(input.parentDomain);
    const authIssuerUrl = deps.resolveProvisioningAuthIssuerUrl?.({
      parentDomain: normalizedParentDomain,
      authRealm: input.authRealm,
      authIssuerUrl: input.authIssuerUrl,
    });
    const primaryHostname =
      normalizeHost(existing.parentDomain) === normalizedParentDomain
        ? existing.primaryHostname
        : buildPrimaryHostname(input.instanceId, normalizedParentDomain);
    assertTenantHostnameAvailable(deps, primaryHostname);
    const updated = await deps.repository.updateInstance({
      instanceId: input.instanceId,
      displayName: input.displayName,
      parentDomain: normalizedParentDomain,
      primaryHostname,
      realmMode: input.realmMode,
      authRealm: input.authRealm,
      authClientId: input.authClientId,
      authIssuerUrl: authIssuerUrl ?? input.authIssuerUrl,
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
      tenantAdminBootstrap: input.tenantAdminBootstrap ?? existing.tenantAdminBootstrap,
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
