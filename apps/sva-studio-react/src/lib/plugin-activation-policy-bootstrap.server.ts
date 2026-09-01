let configuredRevision: string | undefined;
let reconciledRevision: string | undefined;
let latestConfiguration: PluginActivationPolicyConfiguration | undefined;
let configurationPromise: Promise<PluginActivationPolicyConfiguration> | undefined;
let reconciliationPromise: Promise<void> | undefined;
let reconciliationRetryRevision: string | undefined;
let reconciliationRetryAfterMs = 0;
let reconciliationRetryTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
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
    const configuration = { authRuntime, revision: activationPolicies.revision };
    latestConfiguration = configuration;
    return configuration;
  };

const logReconcileFailure = async (
  level: 'warn' | 'error',
  message: string,
  metadata: Record<string, unknown>
): Promise<void> => {
  const { createSdkLogger } = await import('@sva/server-runtime');
  createSdkLogger({ component: 'plugin-activation-policy-bootstrap' })[level](message, metadata);
};

const clearFleetReconcileRetry = (): void => {
  if (reconciliationRetryTimer) {
    globalThis.clearTimeout(reconciliationRetryTimer);
    reconciliationRetryTimer = undefined;
  }
  reconciliationRetryRevision = undefined;
  reconciliationRetryAfterMs = 0;
};

const scheduleFleetReconcileRetry = (
  configuration: PluginActivationPolicyConfiguration,
  generation: number
): void => {
  if (generation !== bootstrapGeneration) return;
  if (reconciliationRetryTimer) globalThis.clearTimeout(reconciliationRetryTimer);

  reconciliationRetryRevision = configuration.revision;
  reconciliationRetryAfterMs = Date.now() + fleetReconcileRetryDelayMs;
  reconciliationRetryTimer = globalThis.setTimeout(() => {
    reconciliationRetryTimer = undefined;
    if (
      generation !== bootstrapGeneration ||
      reconciliationRetryRevision !== configuration.revision
    ) {
      return;
    }
    reconciliationRetryAfterMs = 0;
    startFleetReconcileInBackground(configuration);
  }, fleetReconcileRetryDelayMs);
  reconciliationRetryTimer.unref?.();
};

const startFleetReconcileInBackground = (
  configuration: PluginActivationPolicyConfiguration
): void => {
  const { authRuntime, revision } = configuration;
  if (reconciledRevision === revision || reconciliationPromise) return;
  if (reconciliationRetryRevision === revision && Date.now() < reconciliationRetryAfterMs) return;
  if (reconciliationRetryRevision && reconciliationRetryRevision !== revision) {
    clearFleetReconcileRetry();
  }
  const generation = bootstrapGeneration;
  reconciliationPromise = (async () => {
    try {
      const report = await authRuntime.reconcileConfiguredPluginActivationPoliciesForAllInstances({
        revision,
      });
      if (report.status === 'ready') {
        if (generation === bootstrapGeneration) {
          reconciledRevision = revision;
          clearFleetReconcileRetry();
        }
        return;
      }
      scheduleFleetReconcileRetry(configuration, generation);
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
      scheduleFleetReconcileRetry(configuration, generation);
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
  if (latestConfiguration) {
    startFleetReconcileInBackground(latestConfiguration);
    return;
  }
  void configurePluginActivationPolicies().then(startFleetReconcileInBackground);
};

export const resetPluginActivationPolicyBootstrapForTests = (): void => {
  bootstrapGeneration += 1;
  clearFleetReconcileRetry();
  configuredRevision = undefined;
  reconciledRevision = undefined;
  latestConfiguration = undefined;
  configurationPromise = undefined;
  reconciliationPromise = undefined;
};
