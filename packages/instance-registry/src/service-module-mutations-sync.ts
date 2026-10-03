import { resolvesSystemAdminGrant, tenantCorePermissionCatalog } from '@sva/core';
import type { PermissionCatalogReconcileResult } from '@sva/data-repositories';

import { assertNoActiveTenantProvisioning } from './service-active-provisioning.js';
import { createGetInstanceDetail } from './service-detail.js';
import { createReconcileModuleActivationPoliciesHandler } from './service-module-activation.js';
import {
  invalidateInstancePermissionSnapshots,
  requireModuleIamRegistry,
  resolveAssignedModuleContracts,
  resolveManagedModuleContracts,
} from './service-shared.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';

const SYSTEM_ADMIN_ROLE_KEY = 'system_admin';
const SYSTEM_ADMIN_DISPLAY_NAME = 'System Administrator';
const SYSTEM_ADMIN_ROLE_LEVEL = 100;
const CATEGORIES_MODULE_ID = 'categories';
export const WASTE_MANAGEMENT_MODULE_ID = 'waste-management';
const categoriesCompanionSourceModuleIds = new Set(['news', 'events', 'poi']);

export const withRequiredCompanionModules = (moduleIds: readonly string[]): string[] => {
  const normalizedModuleIds = Array.from(
    new Set(moduleIds.map((moduleId) => moduleId.trim()).filter(Boolean))
  );

  if (normalizedModuleIds.some((moduleId) => categoriesCompanionSourceModuleIds.has(moduleId))) {
    normalizedModuleIds.push(CATEGORIES_MODULE_ID);
  }

  return Array.from(new Set(normalizedModuleIds)).sort((left, right) =>
    left.localeCompare(right, 'de')
  );
};

export const syncProtectedSystemAdminPermissions = async (
  deps: InstanceRegistryServiceDeps,
  instanceId: string
) => {
  return deps.repository.syncProtectedSystemRolePermissions({
    instanceId,
    role: {
      roleKey: SYSTEM_ADMIN_ROLE_KEY,
      displayName: SYSTEM_ADMIN_DISPLAY_NAME,
      roleLevel: SYSTEM_ADMIN_ROLE_LEVEL,
      permissions: tenantCorePermissionCatalog.map((permission) => ({
        key: permission.key,
        description: permission.description,
        resourceType: permission.resourceType,
      })),
      grantPermissionKeys: tenantCorePermissionCatalog
        .filter(resolvesSystemAdminGrant)
        .map(({ key }) => key),
    },
  });
};

export const normalizeReconcileResult = (
  result: PermissionCatalogReconcileResult | void
): PermissionCatalogReconcileResult =>
  result ?? {
    permissionsInserted: 0,
    permissionsUpdated: 0,
    permissionsUnchanged: 0,
    grantsInserted: 0,
    grantsUnchanged: 0,
  };

export const mergeReconcileResults = (
  ...results: readonly (PermissionCatalogReconcileResult | void)[]
): PermissionCatalogReconcileResult =>
  results.map(normalizeReconcileResult).reduce(
    (total, result) => ({
      permissionsInserted: total.permissionsInserted + result.permissionsInserted,
      permissionsUpdated: total.permissionsUpdated + result.permissionsUpdated,
      permissionsUnchanged: total.permissionsUnchanged + result.permissionsUnchanged,
      grantsInserted: total.grantsInserted + result.grantsInserted,
      grantsUnchanged: total.grantsUnchanged + result.grantsUnchanged,
    }),
    normalizeReconcileResult(undefined)
  );

const createBootstrapAssignRollbackError = (
  instanceId: string,
  moduleIds: readonly string[],
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
  combined.message = `instance_module_bootstrap_rollback_failed:${instanceId}:${moduleIds.join(',')}:${message}`;
  combined.cause = {
    syncError,
    rollbackError,
  };
  combined.name = 'InstanceModuleBootstrapRollbackError';
  return combined;
};

type ModuleActivationSnapshot = Awaited<
  ReturnType<InstanceRegistryServiceDeps['repository']['getModuleActivationPolicy']>
>;

const assignBootstrapModulesAndSyncIam = async (input: {
  readonly deps: InstanceRegistryServiceDeps;
  readonly instanceId: string;
  readonly requestedModuleIds: readonly string[];
  readonly managedModuleIds: readonly string[];
}): Promise<{
  readonly assignedModuleIds: readonly string[];
  readonly permissionReconcile: PermissionCatalogReconcileResult | void;
}> => {
  const { deps, instanceId, requestedModuleIds, managedModuleIds } = input;
  const currentAssignedModuleIds = new Set(await deps.repository.listAssignedModules(instanceId));
  const changedAssignments: Array<{
    readonly moduleId: string;
    readonly previous: ModuleActivationSnapshot;
  }> = [];
  try {
    for (const moduleId of requestedModuleIds) {
      if (!currentAssignedModuleIds.has(moduleId)) {
        const previous = await deps.repository.getModuleActivationPolicy(instanceId, moduleId);
        const lifecycle = deps.pluginTenantLifecycleRegistry?.get(moduleId);
        const inserted = lifecycle
          ? await deps.repository.assignModule(instanceId, moduleId, lifecycle.contractRevision)
          : await deps.repository.assignModule(instanceId, moduleId);
        if (inserted) changedAssignments.push({ moduleId, previous });
      }
    }
    const assignedModuleIds = await deps.repository.listAssignedModules(instanceId);
    const permissionReconcile = await deps.repository.syncAssignedModuleIam({
      instanceId,
      managedModuleIds,
      managedContracts: resolveManagedModuleContracts(deps),
      contracts: resolveAssignedModuleContracts(deps, assignedModuleIds),
    });
    return { assignedModuleIds, permissionReconcile };
  } catch (error) {
    try {
      for (const assignment of [...changedAssignments].reverse()) {
        const restored = await deps.repository.restoreModuleActivation(
          instanceId,
          assignment.moduleId,
          assignment.previous
        );
        if (!restored) {
          const restoreError = new Error(
            `rollback_restore_failed:${assignment.moduleId}`
          ) as Error & { cause?: unknown };
          restoreError.cause = error;
          throw restoreError;
        }
      }
    } catch (rollbackError) {
      throw createBootstrapAssignRollbackError(
        instanceId,
        changedAssignments.map(({ moduleId }) => moduleId),
        error,
        rollbackError
      );
    }
    throw error;
  }
};

export const createBootstrapAdminStructureHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['bootstrapAdminStructure'] =>
  async (input) => {
    const instance = await deps.repository.getInstanceById(input.instanceId);
    if (!instance) {
      return { ok: false, reason: 'not_found' };
    }
    await assertNoActiveTenantProvisioning(deps.repository, input.instanceId);

    const registry = requireModuleIamRegistry(deps);
    const requestedModuleIds = withRequiredCompanionModules(input.moduleIds);

    if (requestedModuleIds.some((moduleId) => !registry.has(moduleId))) {
      return { ok: false, reason: 'unknown_module' };
    }

    const bootstrapAssignments = await assignBootstrapModulesAndSyncIam({
      deps,
      instanceId: input.instanceId,
      requestedModuleIds,
      managedModuleIds: [...registry.keys()],
    });
    const assignedModuleIds = bootstrapAssignments.assignedModuleIds;
    let modulePermissionReconcile = bootstrapAssignments.permissionReconcile;

    let bootstrapCompleted = false;
    try {
      const corePermissionReconcile = await syncProtectedSystemAdminPermissions(
        deps,
        input.instanceId
      );
      bootstrapCompleted = true;
      modulePermissionReconcile = mergeReconcileResults(
        modulePermissionReconcile,
        corePermissionReconcile
      );
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
        permissionReconcile: normalizeReconcileResult(modulePermissionReconcile),
        outcome: 'bootstrapped',
      },
    });

    if (requestedModuleIds.includes(WASTE_MANAGEMENT_MODULE_ID)) {
      await deps.repository.requestWasteProvisioning(input.instanceId);
    }

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
    await assertNoActiveTenantProvisioning(deps.repository, input.instanceId);

    const registry = requireModuleIamRegistry(deps);
    const assignedModuleIdsBeforeReconcile = await deps.repository.listAssignedModules(
      input.instanceId
    );
    await createReconcileModuleActivationPoliciesHandler(deps, { deferIamSync: true })({
      instanceId: input.instanceId,
      actorId: input.actorId,
      requestId: input.requestId,
    });
    const assignedModuleIds = await deps.repository.listAssignedModules(input.instanceId);
    const missingModuleIds = [
      ...new Set([...assignedModuleIdsBeforeReconcile, ...assignedModuleIds]),
    ]
      .filter((moduleId) => !registry.has(moduleId))
      .sort((left, right) => left.localeCompare(right, 'de'));
    const knownAssignedModuleIds = assignedModuleIds.filter((moduleId) => registry.has(moduleId));
    const errorCodes = missingModuleIds.map((moduleId) => `unknown_module_contract:${moduleId}`);
    const corePermissionReconcile = await syncProtectedSystemAdminPermissions(
      deps,
      input.instanceId
    );
    const modulePermissionReconcile = await deps.repository.syncAssignedModuleIam({
      instanceId: input.instanceId,
      managedModuleIds: [...new Set([...registry.keys(), ...missingModuleIds])],
      managedContracts: resolveManagedModuleContracts(deps),
      contracts: resolveAssignedModuleContracts(deps, knownAssignedModuleIds),
    });
    await invalidateInstancePermissionSnapshots(
      deps,
      input.instanceId,
      missingModuleIds.length > 0
        ? 'instance_module_iam_seeded_partial'
        : 'instance_module_iam_seeded'
    );
    await deps.repository.appendAuditEvent({
      instanceId: input.instanceId,
      eventType: 'instance_module_iam_seeded',
      actorId: input.actorId,
      requestId: input.requestId,
      details: {
        assignedModules: assignedModuleIds,
        permissionReconcile: mergeReconcileResults(
          modulePermissionReconcile,
          corePermissionReconcile
        ),
        outcome: missingModuleIds.length > 0 ? 'partial' : 'seeded',
        ...(missingModuleIds.length > 0 ? { missingModuleIds, errorCodes } : {}),
      },
    });

    if (missingModuleIds.length > 0) {
      return {
        ok: false,
        reason: 'module_contract_missing',
        moduleIds: missingModuleIds,
        errorCodes,
      };
    }

    const detail = await createGetInstanceDetail(deps)(input.instanceId);
    return detail ? { ok: true, instance: detail } : { ok: false, reason: 'not_found' };
  };
