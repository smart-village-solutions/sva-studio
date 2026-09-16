import {
  buildPrimaryHostname,
  canTransitionInstanceStatus,
  isValidInstanceId,
  normalizeHost,
} from '@sva/core';

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
import { syncProtectedSystemAdminPermissions } from './service-module-mutations.js';
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
import { isValidKeycloakRealmName, KEYCLOAK_REALM_BASELINE } from './keycloak-realm-baseline.js';

const assertValidInstanceId = (input: { instanceId: string; realmMode: string }): void => {
  if (!isValidInstanceId(input.instanceId)) {
    throw new Error(
      input.realmMode === 'new' ? 'invalid_new_realm_instance_id' : 'invalid_instance_id'
    );
  }
};

function applyNewRealmDefaults(
  input: CreateInstanceProvisioningInput
): CreateInstanceProvisioningInput;
function applyNewRealmDefaults(input: UpdateInstanceInput): UpdateInstanceInput;
function applyNewRealmDefaults(
  input: CreateInstanceProvisioningInput | UpdateInstanceInput
): CreateInstanceProvisioningInput | UpdateInstanceInput {
  if (input.realmMode !== 'new') return input;
  if (!isValidKeycloakRealmName(input.instanceId)) {
    throw new Error('invalid_new_realm_instance_id');
  }
  return {
    ...input,
    authRealm: input.instanceId,
    authClientId: KEYCLOAK_REALM_BASELINE.loginClientId,
    tenantAdminClient: {
      ...input.tenantAdminClient,
      clientId: KEYCLOAK_REALM_BASELINE.tenantAdminClientId,
    },
  };
}

export const createProvisioningRequestHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['createProvisioningRequest'] =>
  async (input: CreateInstanceProvisioningInput) => {
    assertValidInstanceId(input);
    const normalizedInput = applyNewRealmDefaults(input);
    const authIssuerUrl = deps.resolveProvisioningAuthIssuerUrl?.({
      parentDomain: normalizedInput.parentDomain,
      authRealm: normalizedInput.authRealm,
      authIssuerUrl:
        normalizedInput.realmMode === 'new' ? undefined : normalizedInput.authIssuerUrl,
    });
    const effectiveInput = authIssuerUrl ? { ...normalizedInput, authIssuerUrl } : normalizedInput;
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

    await syncProtectedSystemAdminPermissions(deps, instance.instanceId);
    await createReconcileModuleActivationPoliciesHandler(deps, { forceIamSync: true })({
      instanceId: instance.instanceId,
      actorId: effectiveInput.actorId,
      requestId: effectiveInput.requestId,
    });
    const reconciledInstance =
      (await deps.repository.getInstanceById(instance.instanceId)) ?? instance;
    const automated = shouldExposeAutomatedProvisioning(deps, reconciledInstance);
    const provisioningRun = await createProvisioningArtifacts(
      deps,
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
    assertValidInstanceId(input);
    const effectiveInput = applyNewRealmDefaults(input);
    assertOidcClientIdsNotReserved(deps, effectiveInput);
    instanceRegistryServiceLogger.info('instance_update_started', {
      operation: 'update_instance',
      instance_id: effectiveInput.instanceId,
      request_id: effectiveInput.requestId,
      actor_id: effectiveInput.actorId,
    });
    const existing = await deps.repository.getInstanceById(effectiveInput.instanceId);
    if (!existing) {
      return null;
    }
    await assertNoActiveTenantProvisioning(deps.repository, effectiveInput.instanceId);
    const enteringNewRealm = existing.realmMode !== 'new' && effectiveInput.realmMode === 'new';
    const normalizedParentDomain = normalizeHost(effectiveInput.parentDomain);
    const authIssuerUrl = deps.resolveProvisioningAuthIssuerUrl?.({
      parentDomain: normalizedParentDomain,
      authRealm: effectiveInput.authRealm,
      authIssuerUrl: effectiveInput.realmMode === 'new' ? undefined : effectiveInput.authIssuerUrl,
    });
    const primaryHostname =
      normalizeHost(existing.parentDomain) === normalizedParentDomain
        ? existing.primaryHostname
        : buildPrimaryHostname(effectiveInput.instanceId, normalizedParentDomain);
    assertTenantHostnameAvailable(deps, primaryHostname);
    const updated = await deps.repository.updateInstance({
      instanceId: effectiveInput.instanceId,
      displayName: effectiveInput.displayName,
      parentDomain: normalizedParentDomain,
      primaryHostname,
      realmMode: effectiveInput.realmMode,
      authRealm: effectiveInput.authRealm,
      authClientId: effectiveInput.authClientId,
      authIssuerUrl: authIssuerUrl ?? effectiveInput.authIssuerUrl,
      authClientSecretCiphertext: encryptAuthClientSecret(
        deps,
        effectiveInput.instanceId,
        effectiveInput.authClientSecret
      ),
      keepExistingAuthClientSecret: !enteringNewRealm && !effectiveInput.authClientSecret?.trim(),
      tenantAdminClient: effectiveInput.tenantAdminClient
        ? {
            clientId: effectiveInput.tenantAdminClient.clientId,
            secretCiphertext: encryptTenantAdminClientSecret(
              deps,
              effectiveInput.instanceId,
              effectiveInput.tenantAdminClient.secret
            ),
          }
        : undefined,
      keepExistingTenantAdminClientSecret:
        !enteringNewRealm && !effectiveInput.tenantAdminClient?.secret?.trim(),
      tenantAdminBootstrap: effectiveInput.tenantAdminBootstrap ?? existing.tenantAdminBootstrap,
      actorId: effectiveInput.actorId,
      requestId: effectiveInput.requestId,
      themeKey: effectiveInput.themeKey,
      featureFlags: effectiveInput.featureFlags,
      mainserverConfigRef: effectiveInput.mainserverConfigRef,
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
