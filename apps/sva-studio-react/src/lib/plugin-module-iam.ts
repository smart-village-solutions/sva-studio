import type { PluginModuleIamRegistryEntry } from '@sva/plugin-sdk';
import type { StudioModuleIamContract } from '@sva/studio-module-iam';

export type StudioModuleCatalogEntry = Pick<
  StudioModuleIamContract,
  | 'moduleId'
  | 'descriptionKey'
  | 'permissionIds'
  | 'systemRoles'
  | 'systemAdminPermissionExclusions'
>;
export const createStudioModuleIamContracts = (
  pluginContracts: readonly PluginModuleIamRegistryEntry[],
  hostContracts: readonly StudioModuleIamContract[]
): readonly StudioModuleCatalogEntry[] => [
  ...pluginContracts.map((contract) => ({
    moduleId: contract.moduleId,
    descriptionKey: `plugins.${contract.ownerPluginId}.description`,
    permissionIds: contract.permissionIds,
    systemRoles: contract.systemRoles,
    ...(contract.systemAdminPermissionExclusions
      ? { systemAdminPermissionExclusions: contract.systemAdminPermissionExclusions }
      : {}),
  })),
  ...hostContracts,
];
