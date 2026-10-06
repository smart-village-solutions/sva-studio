import {
  invalidateInstancePermissionSnapshots,
  requireModuleIamRegistry,
  resolveAssignedModuleContracts,
  resolveManagedModuleContracts,
} from './service-shared.js';
import type {
  InstanceModuleIamRegistryEntry,
  InstanceRegistryService,
  InstanceRegistryServiceDeps,
} from './service-types.js';
import type { PermissionCatalogReconcileResult } from '@sva/data-repositories';
import type { InstanceProvisioningRun } from '@sva/core';
import { readTenantProvisioningPluginSnapshot } from './tenant-provisioning-snapshot.js';

export const withRequiredTenantModules = (
  moduleIds: readonly string[],
  registry: ReadonlyMap<string, InstanceModuleIamRegistryEntry>
): string[] => {
  const normalizedModuleIds = Array.from(new Set(moduleIds.map((id) => id.trim()).filter(Boolean)));
  for (const moduleId of [...normalizedModuleIds]) {
    for (const requiredModuleId of registry.get(moduleId)?.requiredTenantModuleIds ?? []) {
      if (!registry.has(requiredModuleId)) {
        throw new Error(
          `plugin_tenant_module_requirement_unavailable:${moduleId}:${requiredModuleId}`
        );
      }
      normalizedModuleIds.push(requiredModuleId);
    }
  }
  return Array.from(new Set(normalizedModuleIds)).sort((left, right) =>
    left.localeCompare(right, 'de')
  );
};

export const canActivateRequiredTenantModules = async (
  deps: InstanceRegistryServiceDeps,
  instanceId: string,
  moduleIds: readonly string[],
  currentlyAssignedModuleIds: readonly string[]
): Promise<boolean> => {
  const assigned = new Set(currentlyAssignedModuleIds);
  const requiredModuleIds = new Set(
    moduleIds.flatMap(
      (moduleId) => deps.moduleIamRegistry?.get(moduleId)?.requiredTenantModuleIds ?? []
    )
  );
  const snapshotModules = deps.readModuleActivationPolicySnapshot?.().modules ?? [];
  for (const requiredModuleId of requiredModuleIds) {
    if (assigned.has(requiredModuleId)) continue;
    const persisted = await deps.repository.getModuleActivationPolicy(instanceId, requiredModuleId);
    const policy =
      persisted?.activationPolicy ??
      snapshotModules.find(({ moduleId }) => moduleId === requiredModuleId)?.activationPolicy;
    if (persisted?.manualOverride === 'disabled') return false;
    if (policy === 'required' || (policy === 'automatic' && persisted?.effectiveActive !== true))
      return false;
  }
  return true;
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

const emptyResult = {
  changedModuleIds: [] as readonly string[],
  conflictModuleIds: [] as readonly string[],
  unchangedModuleIds: [] as readonly string[],
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

export const createReconcileModuleActivationPoliciesHandler =
  (
    deps: InstanceRegistryServiceDeps,
    options: Readonly<{
      forceIamSync?: boolean;
      deferIamSync?: boolean;
      policySnapshot?: ReturnType<
        NonNullable<InstanceRegistryServiceDeps['readModuleActivationPolicySnapshot']>
      >;
      lifecycleRegistry?: InstanceRegistryServiceDeps['pluginTenantLifecycleRegistry'];
    }> = {}
  ): InstanceRegistryService['reconcileModuleActivationPolicies'] =>
  async ({ instanceId, actorId, requestId }) => {
    const snapshot = options.policySnapshot ?? deps.readModuleActivationPolicySnapshot?.();
    if (!snapshot || !snapshot.revision) {
      return emptyResult;
    }

    const registry = requireModuleIamRegistry(deps);
    const result = await deps.repository.reconcileModuleActivationPolicies({
      instanceId,
      policies: snapshot.modules,
      preservedModuleIds: [...registry.keys()],
      reconcileId: snapshot.revision,
      actorId,
    });
    if (result.conflictModuleIds.length > 0) {
      throw new Error(`plugin_activation_state_conflict:${result.conflictModuleIds.join(',')}`);
    }
    deps.captureModuleActivationPolicyReconcileResult?.(result);
    if (result.changedModuleIds.length === 0 && !options.forceIamSync) {
      return result;
    }

    const assignedModuleIds = await deps.repository.listAssignedModules(instanceId);
    const managedModuleIds = [...new Set([...registry.keys(), ...result.changedModuleIds])];
    const permissionReconcile = options.deferIamSync
      ? null
      : await deps.repository.syncAssignedModuleIam({
          instanceId,
          managedModuleIds,
          managedContracts: resolveManagedModuleContracts(deps),
          contracts: resolveAssignedModuleContracts(deps, assignedModuleIds),
        });
    const lifecycleIntents = await deps.repository.persistPluginTenantLifecycleReconcileIntents({
      instanceId,
      lifecycles: [
        ...((options.lifecycleRegistry ?? deps.pluginTenantLifecycleRegistry)?.values() ?? []),
      ],
      forcePluginIds: result.changedModuleIds,
    });
    await invalidateInstancePermissionSnapshots(
      deps,
      instanceId,
      'instance_module_policy_reconciled'
    );
    await deps.repository.appendAuditEvent({
      instanceId,
      eventType: 'instance_module_policy_reconciled',
      actorId,
      requestId,
      details: {
        reconcileId: snapshot.revision,
        changedModuleIds: result.changedModuleIds,
        conflictModuleIds: result.conflictModuleIds,
        unchangedModuleIds: result.unchangedModuleIds,
        assignedModules: assignedModuleIds,
        permissionReconcile: permissionReconcile ?? null,
        lifecycleIntents,
      },
    });

    return result;
  };

export const reconcileProvisioningModuleActivationPolicies = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceProvisioningRun
) => {
  const pluginSnapshot = readTenantProvisioningPluginSnapshot(run);
  if (pluginSnapshot.lifecycles.length === 0) return emptyResult;
  const currentPolicies = pluginSnapshot.activationPoliciesBound
    ? []
    : (deps.readModuleActivationPolicySnapshot?.().modules ?? []);
  const activationPolicies = pluginSnapshot.activationPoliciesBound
    ? pluginSnapshot.activationPolicies
    : pluginSnapshot.lifecycles.map(({ pluginId }) => {
        const policy = currentPolicies.find(({ moduleId }) => moduleId === pluginId);
        if (!policy) throw new Error('provisioning_plugin_snapshot_missing');
        return policy;
      });
  return createReconcileModuleActivationPoliciesHandler(deps, {
    forceIamSync: true,
    policySnapshot: {
      revision: `provisioning:${run.id}`,
      modules: activationPolicies,
    },
    lifecycleRegistry: new Map(
      pluginSnapshot.lifecycles.map((lifecycle) => [lifecycle.pluginId, lifecycle])
    ),
  })({
    instanceId: run.instanceId,
    actorId: run.actorId,
    requestId: run.requestId,
  });
};
