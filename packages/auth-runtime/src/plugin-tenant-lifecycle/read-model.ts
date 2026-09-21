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

export const readProvisioningModuleReadiness = async (input: {
  instanceId: string;
  lifecycles: readonly PluginTenantLifecycleRegistryEntry[];
}) => {
  if (input.lifecycles.length === 0) throw new Error('provisioning_plugin_snapshot_missing');
  const models = await readConfiguredPluginTenantReadiness(input.instanceId, input.lifecycles);
  if (models.length !== input.lifecycles.length) {
    throw new Error('provisioning_plugin_activation_missing');
  }
  const evidence = {
    modules: models.map((model) => ({
      pluginId: model.pluginId,
      status: model.status,
      evidenceState: model.evidenceState,
      revision: model.revision,
      errorCode: model.error?.code,
    })),
  };
  const terminalModel = models.find(
    (model) =>
      model.error?.retryKind === 'terminal' ||
      (model.status === 'blocked' && model.error?.retryKind !== 'retryable')
  );
  if (terminalModel) {
    return {
      status: 'blocked' as const,
      evidence,
      errorCode: terminalModel.error?.code,
    };
  }
  if (models.some((model) => model.status !== 'ready' || model.evidenceState !== 'valid')) {
    return { status: 'pending' as const, evidence };
  }
  return { status: 'ready' as const, evidence };
};
