import { createGetInstanceDetail } from './service-detail.js';
import {
  invalidateInstancePermissionSnapshots,
  requireModuleIamRegistry,
  resolveAssignedModuleContracts,
} from './service-shared.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';

const ADMIN_GROUP_KEY = 'admins';
const ADMIN_GROUP_DISPLAY_NAME = 'Admins';
const CORE_ADMIN_ROLE_KEY = 'core_admin';
const CORE_ADMIN_ROLE_DISPLAY_NAME = 'Core Admin';
const CORE_ADMIN_PERMISSION_KEYS = [
  'iam.user.read',
  'iam.user.write',
  'iam.role.read',
  'iam.role.write',
  'iam.org.read',
  'iam.org.write',
  'content.read',
  'content.create',
  'content.updateMetadata',
  'content.publish',
  'content.manageRevisions',
  'integration.manage',
  'feature.toggle',
  'instance.registry.manage',
  'content.updatePayload',
  'content.changeStatus',
  'content.archive',
  'content.restore',
  'content.readHistory',
  'content.delete',
] as const;

const toTitleCase = (value: string) =>
  value
    .split(/[_-]+/u)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(' ');

const toModuleAdminRoleKey = (moduleId: string) => `${moduleId}_admin`;
const toModuleAdminRoleDisplayName = (moduleId: string) => `${toTitleCase(moduleId)} Admin`;

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

const createBootstrapAssignRollbackError = (
  instanceId: string,
  moduleIds: readonly string[],
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
  combined.message = `instance_module_bootstrap_rollback_failed:${instanceId}:${moduleIds.join(',')}:${message}`;
  combined.cause = {
    syncError,
    rollbackError,
  };
  combined.name = 'InstanceModuleBootstrapRollbackError';
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

export const createBootstrapAdminStructureHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['bootstrapAdminStructure'] =>
  async (input) => {
    const instance = await deps.repository.getInstanceById(input.instanceId);
    if (!instance) {
      return { ok: false, reason: 'not_found' };
    }

    const registry = requireModuleIamRegistry(deps);
    const requestedModuleIds = Array.from(new Set(input.moduleIds.map((moduleId) => moduleId.trim()).filter(Boolean))).sort(
      (left, right) => left.localeCompare(right, 'de')
    );

    if (requestedModuleIds.some((moduleId) => !registry.has(moduleId))) {
      return { ok: false, reason: 'unknown_module' };
    }

    const currentAssignedModuleIds = new Set(await deps.repository.listAssignedModules(input.instanceId));
    const newlyAssignedModuleIds: string[] = [];
    for (const moduleId of requestedModuleIds) {
      if (!currentAssignedModuleIds.has(moduleId)) {
        const inserted = await deps.repository.assignModule(input.instanceId, moduleId);
        if (inserted) {
          newlyAssignedModuleIds.push(moduleId);
        }
      }
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
        for (const moduleId of [...newlyAssignedModuleIds].reverse()) {
          const removed = await deps.repository.revokeModule(input.instanceId, moduleId);
          if (!removed) {
            const rollbackRevokeError = new Error(`rollback_revoke_failed:${moduleId}`) as Error & { cause?: unknown };
            rollbackRevokeError.cause = error;
            throw rollbackRevokeError;
          }
        }
      } catch (rollbackError) {
        throw createBootstrapAssignRollbackError(input.instanceId, newlyAssignedModuleIds, error, rollbackError);
      }
      throw error;
    }

    let bootstrapCompleted = false;
    try {
      await deps.repository.syncInstanceAdminBootstrap({
        instanceId: input.instanceId,
        groupKey: ADMIN_GROUP_KEY,
        groupDisplayName: ADMIN_GROUP_DISPLAY_NAME,
        coreRole: {
          roleKey: CORE_ADMIN_ROLE_KEY,
          displayName: CORE_ADMIN_ROLE_DISPLAY_NAME,
          permissionKeys: [...CORE_ADMIN_PERMISSION_KEYS],
        },
        moduleRoles: requestedModuleIds.map((moduleId) => ({
          moduleId,
          roleKey: toModuleAdminRoleKey(moduleId),
          displayName: toModuleAdminRoleDisplayName(moduleId),
          permissionKeys: [...(registry.get(moduleId)?.permissionIds ?? [])],
        })),
      });
      bootstrapCompleted = true;
    } finally {
      await invalidateInstancePermissionSnapshots(
        deps,
        input.instanceId,
        bootstrapCompleted ? 'instance_admin_bootstrapped' : 'instance_module_assigned'
      );
    }

    await deps.repository.appendAuditEvent({
      instanceId: input.instanceId,
      eventType: 'instance_admin_bootstrapped',
      actorId: input.actorId,
      requestId: input.requestId,
      details: {
        assignedModules: assignedModuleIds,
        selectedModuleIds: requestedModuleIds,
        groupKey: ADMIN_GROUP_KEY,
        coreRoleKey: CORE_ADMIN_ROLE_KEY,
        outcome: 'bootstrapped',
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
