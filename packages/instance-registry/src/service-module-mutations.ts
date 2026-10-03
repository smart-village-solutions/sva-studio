import type { PermissionCatalogReconcileResult } from '@sva/data-repositories';

import { assertNoActiveTenantProvisioning } from './service-active-provisioning.js';
import { createGetInstanceDetail } from './service-detail.js';
import {
  WASTE_MANAGEMENT_MODULE_ID,
  normalizeReconcileResult,
  withRequiredCompanionModules,
} from './service-module-mutations-sync.js';
import {
  invalidateInstancePermissionSnapshots,
  requireModuleIamRegistry,
  resolveAssignedModuleContracts,
  resolveManagedModuleContracts,
} from './service-shared.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';

export {
  createBootstrapAdminStructureHandler,
  createSeedIamBaselineHandler,
  mergeReconcileResults,
  syncProtectedSystemAdminPermissions,
} from './service-module-mutations-sync.js';

const createModuleAssignRollbackError = (
  instanceId: string,
  moduleId: string,
  syncError: unknown,
  rollbackError: unknown
): Error => {
  const message =
    syncError instanceof Error
      ? syncError.message
      : typeof syncError === 'string'
        ? syncError
        : 'instance_module_sync_failed';
  const combined = new Error(message) as Error & {
    cause?: {
      rollbackError: unknown;
      syncError: unknown;
    };
  };
  combined.message = `instance_module_assign_rollback_failed:${instanceId}:${moduleId}:${message}`;
  combined.cause = {
    syncError,
    rollbackError,
  };
  combined.name = 'InstanceModuleAssignRollbackError';
  return combined;
};

export const createAssignModuleHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['assignModule'] =>
  async (input) => {
    const instance = await deps.repository.getInstanceById(input.instanceId);
    if (!instance) {
      return { ok: false, reason: 'not_found' };
    }
    await assertNoActiveTenantProvisioning(deps.repository, input.instanceId);

    const registry = requireModuleIamRegistry(deps);
    if (!registry.has(input.moduleId)) {
      return { ok: false, reason: 'unknown_module' };
    }

    const previousPrimaryActivation = await deps.repository.getModuleActivationPolicy(
      input.instanceId,
      input.moduleId
    );
    const primaryLifecycle = deps.pluginTenantLifecycleRegistry?.get(input.moduleId);
    const inserted = primaryLifecycle
      ? await deps.repository.assignModule(
          input.instanceId,
          input.moduleId,
          primaryLifecycle.contractRevision
        )
      : await deps.repository.assignModule(input.instanceId, input.moduleId);
    if (!inserted) {
      return { ok: false, reason: 'conflict' };
    }

    let assignedModuleIds: readonly string[];
    let permissionReconcile: PermissionCatalogReconcileResult | void;
    const changedAssignments = [{ moduleId: input.moduleId, previous: previousPrimaryActivation }];
    try {
      const assignedAfterPrimaryInsert = await deps.repository.listAssignedModules(
        input.instanceId
      );
      const desiredAssignedModuleIds = withRequiredCompanionModules(assignedAfterPrimaryInsert);

      for (const moduleId of desiredAssignedModuleIds) {
        if (!assignedAfterPrimaryInsert.includes(moduleId)) {
          const previousActivation = await deps.repository.getModuleActivationPolicy(
            input.instanceId,
            moduleId
          );
          const companionLifecycle = deps.pluginTenantLifecycleRegistry?.get(moduleId);
          const companionInserted = companionLifecycle
            ? await deps.repository.assignModule(
                input.instanceId,
                moduleId,
                companionLifecycle.contractRevision
              )
            : await deps.repository.assignModule(input.instanceId, moduleId);
          if (companionInserted) {
            changedAssignments.push({ moduleId, previous: previousActivation });
          }
        }
      }

      assignedModuleIds = withRequiredCompanionModules(
        await deps.repository.listAssignedModules(input.instanceId)
      );
      permissionReconcile = await deps.repository.syncAssignedModuleIam({
        instanceId: input.instanceId,
        managedModuleIds: [...registry.keys()],
        managedContracts: resolveManagedModuleContracts(deps),
        contracts: resolveAssignedModuleContracts(deps, assignedModuleIds),
      });
      await deps.repository.persistPluginTenantLifecycleReconcileIntents({
        instanceId: input.instanceId,
        lifecycles: [...(deps.pluginTenantLifecycleRegistry?.values() ?? [])],
        forcePluginIds: [],
      });
    } catch (error) {
      try {
        for (const assignment of [...changedAssignments].reverse()) {
          const restored = await deps.repository.restoreModuleActivation(
            input.instanceId,
            assignment.moduleId,
            assignment.previous
          );
          if (!restored) {
            const restoreError = new Error(
              `rollback_restore_failed:${assignment.moduleId}`
            ) as Error & { cause: unknown };
            restoreError.cause = error;
            throw restoreError;
          }
        }
      } catch (rollbackError) {
        throw createModuleAssignRollbackError(
          input.instanceId,
          input.moduleId,
          error,
          rollbackError
        );
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
        permissionReconcile: normalizeReconcileResult(permissionReconcile),
        outcome: 'assigned',
      },
    });

    if (input.moduleId === WASTE_MANAGEMENT_MODULE_ID) {
      await deps.repository.requestWasteProvisioning(input.instanceId);
    }

    const detail = await createGetInstanceDetail(deps)(input.instanceId);
    return detail ? { ok: true, instance: detail } : { ok: false, reason: 'not_found' };
  };

export const createRevokeModuleHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['revokeModule'] =>
  async (input) => {
    const instance = await deps.repository.getInstanceById(input.instanceId);
    if (!instance) {
      return { ok: false, reason: 'not_found' };
    }
    await assertNoActiveTenantProvisioning(deps.repository, input.instanceId);

    const registry = requireModuleIamRegistry(deps);
    if (!registry.has(input.moduleId)) {
      return { ok: false, reason: 'unknown_module' };
    }

    const activationPolicy = await deps.repository.getModuleActivationPolicy(
      input.instanceId,
      input.moduleId
    );
    if (activationPolicy?.activationPolicy === 'required') {
      return { ok: false, reason: 'plugin_activation_required_cannot_disable' };
    }

    const removed = await deps.repository.revokeModule(input.instanceId, input.moduleId);
    if (!removed) {
      return { ok: false, reason: 'conflict' };
    }

    const assignedModuleIds = await deps.repository.listAssignedModules(input.instanceId);
    const permissionReconcile = await deps.repository.syncAssignedModuleIam({
      instanceId: input.instanceId,
      managedModuleIds: [...registry.keys()],
      managedContracts: resolveManagedModuleContracts(deps),
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
        permissionReconcile: normalizeReconcileResult(permissionReconcile),
        outcome: 'revoked',
      },
    });

    if (input.moduleId === WASTE_MANAGEMENT_MODULE_ID) {
      await deps.repository.disableWasteProvisioning(input.instanceId);
    }

    const detail = await createGetInstanceDetail(deps)(input.instanceId);
    return detail ? { ok: true, instance: detail } : { ok: false, reason: 'not_found' };
  };
