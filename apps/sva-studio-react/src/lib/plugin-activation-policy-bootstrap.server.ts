import { createHash } from 'node:crypto';

import {
  SSF_TENANT_OIDC_CLIENT_REQUIREMENT,
  readSsfLoginClientRequirement,
} from '@sva/plugin-ssf/provisioning';

let configuredRevision: string | undefined;
let reconciledRevision: string | undefined;
let latestConfiguration: PluginActivationPolicyConfiguration | undefined;
let configurationPromise: Promise<PluginActivationPolicyConfiguration> | undefined;
let reconciliationPromise: Promise<void> | undefined;
let reconciliationRetryRevision: string | undefined;
let reconciliationRetryAfterMs = 0;
let reconciliationRetryTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
let reconciliationFailureState: FleetReconcileFailureState | undefined;
let bootstrapGeneration = 0;

const retryableFleetReconcileDelaysMs = [60_000, 300_000, 900_000] as const;
const degradedFleetReconcileDelayMs = 1_800_000;

type AuthRuntime = typeof import('@sva/auth-runtime/server');
type PluginActivationPolicyConfiguration = Readonly<{
  authRuntime: AuthRuntime;
  revision: string;
}>;
type FleetReconcileRetryClass = 'retryable' | 'degraded';
type FleetReconcileFailureState = Readonly<{
  revision: string;
  signature: string;
  retryClass: FleetReconcileRetryClass;
  retryDelayIndex: number;
  retryDelayMs: number;
  reasonCodes: readonly string[];
  startedAtMs: number;
}>;

const configurePluginActivationPolicies =
  async (): Promise<PluginActivationPolicyConfiguration> => {
    const [{ studioHostModuleIamContracts, studioPluginSnapshot }, authRuntime] = await Promise.all(
      [import('./plugins'), import('@sva/auth-runtime/server')]
    );
    const activationPolicies = studioPluginSnapshot.tenantActivationPolicySnapshot;
    const pluginOidcClientRequirements = studioPluginSnapshot.pluginSources.some(
      ({ pluginId }) => pluginId === SSF_TENANT_OIDC_CLIENT_REQUIREMENT.pluginId
    )
      ? [
          SSF_TENANT_OIDC_CLIENT_REQUIREMENT,
          ...[readSsfLoginClientRequirement()].filter((entry) => entry !== null),
        ]
      : [];
    const revision = pluginOidcClientRequirements.length
      ? `${activationPolicies.revision}:oidc:${createHash('sha256')
          .update(JSON.stringify(pluginOidcClientRequirements))
          .digest('hex')}`
      : activationPolicies.revision;
    if (configuredRevision !== revision) {
      authRuntime.configureInstanceRegistryPluginRuntimeSnapshot({
        activationPolicies,
        pluginOidcClientRequirements,
        tenantLifecycles: studioPluginSnapshot.registry.tenantLifecycles,
        moduleIamContracts: [
          ...studioPluginSnapshot.registry.pluginModuleIamContracts,
          ...studioHostModuleIamContracts,
        ],
      });
      configuredRevision = revision;
    }
    const configuration = { authRuntime, revision };
    latestConfiguration = configuration;
    return configuration;
  };

const logReconcileFailure = async (
  level: 'info' | 'warn' | 'error',
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

const resolveFleetFailure = (
  report: Awaited<
    ReturnType<AuthRuntime['reconcileConfiguredPluginActivationPoliciesForAllInstances']>
  >
): Readonly<{
  retryClass: FleetReconcileRetryClass;
  reasonCodes: readonly string[];
  signature: string;
}> => {
  const retryClass = report.failures.some((failure) => failure.retryClass === 'retryable')
    ? 'retryable'
    : 'degraded';
  const reasonCodes = [
    ...new Set(report.failures.map((failure) => failure.reasonCode).filter(Boolean)),
  ].sort();
  const signature = report.failures
    .map(
      (failure) =>
        `${failure.instanceId ?? '-'}:${failure.stage}:${failure.reasonCode}:${failure.retryClass}`
    )
    .sort()
    .join('|');
  return { retryClass, reasonCodes, signature };
};

const updateFleetFailureState = (input: {
  revision: string;
  retryClass: FleetReconcileRetryClass;
  reasonCodes: readonly string[];
  signature: string;
}): Readonly<{ state: FleetReconcileFailureState; shouldWarn: boolean }> => {
  const previous = reconciliationFailureState;
  const sameFailure =
    previous?.revision === input.revision &&
    previous.signature === input.signature &&
    previous.retryClass === input.retryClass;
  const retryDelayIndex =
    input.retryClass === 'retryable' && sameFailure
      ? Math.min(previous.retryDelayIndex + 1, retryableFleetReconcileDelaysMs.length - 1)
      : 0;
  const retryDelayMs =
    input.retryClass === 'retryable'
      ? retryableFleetReconcileDelaysMs[retryDelayIndex]
      : degradedFleetReconcileDelayMs;
  const state = Object.freeze({
    ...input,
    retryDelayIndex,
    retryDelayMs,
    startedAtMs: sameFailure ? previous.startedAtMs : Date.now(),
  });
  reconciliationFailureState = state;
  return {
    state,
    shouldWarn: !sameFailure || previous.retryDelayMs !== retryDelayMs,
  };
};

const scheduleFleetReconcileRetry = (
  configuration: PluginActivationPolicyConfiguration,
  generation: number,
  retryDelayMs: number
): void => {
  if (generation !== bootstrapGeneration) return;
  if (reconciliationRetryTimer) globalThis.clearTimeout(reconciliationRetryTimer);

  reconciliationRetryRevision = configuration.revision;
  reconciliationRetryAfterMs = Date.now() + retryDelayMs;
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
  }, retryDelayMs);
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
          const recoveredFailure = reconciliationFailureState;
          reconciledRevision = revision;
          clearFleetReconcileRetry();
          reconciliationFailureState = undefined;
          if (recoveredFailure?.revision === revision) {
            await logReconcileFailure(
              'info',
              'Plugin activation policy fleet reconcile recovered',
              {
                revision,
                previous_retry_class: recoveredFailure.retryClass,
                previous_reason_codes: recoveredFailure.reasonCodes,
                degraded_duration_ms: Math.max(0, Date.now() - recoveredFailure.startedAtMs),
              }
            );
          }
        }
        return;
      }
      if (generation !== bootstrapGeneration) return;
      const failure = resolveFleetFailure(report);
      const decision = updateFleetFailureState({ revision, ...failure });
      scheduleFleetReconcileRetry(configuration, generation, decision.state.retryDelayMs);
      if (decision.shouldWarn) {
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
            reason_codes: decision.state.reasonCodes,
            retry_class: decision.state.retryClass,
            retry_delay_ms: decision.state.retryDelayMs,
          }
        );
      }
    } catch (error) {
      if (generation !== bootstrapGeneration) return;
      const decision = updateFleetFailureState({
        revision,
        retryClass: 'degraded',
        reasonCodes: ['plugin_activation_policy_reconcile_unknown'],
        signature: 'plugin_activation_policy_reconcile_unknown:degraded',
      });
      scheduleFleetReconcileRetry(configuration, generation, decision.state.retryDelayMs);
      if (decision.shouldWarn) {
        await logReconcileFailure(
          'error',
          'Plugin activation policy fleet reconcile failed unexpectedly',
          {
            revision,
            error_type: error instanceof Error ? error.name : typeof error,
            retry_class: decision.state.retryClass,
            retry_delay_ms: decision.state.retryDelayMs,
          }
        );
      }
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
  reconciliationFailureState = undefined;
};
