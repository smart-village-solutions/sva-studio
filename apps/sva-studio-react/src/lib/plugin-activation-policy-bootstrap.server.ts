let configuredRevision: string | undefined;
let reconciledRevision: string | undefined;
let configurationPromise: Promise<PluginActivationPolicyConfiguration> | undefined;
let reconciliationPromise: Promise<void> | undefined;
let reconciliationRetryRevision: string | undefined;
let reconciliationRetryAfterMs = 0;
let bootstrapGeneration = 0;

const fleetReconcileRetryDelayMs = 60_000;

type AuthRuntime = typeof import('@sva/auth-runtime/server');
type PluginActivationPolicyConfiguration = Readonly<{
  authRuntime: AuthRuntime;
  revision: string;
}>;

const configurePluginActivationPolicies =
  async (): Promise<PluginActivationPolicyConfiguration> => {
    const [{ studioHostModuleIamContracts, studioPluginSnapshot }, authRuntime] = await Promise.all(
      [import('./plugins'), import('@sva/auth-runtime/server')]
    );
    const activationPolicies = studioPluginSnapshot.tenantActivationPolicySnapshot;
    if (configuredRevision !== activationPolicies.revision) {
      authRuntime.configureInstanceRegistryPluginRuntimeSnapshot({
        activationPolicies,
        tenantLifecycles: studioPluginSnapshot.registry.tenantLifecycles,
        moduleIamContracts: [
          ...studioPluginSnapshot.registry.pluginModuleIamContracts,
          ...studioHostModuleIamContracts,
        ],
      });
      configuredRevision = activationPolicies.revision;
    }
    return { authRuntime, revision: activationPolicies.revision };
  };

const logReconcileFailure = async (
  level: 'warn' | 'error',
  message: string,
  metadata: Record<string, unknown>
): Promise<void> => {
  const { createSdkLogger } = await import('@sva/server-runtime');
  createSdkLogger({ component: 'plugin-activation-policy-bootstrap' })[level](message, metadata);
};

const startFleetReconcileInBackground = ({
  authRuntime,
  revision,
}: PluginActivationPolicyConfiguration): void => {
  if (reconciledRevision === revision || reconciliationPromise) return;
  if (reconciliationRetryRevision === revision && Date.now() < reconciliationRetryAfterMs) return;
  const generation = bootstrapGeneration;
  reconciliationPromise = (async () => {
    try {
      const report = await authRuntime.reconcileConfiguredPluginActivationPoliciesForAllInstances({
        revision,
      });
      if (report.status === 'ready') {
        if (generation === bootstrapGeneration) {
          reconciledRevision = revision;
          reconciliationRetryRevision = undefined;
          reconciliationRetryAfterMs = 0;
        }
        return;
      }
      if (generation === bootstrapGeneration) {
        reconciliationRetryRevision = revision;
        reconciliationRetryAfterMs = Date.now() + fleetReconcileRetryDelayMs;
      }
      await logReconcileFailure(
        'warn',
        'Plugin activation policy fleet reconcile completed with failures',
        {
          revision: report.revision,
          instance_count: report.instanceCount,
          reconciled_instance_count: report.reconciledInstanceCount,
          failed_instance_ids: report.failures.flatMap((failure) =>
            failure.instanceId ? [failure.instanceId] : []
          ),
          failure_stages: report.failures.map((failure) => failure.stage),
        }
      );
    } catch (error) {
      if (generation === bootstrapGeneration) {
        reconciliationRetryRevision = revision;
        reconciliationRetryAfterMs = Date.now() + fleetReconcileRetryDelayMs;
      }
      await logReconcileFailure(
        'error',
        'Plugin activation policy fleet reconcile failed unexpectedly',
        {
          revision,
          error_type: error instanceof Error ? error.name : typeof error,
        }
      );
    }
  })().finally(() => {
    if (generation === bootstrapGeneration) reconciliationPromise = undefined;
  });
};

export const ensurePluginActivationPoliciesConfigured = async (): Promise<void> => {
  configurationPromise ??= configurePluginActivationPolicies().finally(() => {
    configurationPromise = undefined;
  });
  await configurationPromise;
};

export const startPluginActivationPolicyFleetReconcileInBackground = (): void => {
  void configurePluginActivationPolicies().then(startFleetReconcileInBackground);
};

export const resetPluginActivationPolicyBootstrapForTests = (): void => {
  bootstrapGeneration += 1;
  configuredRevision = undefined;
  reconciledRevision = undefined;
  configurationPromise = undefined;
  reconciliationPromise = undefined;
  reconciliationRetryRevision = undefined;
  reconciliationRetryAfterMs = 0;
};
