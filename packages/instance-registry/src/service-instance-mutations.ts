import { buildPrimaryHostname, canTransitionInstanceStatus, normalizeHost } from '@sva/core';

import type { CreateInstanceProvisioningInput, UpdateInstanceInput } from './mutation-types.js';
import { createGetInstanceDetail } from './service-detail.js';
import {
  applyAccountInvitationTemplateMutation,
  validateAccountInvitationTemplateMutation,
} from './service-account-invitation-template.js';
import { createStatusArtifacts, toListItem } from './service-helpers.js';
import { createProvisioningArtifacts } from './service-provisioning.js';
import {
  encryptAuthClientSecret,
  encryptTenantAdminClientSecret,
  instanceRegistryServiceLogger,
  invalidateHostWithLog,
  requireModuleIamRegistry,
} from './service-shared.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';
import {
  assertOidcClientIdsNotReserved,
  assertTenantHostnameAvailable,
  assertValidInstanceId,
} from './service-reservations.js';
import { annotateInstanceRegistryError, runInstanceRegistryStep } from './observability.js';
import {
  assertNoActiveTenantProvisioning,
  shouldExposeAutomatedProvisioning,
} from './service-active-provisioning.js';
import {
  assignRequestedCreateModules,
  createRequestedInstance,
  resolveConcurrentIdempotentCreateRetry as resolveConcurrentRetry,
  resolveIdempotentCreateRetry,
} from './service-instance-create.js';
import {
  collectActivationReadinessBlockers,
  createDraftReadinessHandler,
} from './service-draft-readiness.js';
import { isValidKeycloakRealmName, KEYCLOAK_REALM_BASELINE } from './keycloak-realm-baseline.js';

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
    const requestedModuleIds = [...new Set(effectiveInput.moduleIds ?? [])];
    if (requestedModuleIds.length > 0) {
      const moduleRegistry = requireModuleIamRegistry(deps);
      const unknownModuleId = requestedModuleIds.find((moduleId) => !moduleRegistry.has(moduleId));
      if (unknownModuleId) throw new Error(`unknown_module_contract:${unknownModuleId}`);
    }
    assertTenantHostnameAvailable(
      deps,
      buildPrimaryHostname(effectiveInput.instanceId, effectiveInput.parentDomain)
    );
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
    const readiness = await createDraftReadinessHandler(deps)(effectiveInput);
    if (readiness.createBlockers.length > 0) {
      const concurrentInstance = await runInstanceRegistryStep('registry_lookup', () =>
        deps.repository.getInstanceById(effectiveInput.instanceId)
      );
      if (concurrentInstance) {
        const retry = await resolveConcurrentRetry(deps, effectiveInput, concurrentInstance);
        if (retry) return retry;
      }
      throw new Error(
        `keycloak_create_readiness_blocked:${readiness.createBlockers.map((blocker) => blocker.checkKey).join(',')}`
      );
    }
    instanceRegistryServiceLogger.info('instance_create_requested', {
      operation: 'create_instance',
      instance_id: effectiveInput.instanceId,
      request_id: effectiveInput.requestId,
      actor_id: effectiveInput.actorId,
    });
    let instance = await runInstanceRegistryStep('registry_insert', () =>
      createRequestedInstance(deps, effectiveInput)
    );
    if (!instance) {
      const concurrentInstance = await runInstanceRegistryStep('registry_lookup', () =>
        deps.repository.getInstanceById(effectiveInput.instanceId)
      );
      if (concurrentInstance) {
        const retry = await resolveConcurrentRetry(deps, effectiveInput, concurrentInstance);
        if (retry) return retry;
      }
      instanceRegistryServiceLogger.warn('instance_create_rejected_duplicate', {
        operation: 'create_instance',
        instance_id: effectiveInput.instanceId,
        request_id: effectiveInput.requestId,
      });
      return { ok: false, reason: 'already_exists' as const };
    }

    instance = await assignRequestedCreateModules(deps, effectiveInput, instance);

    const automated = shouldExposeAutomatedProvisioning(deps, instance);
    const provisioningRun = await createProvisioningArtifacts(
      deps,
      instance,
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
      instance: toListItem(instance, automated ? provisioningRun : undefined),
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

    if (input.nextStatus === 'active' && current.status !== 'active') {
      const detail = await createGetInstanceDetail(deps)(input.instanceId);
      if (!detail) return { ok: false, reason: 'not_found' as const };
      const blockers = await collectActivationReadinessBlockers(deps, detail);
      if (blockers.length > 0) {
        throw new Error(`activation_readiness_blocked:${blockers.join(',')}`);
      }
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
    validateAccountInvitationTemplateMutation(effectiveInput, existing);
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

    const invitationUpdated = await applyAccountInvitationTemplateMutation({
      repository: deps.repository,
      mutation: effectiveInput,
      updated,
    });
    if (!invitationUpdated) return null;

    invalidateHostWithLog(deps.invalidateHost, existing.primaryHostname, updated.instanceId);
    invalidateHostWithLog(deps.invalidateHost, updated.primaryHostname, updated.instanceId);

    instanceRegistryServiceLogger.info('instance_update_completed', {
      operation: 'update_instance',
      instance_id: updated.instanceId,
      request_id: input.requestId,
      previous_hostname: existing.primaryHostname,
      next_hostname: updated.primaryHostname,
      ...(effectiveInput.accountInvitationTemplate !== undefined
        ? {
            account_invitation_template_revision:
              (effectiveInput.accountInvitationTemplateRevision ?? 0) + 1,
            account_invitation_template_operation: effectiveInput.accountInvitationTemplate
              ? 'set'
              : 'reset',
          }
        : {}),
    });
    return createGetInstanceDetail(deps)(updated.instanceId);
  };
