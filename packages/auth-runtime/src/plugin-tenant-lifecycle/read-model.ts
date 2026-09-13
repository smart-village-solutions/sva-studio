import { createPluginTenantReadinessReadModel } from '@sva/plugin-sdk';

import type { PluginTenantLifecycleRegistryEntry } from '@sva/plugin-sdk';
import { readInstanceRegistryPluginTenantLifecycleRegistry } from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
import { withRegistryRepository } from '../iam-instance-registry/repository.js';
import { withPluginTenantLifecycleRepository } from '../plugin-operations/repository.js';

export const readConfiguredPluginTenantReadiness = async (
  instanceId: string,
  definitions: readonly PluginTenantLifecycleRegistryEntry[] = [
    ...readInstanceRegistryPluginTenantLifecycleRegistry().values(),
  ]
) => {
  const [activations, lifecycleRecords] = await Promise.all([
    withRegistryRepository((repository) => repository.listModuleActivations(instanceId)),
    withPluginTenantLifecycleRepository(instanceId, (repository) =>
      repository.listLifecycles(instanceId)
    ),
  ]);
  const activationsByPluginId = new Map(
    activations.map((activation) => [activation.moduleId, activation])
  );
  const lifecycleByPluginId = new Map(
    lifecycleRecords.map((lifecycle) => [lifecycle.pluginId, lifecycle])
  );

  return definitions
    .map((definition) => {
      const activation = activationsByPluginId.get(definition.pluginId);
      if (!activation) {
        return null;
      }
      return createPluginTenantReadinessReadModel({
        definition,
        activation,
        evidence: lifecycleByPluginId.get(definition.pluginId),
      });
    })
    .filter((model) => model !== null)
    .sort((left, right) => left.pluginId.localeCompare(right.pluginId));
};
