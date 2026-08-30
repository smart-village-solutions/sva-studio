import {
  invalidateInstancePermissionSnapshots,
  requireModuleIamRegistry,
  resolveAssignedModuleContracts,
  resolveManagedModuleContracts,
} from './service-shared.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';

const emptyResult = {
  changedModuleIds: [] as readonly string[],
  conflictModuleIds: [] as readonly string[],
  unchangedModuleIds: [] as readonly string[],
};

export const createReconcileModuleActivationPoliciesHandler =
  (
    deps: InstanceRegistryServiceDeps,
    options: Readonly<{ forceIamSync?: boolean }> = {}
  ): InstanceRegistryService['reconcileModuleActivationPolicies'] =>
  async ({ instanceId, actorId, requestId }) => {
    const snapshot = deps.readModuleActivationPolicySnapshot?.();
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
    if (result.changedModuleIds.length === 0 && !options.forceIamSync) {
      return result;
    }

    const assignedModuleIds = await deps.repository.listAssignedModules(instanceId);
    const managedModuleIds = [...new Set([...registry.keys(), ...result.changedModuleIds])];
    const permissionReconcile = await deps.repository.syncAssignedModuleIam({
      instanceId,
      managedModuleIds,
      managedContracts: resolveManagedModuleContracts(deps),
      contracts: resolveAssignedModuleContracts(deps, assignedModuleIds),
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
      },
    });

    return result;
  };
