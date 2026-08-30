import { withRegistryService } from './repository.js';

export type PluginActivationPolicyFleetReconcileFailure = Readonly<{
  instanceId?: string;
  stage: 'list_instances' | 'reconcile_instance';
  code: 'plugin_activation_policy_reconcile_failed';
}>;

export type PluginActivationPolicyFleetReconcileReport = Readonly<{
  revision: string;
  status: 'ready' | 'degraded';
  startedAt: string;
  completedAt: string;
  instanceCount: number;
  reconciledInstanceCount: number;
  failures: readonly PluginActivationPolicyFleetReconcileFailure[];
}>;

let lastReport: PluginActivationPolicyFleetReconcileReport | undefined;

export const reconcileConfiguredPluginActivationPoliciesForAllInstances = async (input: {
  revision: string;
}): Promise<PluginActivationPolicyFleetReconcileReport> => {
  const startedAt = new Date().toISOString();
  let instanceCount = 0;
  let reconciledInstanceCount = 0;
  const failures: PluginActivationPolicyFleetReconcileFailure[] = [];

  try {
    await withRegistryService(async (service) => {
      const instances = await service.listInstances();
      instanceCount = instances.length;

      for (const instance of instances) {
        try {
          await service.reconcileModuleActivationPolicies({ instanceId: instance.instanceId });
          reconciledInstanceCount += 1;
        } catch {
          failures.push({
            instanceId: instance.instanceId,
            stage: 'reconcile_instance',
            code: 'plugin_activation_policy_reconcile_failed',
          });
        }
      }
    });
  } catch {
    failures.push({
      stage: 'list_instances',
      code: 'plugin_activation_policy_reconcile_failed',
    });
  }

  lastReport = Object.freeze({
    revision: input.revision,
    status: failures.length === 0 ? 'ready' : 'degraded',
    startedAt,
    completedAt: new Date().toISOString(),
    instanceCount,
    reconciledInstanceCount,
    failures: Object.freeze(failures.map((failure) => Object.freeze({ ...failure }))),
  });
  return lastReport;
};

export const readPluginActivationPolicyFleetReconcileReport = ():
  PluginActivationPolicyFleetReconcileReport | undefined => lastReport;

export const resetPluginActivationPolicyFleetReconcileReportForTests = (): void => {
  lastReport = undefined;
};
