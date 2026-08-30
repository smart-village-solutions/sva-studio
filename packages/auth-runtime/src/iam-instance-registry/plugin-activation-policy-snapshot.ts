import type { TenantModuleActivationPolicySnapshot } from '@sva/core';

export type InstanceRegistryModuleIamSnapshotEntry = Readonly<{
  moduleId: string;
  permissionIds: readonly string[];
  tenantBootstrapRoles?: readonly Readonly<{
    roleName: string;
    permissionIds: readonly string[];
  }>[];
  rootSystemRoles?: readonly Readonly<{
    roleName: string;
    permissionIds: readonly string[];
  }>[];
  systemRoles?: readonly Readonly<{
    roleName: string;
    permissionIds: readonly string[];
  }>[];
  systemAdminPermissionExclusions?: readonly string[];
}>;

const emptySnapshot: TenantModuleActivationPolicySnapshot = Object.freeze({
  revision: '',
  modules: Object.freeze([]),
});

let configuredSnapshot = emptySnapshot;
let configuredModuleIamRegistry: ReadonlyMap<string, InstanceRegistryModuleIamSnapshotEntry> =
  new Map();

const copySnapshot = (
  snapshot: TenantModuleActivationPolicySnapshot
): TenantModuleActivationPolicySnapshot => {
  const modules = [...snapshot.modules]
    .map((module) => Object.freeze({ ...module }))
    .sort((left, right) => left.moduleId.localeCompare(right.moduleId, 'de'));
  const duplicateModuleId = modules.find(
    (module, index) => index > 0 && modules[index - 1]?.moduleId === module.moduleId
  )?.moduleId;
  if (duplicateModuleId) {
    throw new Error(`plugin_activation_policy_duplicate_module:${duplicateModuleId}`);
  }

  return Object.freeze({
    revision: snapshot.revision,
    modules: Object.freeze(modules),
  });
};

export const configureInstanceRegistryPluginActivationPolicies = (
  snapshot: TenantModuleActivationPolicySnapshot
): void => {
  configuredSnapshot = copySnapshot(snapshot);
};

const copyModuleIamRegistry = (
  contracts: readonly InstanceRegistryModuleIamSnapshotEntry[]
): ReadonlyMap<string, InstanceRegistryModuleIamSnapshotEntry> => {
  const registry = new Map<string, InstanceRegistryModuleIamSnapshotEntry>();
  for (const contract of contracts) {
    if (registry.has(contract.moduleId)) {
      throw new Error(`plugin_module_iam_duplicate_module:${contract.moduleId}`);
    }
    registry.set(
      contract.moduleId,
      Object.freeze({
        ...contract,
        permissionIds: Object.freeze([...contract.permissionIds]),
        ...(contract.tenantBootstrapRoles
          ? {
              tenantBootstrapRoles: Object.freeze(
                contract.tenantBootstrapRoles.map((role) =>
                  Object.freeze({
                    ...role,
                    permissionIds: Object.freeze([...role.permissionIds]),
                  })
                )
              ),
            }
          : {}),
        ...(contract.rootSystemRoles
          ? {
              rootSystemRoles: Object.freeze(
                contract.rootSystemRoles.map((role) =>
                  Object.freeze({
                    ...role,
                    permissionIds: Object.freeze([...role.permissionIds]),
                  })
                )
              ),
            }
          : {}),
        ...(contract.systemRoles
          ? {
              systemRoles: Object.freeze(
                contract.systemRoles.map((role) =>
                  Object.freeze({
                    ...role,
                    permissionIds: Object.freeze([...role.permissionIds]),
                  })
                )
              ),
            }
          : {}),
        ...(contract.systemAdminPermissionExclusions
          ? {
              systemAdminPermissionExclusions: Object.freeze([
                ...contract.systemAdminPermissionExclusions,
              ]),
            }
          : {}),
      })
    );
  }
  return registry;
};

export const configureInstanceRegistryPluginRuntimeSnapshot = (input: {
  activationPolicies: TenantModuleActivationPolicySnapshot;
  moduleIamContracts: readonly InstanceRegistryModuleIamSnapshotEntry[];
}): void => {
  const activationPolicies = copySnapshot(input.activationPolicies);
  const moduleIamRegistry = copyModuleIamRegistry(input.moduleIamContracts);

  configuredSnapshot = activationPolicies;
  configuredModuleIamRegistry = moduleIamRegistry;
};

export const readInstanceRegistryPluginActivationPolicies =
  (): TenantModuleActivationPolicySnapshot => configuredSnapshot;

export const readInstanceRegistryModuleIamRegistry = (): ReadonlyMap<
  string,
  InstanceRegistryModuleIamSnapshotEntry
> => configuredModuleIamRegistry;

export const resetInstanceRegistryPluginActivationPoliciesForTests = (): void => {
  configuredSnapshot = emptySnapshot;
  configuredModuleIamRegistry = new Map();
};
