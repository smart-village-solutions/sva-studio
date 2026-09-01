import { evaluatePluginTenantAccess } from '@sva/plugin-sdk';

import { readInstanceRegistryPluginTenantLifecycleRegistry } from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
import { withRegistryRepository } from '../iam-instance-registry/repository.js';
import { readConfiguredPluginTenantReadiness } from './read-model.js';

export type ConfiguredPluginTenantAccessDecision =
  | Readonly<{ allowed: true; reason: 'not_managed' | 'ready' | 'degraded' }>
  | ReturnType<typeof evaluatePluginTenantAccess>;

export const readConfiguredPluginTenantAccess = async (
  instanceId: string,
  pluginId: string
): Promise<ConfiguredPluginTenantAccessDecision> => {
  const activation = await withRegistryRepository((repository) =>
    repository.getModuleActivationPolicy(instanceId, pluginId)
  );
  if (activation?.effectiveActive !== true) {
    return evaluatePluginTenantAccess(null);
  }
  if (!readInstanceRegistryPluginTenantLifecycleRegistry().has(pluginId)) {
    return { allowed: true, reason: 'not_managed' };
  }
  const readiness = (await readConfiguredPluginTenantReadiness(instanceId)).find(
    (model) => model.pluginId === pluginId
  );
  return evaluatePluginTenantAccess(readiness ?? null);
};

export const isConfiguredPluginTenantEffectivelyActive = async (
  instanceId: string,
  pluginId: string
): Promise<boolean> =>
  withRegistryRepository(async (repository) => {
    const activation = await repository.getModuleActivationPolicy(instanceId, pluginId);
    return activation?.effectiveActive === true;
  });

export const filterConfiguredPluginTenantAccessibleModules = async (
  instanceId: string,
  assignedModules: readonly string[]
): Promise<readonly string[]> =>
  (await resolveConfiguredPluginTenantModuleAccess(instanceId, assignedModules)).accessibleModules;

export type ConfiguredPluginTenantModuleAccess = Readonly<{
  accessibleModules: readonly string[];
  hasPendingLifecycleAccess: boolean;
}>;

export const resolveConfiguredPluginTenantModuleAccess = async (
  instanceId: string,
  assignedModules: readonly string[]
): Promise<ConfiguredPluginTenantModuleAccess> => {
  const lifecycleRegistry = readInstanceRegistryPluginTenantLifecycleRegistry();
  const managedModules = assignedModules.filter((moduleId) => lifecycleRegistry.has(moduleId));
  if (managedModules.length === 0) {
    return { accessibleModules: assignedModules, hasPendingLifecycleAccess: false };
  }
  const readinessByPluginId = new Map(
    (await readConfiguredPluginTenantReadiness(instanceId)).map((model) => [model.pluginId, model])
  );
  const decisions = new Map(
    managedModules.map((moduleId) => [
      moduleId,
      evaluatePluginTenantAccess(readinessByPluginId.get(moduleId) ?? null),
    ])
  );
  return {
    accessibleModules: assignedModules.filter(
      (moduleId) => !lifecycleRegistry.has(moduleId) || decisions.get(moduleId)?.allowed === true
    ),
    hasPendingLifecycleAccess: [...decisions.values()].some(
      (decision) => !decision.allowed && decision.reason === 'pending'
    ),
  };
};

export const isConfiguredPluginTenantLifecycleJobType = (
  pluginId: string,
  jobTypeId: string
): boolean =>
  readInstanceRegistryPluginTenantLifecycleRegistry()
    .get(pluginId)
    ?.operations.some((operation) => operation.jobTypeId === jobTypeId) === true;
