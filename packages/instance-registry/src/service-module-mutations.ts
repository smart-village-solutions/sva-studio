import { createGetInstanceDetail } from './service-detail.js';
import {
  invalidateInstancePermissionSnapshots,
  requireModuleIamRegistry,
  resolveAssignedModuleContracts,
} from './service-shared.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';

// Keep this direct system_admin bundle aligned with the seeded tenant baseline until the seed accessor
// is exposed as a stable cross-package runtime API.
const SYSTEM_ADMIN_DIRECT_PERMISSION_KEYS = [
  'iam.user.read',
  'iam.user.write',
  'iam.role.read',
  'iam.role.write',
  'iam.org.read',
  'iam.org.write',
  'iam.legalText.read',
  'iam.legalText.write',
  'iam.governance.read',
  'iam.governance.write',
  'iam.governance.export',
  'iam.dsr.read',
  'iam.dsr.write',
  'iam.dsr.export',
  'iam.deletionRules.read',
  'iam.deletionRules.write',
  'iam.monitoring.read',
  'iam.monitoring.write',
  'experimental.read',
  'app.read',
  'cockpit.read',
  'content.read',
  'content.create',
  'content.updateMetadata',
  'content.updatePayload',
  'content.changeStatus',
  'content.publish',
  'content.archive',
  'content.restore',
  'content.readHistory',
  'content.manageRevisions',
  'content.delete',
  'integration.manage',
  'feature.toggle',
  'media.read',
  'media.create',
  'media.update',
  'media.reference.manage',
  'media.delete',
  'media.deliver.protected',
] as const;
const SYSTEM_ADMIN_ROLE_KEY = 'system_admin';
const SYSTEM_ADMIN_DISPLAY_NAME = 'System Administrator';
const SYSTEM_ADMIN_ROLE_LEVEL = 100;
const CATEGORIES_MODULE_ID = 'categories';
const categoriesCompanionSourceModuleIds = new Set(['news', 'events', 'poi']);

const withRequiredCompanionModules = (moduleIds: readonly string[]): string[] => {
  const normalizedModuleIds = Array.from(new Set(moduleIds.map((moduleId) => moduleId.trim()).filter(Boolean)));

  if (normalizedModuleIds.some((moduleId) => categoriesCompanionSourceModuleIds.has(moduleId))) {
    normalizedModuleIds.push(CATEGORIES_MODULE_ID);
  }

  return Array.from(new Set(normalizedModuleIds)).sort((left, right) => left.localeCompare(right, 'de'));
};

type ProtectedSystemRolePermissionSyncRepository = InstanceRegistryServiceDeps['repository'] & {
  syncProtectedSystemRolePermissions(input: {
    instanceId: string;
    role: {
      roleKey: string;
      displayName: string;
      roleLevel: number;
      permissionKeys: readonly string[];
    };
  }): Promise<void>;
};

const syncProtectedSystemAdminPermissions = async (deps: InstanceRegistryServiceDeps, instanceId: string) => {
  const repository = deps.repository as ProtectedSystemRolePermissionSyncRepository;
  await repository.syncProtectedSystemRolePermissions({
    instanceId,
    role: {
      roleKey: SYSTEM_ADMIN_ROLE_KEY,
      displayName: SYSTEM_ADMIN_DISPLAY_NAME,
      roleLevel: SYSTEM_ADMIN_ROLE_LEVEL,
      permissionKeys: [...SYSTEM_ADMIN_DIRECT_PERMISSION_KEYS],
    },
  });
};

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
    const newlyAssignedModuleIds = [input.moduleId];
    try {
      const assignedAfterPrimaryInsert = await deps.repository.listAssignedModules(input.instanceId);
      const desiredAssignedModuleIds = withRequiredCompanionModules(assignedAfterPrimaryInsert);

      for (const moduleId of desiredAssignedModuleIds) {
        if (!assignedAfterPrimaryInsert.includes(moduleId)) {
          const companionInserted = await deps.repository.assignModule(input.instanceId, moduleId);
          if (companionInserted) {
            newlyAssignedModuleIds.push(moduleId);
          }
        }
      }

      assignedModuleIds = withRequiredCompanionModules(await deps.repository.listAssignedModules(input.instanceId));
      await deps.repository.syncAssignedModuleIam({
        instanceId: input.instanceId,
        managedModuleIds: [...registry.keys()],
        contracts: resolveAssignedModuleContracts(deps, assignedModuleIds),
      });
    } catch (error) {
      try {
        for (const moduleId of [...newlyAssignedModuleIds].reverse()) {
          await deps.repository.revokeModule(input.instanceId, moduleId);
        }
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
    const requestedModuleIds = withRequiredCompanionModules(input.moduleIds);

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
      await syncProtectedSystemAdminPermissions(deps, input.instanceId);
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
        bootstrapMode: 'system_admin_only',
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
    await syncProtectedSystemAdminPermissions(deps, input.instanceId);
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
