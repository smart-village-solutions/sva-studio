let configuredRevision: string | undefined;
let configurationPromise: Promise<void> | undefined;

export const ensurePluginActivationPoliciesConfigured = async (): Promise<void> => {
  configurationPromise ??= (async () => {
    const [{ studioHostModuleIamContracts, studioPluginSnapshot }, authRuntime] = await Promise.all(
      [import('./plugins'), import('@sva/auth-runtime/server')]
    );
    const activationPolicies = studioPluginSnapshot.tenantActivationPolicySnapshot;
    if (configuredRevision === activationPolicies.revision) {
      return;
    }
    authRuntime.configureInstanceRegistryPluginRuntimeSnapshot({
      activationPolicies,
      tenantLifecycles: studioPluginSnapshot.registry.tenantLifecycles,
      moduleIamContracts: [
        ...studioPluginSnapshot.registry.pluginModuleIamContracts,
        ...studioHostModuleIamContracts,
      ],
    });
    const reconcileReport =
      await authRuntime.reconcileConfiguredPluginActivationPoliciesForAllInstances({
        revision: activationPolicies.revision,
      });
    if (reconcileReport.status === 'degraded') {
      const { createSdkLogger } = await import('@sva/server-runtime');
      createSdkLogger({ component: 'plugin-activation-policy-bootstrap' }).warn(
        'Plugin activation policy fleet reconcile completed with failures',
        {
          revision: reconcileReport.revision,
          instance_count: reconcileReport.instanceCount,
          reconciled_instance_count: reconcileReport.reconciledInstanceCount,
          failed_instance_ids: reconcileReport.failures.flatMap((failure) =>
            failure.instanceId ? [failure.instanceId] : []
          ),
          failure_stages: reconcileReport.failures.map((failure) => failure.stage),
        }
      );
    }
    if (reconcileReport.status === 'ready') {
      configuredRevision = activationPolicies.revision;
    }
  })().finally(() => {
    configurationPromise = undefined;
  });

  await configurationPromise;
};

export const resetPluginActivationPolicyBootstrapForTests = (): void => {
  configuredRevision = undefined;
  configurationPromise = undefined;
};
