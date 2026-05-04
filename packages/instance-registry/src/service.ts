import { buildPrimaryHostname, canTransitionInstanceStatus, isTrafficEnabledInstanceStatus, normalizeHost } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type { CreateInstanceProvisioningInput, UpdateInstanceInput } from './mutation-types.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';
import { buildTenantIamStatus, createStatusArtifacts, toListItem } from './service-helpers.js';
import { createGetInstanceDetail } from './service-detail.js';
import {
  createExecuteKeycloakProvisioningHandler,
  createGetKeycloakPreflightHandler,
  createGetKeycloakProvisioningRunHandler,
  createGetKeycloakStatusHandler,
  createPlanKeycloakProvisioningHandler,
  createReconcileKeycloakHandler,
  createRuntimeResolver,
} from './service-keycloak.js';
import { createProvisioningArtifacts } from './service-provisioning.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-service', level: 'info' });

const invalidateHostWithLog = (
  invalidateHost: InstanceRegistryServiceDeps['invalidateHost'],
  hostname: string,
  instanceId: string
): void => {
  invalidateHost(hostname);
  logger.debug('instance_host_cache_invalidated', {
    operation: 'invalidate_host',
    instance_id: instanceId,
    hostname,
  });
};

const protectSecret = (deps: InstanceRegistryServiceDeps, value: string, aad: string): string | undefined => {
  if (!deps.protectSecret) {
    throw new Error('dependency_missing_protectSecret');
  }
  return deps.protectSecret(value, aad) ?? undefined;
};

const encryptAuthClientSecret = (
  deps: InstanceRegistryServiceDeps,
  instanceId: string,
  secret: string | undefined
): string | undefined => {
  const normalizedSecret = secret?.trim();
  if (!normalizedSecret) {
    return undefined;
  }
  return protectSecret(deps, normalizedSecret, `iam.instances.auth_client_secret:${instanceId}`);
};

const encryptTenantAdminClientSecret = (
  deps: InstanceRegistryServiceDeps,
  instanceId: string,
  secret: string | undefined
): string | undefined => {
  const normalizedSecret = secret?.trim();
  if (!normalizedSecret) {
    return undefined;
  }
  return protectSecret(deps, normalizedSecret, `iam.instances.tenant_admin_client_secret:${instanceId}`);
};

const createListInstances =
  (repository: InstanceRegistryRepository): InstanceRegistryService['listInstances'] =>
  async (input = {}) => {
    const instances = await repository.listInstances(input);
    const latestProvisioningRuns = await repository.listLatestProvisioningRuns(
      instances.map((instance) => instance.instanceId)
    );

    return instances.map((instance) => toListItem(instance, latestProvisioningRuns[instance.instanceId]));
  };

const requireModuleIamRegistry = (deps: InstanceRegistryServiceDeps) => deps.moduleIamRegistry ?? new Map();

const resolveAssignedModuleContracts = (
  deps: InstanceRegistryServiceDeps,
  assignedModuleIds: readonly string[]
) => {
  const registry = requireModuleIamRegistry(deps);

  return assignedModuleIds.map((moduleId) => {
    const contract = registry.get(moduleId);
    if (!contract) {
      throw new Error(`unknown_module_contract:${moduleId}`);
    }
    return contract;
  });
};

const invalidateInstancePermissionSnapshots = async (
  deps: InstanceRegistryServiceDeps,
  instanceId: string,
  trigger: string
): Promise<void> => {
  await deps.invalidatePermissionSnapshots?.({ instanceId, trigger });
};

const createModuleAssignRollbackError = (syncError: unknown, rollbackError: unknown): Error => {
  const message =
    syncError instanceof Error ? syncError.message : typeof syncError === 'string' ? syncError : 'instance_module_sync_failed';
  const combined = new Error(message, {
    cause: {
      syncError,
      rollbackError,
    },
  });
  combined.name = 'InstanceModuleAssignRollbackError';
  return combined;
};

const createAssignModuleHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['assignModule'] =>
  async (input) => {
    const instance = await deps.repository.getInstanceById(input.instanceId);
    if (!instance) {
      return { ok: false, reason: 'not_found' };
    }

    const registry = requireModuleIamRegistry(deps);
    if (!registry.has(input.moduleId)) {
      return { ok: false, reason: 'unknown_module' };
    }

    const inserted = await deps.repository.assignModule(input.instanceId, input.moduleId);
    if (!inserted) {
      return { ok: false, reason: 'conflict' };
    }

    let assignedModuleIds: readonly string[];
    try {
      assignedModuleIds = await deps.repository.listAssignedModules(input.instanceId);
      await deps.repository.syncAssignedModuleIam({
        instanceId: input.instanceId,
        managedModuleIds: [...registry.keys()],
        contracts: resolveAssignedModuleContracts(deps, assignedModuleIds),
      });
    } catch (error) {
      try {
        await deps.repository.revokeModule(input.instanceId, input.moduleId);
      } catch (rollbackError) {
        throw createModuleAssignRollbackError(error, rollbackError);
      }
      throw error;
    }
    await invalidateInstancePermissionSnapshots(deps, input.instanceId, 'instance_module_assigned');
    await deps.repository.appendAuditEvent({
      instanceId: input.instanceId,
      eventType: 'instance_module_assigned',
      actorId: input.actorId,
      requestId: input.requestId,
      details: {
        moduleId: input.moduleId,
        assignedModules: assignedModuleIds,
        outcome: 'assigned',
      },
    });

    const detail = await createGetInstanceDetail(deps)(input.instanceId);
    return detail ? { ok: true, instance: detail } : { ok: false, reason: 'not_found' };
  };

const createRevokeModuleHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['revokeModule'] =>
  async (input) => {
    const instance = await deps.repository.getInstanceById(input.instanceId);
    if (!instance) {
      return { ok: false, reason: 'not_found' };
    }

    const registry = requireModuleIamRegistry(deps);
    if (!registry.has(input.moduleId)) {
      return { ok: false, reason: 'unknown_module' };
    }

    const removed = await deps.repository.revokeModule(input.instanceId, input.moduleId);
    if (!removed) {
      return { ok: false, reason: 'conflict' };
    }

    const assignedModuleIds = await deps.repository.listAssignedModules(input.instanceId);
    await deps.repository.syncAssignedModuleIam({
      instanceId: input.instanceId,
      managedModuleIds: [...registry.keys()],
      contracts: resolveAssignedModuleContracts(deps, assignedModuleIds),
    });
    await invalidateInstancePermissionSnapshots(deps, input.instanceId, 'instance_module_revoked');
    await deps.repository.appendAuditEvent({
      instanceId: input.instanceId,
      eventType: 'instance_module_revoked',
      actorId: input.actorId,
      requestId: input.requestId,
      details: {
        moduleId: input.moduleId,
        assignedModules: assignedModuleIds,
        outcome: 'revoked',
      },
    });

    const detail = await createGetInstanceDetail(deps)(input.instanceId);
    return detail ? { ok: true, instance: detail } : { ok: false, reason: 'not_found' };
  };

const createSeedIamBaselineHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['seedIamBaseline'] =>
  async (input) => {
    const instance = await deps.repository.getInstanceById(input.instanceId);
    if (!instance) {
      return { ok: false, reason: 'not_found' };
    }

    const registry = requireModuleIamRegistry(deps);
    const assignedModuleIds = await deps.repository.listAssignedModules(input.instanceId);
    await deps.repository.syncAssignedModuleIam({
      instanceId: input.instanceId,
      managedModuleIds: [...registry.keys()],
      contracts: resolveAssignedModuleContracts(deps, assignedModuleIds),
    });
    await invalidateInstancePermissionSnapshots(deps, input.instanceId, 'instance_module_iam_seeded');
    await deps.repository.appendAuditEvent({
      instanceId: input.instanceId,
      eventType: 'instance_module_iam_seeded',
      actorId: input.actorId,
      requestId: input.requestId,
      details: {
        assignedModules: assignedModuleIds,
        outcome: 'seeded',
      },
    });

    const detail = await createGetInstanceDetail(deps)(input.instanceId);
    return detail ? { ok: true, instance: detail } : { ok: false, reason: 'not_found' };
  };

const createProvisioningRequestHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['createProvisioningRequest'] =>
  async (input: CreateInstanceProvisioningInput) => {
    logger.info('instance_create_requested', {
      operation: 'create_instance',
      instance_id: input.instanceId,
      request_id: input.requestId,
      actor_id: input.actorId,
    });
    const existing = await deps.repository.getInstanceById(input.instanceId);
    if (existing) {
      logger.warn('instance_create_rejected_duplicate', {
        operation: 'create_instance',
        instance_id: input.instanceId,
        request_id: input.requestId,
      });
      return { ok: false, reason: 'already_exists' as const };
    }

    const normalizedParentDomain = normalizeHost(input.parentDomain);
    const primaryHostname = buildPrimaryHostname(input.instanceId, normalizedParentDomain);
    const instance = await deps.repository.createInstance({
      instanceId: input.instanceId,
      displayName: input.displayName,
      status: 'requested',
      parentDomain: normalizedParentDomain,
      primaryHostname,
      realmMode: input.realmMode,
      authRealm: input.authRealm,
      authClientId: input.authClientId,
      authIssuerUrl: input.authIssuerUrl,
      authClientSecretCiphertext: encryptAuthClientSecret(deps, input.instanceId, input.authClientSecret),
      tenantAdminClient: input.tenantAdminClient
        ? {
            clientId: input.tenantAdminClient.clientId,
            secretCiphertext: encryptTenantAdminClientSecret(deps, input.instanceId, input.tenantAdminClient.secret),
          }
        : undefined,
      tenantAdminBootstrap: input.tenantAdminBootstrap,
      actorId: input.actorId,
      requestId: input.requestId,
      themeKey: input.themeKey,
      featureFlags: input.featureFlags,
      mainserverConfigRef: input.mainserverConfigRef,
    });

    await createProvisioningArtifacts(deps.repository, instance, input);
    invalidateHostWithLog(deps.invalidateHost, instance.primaryHostname, instance.instanceId);
    logger.info('instance_create_completed', {
      operation: 'create_instance',
      instance_id: instance.instanceId,
      status: instance.status,
      request_id: input.requestId,
    });
    return { ok: true, instance: toListItem(instance) };
  };

const createChangeStatusHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['changeStatus'] =>
  async (input) => {
    const current = await deps.repository.getInstanceById(input.instanceId);
    if (!current) {
      return { ok: false, reason: 'not_found' as const };
    }

    if (!canTransitionInstanceStatus(current.status, input.nextStatus)) {
      logger.warn('instance_status_transition_rejected', {
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
    logger.info('instance_status_transition_completed', {
      operation: 'change_instance_status',
      instance_id: updated.instanceId,
      previous_status: current.status,
      next_status: updated.status,
      request_id: input.requestId,
    });
    return { ok: true, instance: toListItem(updated) };
  };

const createUpdateInstanceHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['updateInstance'] =>
  async (input: UpdateInstanceInput) => {
    logger.info('instance_update_started', {
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
      authClientSecretCiphertext: encryptAuthClientSecret(deps, input.instanceId, input.authClientSecret),
      keepExistingAuthClientSecret: !input.authClientSecret?.trim(),
      tenantAdminClient: input.tenantAdminClient
        ? {
            clientId: input.tenantAdminClient.clientId,
            secretCiphertext: encryptTenantAdminClientSecret(deps, input.instanceId, input.tenantAdminClient.secret),
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

    logger.info('instance_update_completed', {
      operation: 'update_instance',
      instance_id: updated.instanceId,
      request_id: input.requestId,
      previous_hostname: existing.primaryHostname,
      next_hostname: updated.primaryHostname,
    });
    return createGetInstanceDetail(deps)(updated.instanceId);
  };

const createProbeTenantIamAccessHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['probeTenantIamAccess'] =>
  async (input) => {
    const instance = await deps.repository.getInstanceById(input.instanceId);
    if (!instance) {
      return null;
    }
    if (!deps.probeTenantIamAccess) {
      throw new Error('dependency_missing_probeTenantIamAccess');
    }

    const access = await deps.probeTenantIamAccess({
      instanceId: input.instanceId,
      actorId: input.actorId,
      requestId: input.requestId,
    });

    await deps.repository.appendAuditEvent({
      instanceId: input.instanceId,
      eventType: 'tenant_iam_access_probed',
      actorId: input.actorId,
      requestId: input.requestId,
      details: {
        status: access.status,
        summary: access.summary,
        checkedAt: access.checkedAt,
        errorCode: access.errorCode,
        requestId: access.requestId ?? input.requestId,
      },
    });

    const [keycloakStatus, reconcileEvidence] = await Promise.all([
      createGetKeycloakStatusHandler(deps)(input.instanceId),
      deps.repository.getRoleReconcileSummary(input.instanceId),
    ]);

    return buildTenantIamStatus({
      keycloakStatus: keycloakStatus ?? undefined,
      accessEvidence: access,
      reconcileEvidence: reconcileEvidence
        ? {
            status: reconcileEvidence.status,
            summary: reconcileEvidence.summary,
            source: 'role_reconcile',
            checkedAt: reconcileEvidence.checkedAt,
            errorCode: reconcileEvidence.errorCode,
            requestId: reconcileEvidence.requestId,
          }
        : undefined,
    });
  };

export const createInstanceRegistryService = (deps: InstanceRegistryServiceDeps): InstanceRegistryService => ({
  listInstances: createListInstances(deps.repository),
  getInstanceDetail: createGetInstanceDetail(deps),
  createProvisioningRequest: createProvisioningRequestHandler(deps),
  updateInstance: createUpdateInstanceHandler(deps),
  changeStatus: createChangeStatusHandler(deps),
  getKeycloakPreflight: createGetKeycloakPreflightHandler(deps),
  planKeycloakProvisioning: createPlanKeycloakProvisioningHandler(deps),
  executeKeycloakProvisioning: createExecuteKeycloakProvisioningHandler(deps),
  assignModule: createAssignModuleHandler(deps),
  revokeModule: createRevokeModuleHandler(deps),
  seedIamBaseline: createSeedIamBaselineHandler(deps),
  probeTenantIamAccess: createProbeTenantIamAccessHandler(deps),
  getKeycloakProvisioningRun: createGetKeycloakProvisioningRunHandler(deps),
  getKeycloakStatus: createGetKeycloakStatusHandler(deps),
  reconcileKeycloak: createReconcileKeycloakHandler(deps),
  resolveRuntimeInstance: createRuntimeResolver(deps.repository),
  isTrafficAllowed: isTrafficEnabledInstanceStatus,
});
