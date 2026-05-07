import { createGetInstanceDetail } from './service-detail.js';
import {
  invalidateInstancePermissionSnapshots,
  requireModuleIamRegistry,
  resolveAssignedModuleContracts,
} from './service-shared.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';

const createModuleAssignRollbackError = (
  instanceId: string,
  moduleId: string,
  syncError: unknown,
  rollbackError: unknown
): Error => {
  const message =
    syncError instanceof Error ? syncError.message : typeof syncError === 'string' ? syncError : 'instance_module_sync_failed';
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
        throw createModuleAssignRollbackError(input.instanceId, input.moduleId, error, rollbackError);
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

export const createRevokeModuleHandler =
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

export const createSeedIamBaselineHandler =
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
