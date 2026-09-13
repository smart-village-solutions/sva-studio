import { metrics } from '@opentelemetry/api';

import {
  readInstanceRegistryPluginRuntimeSnapshotGeneration,
  withCapturedInstanceRegistryPluginRuntimeSnapshot,
} from './plugin-activation-policy-snapshot.js';
import { withRegistryService, withScopedRegistryService } from './repository.js';

export const pluginActivationPolicyFleetReconcileReasonCodes = [
  'plugin_activation_policy_reconcile_unknown',
  'plugin_activation_state_conflict',
  'plugin_tenant_lifecycle_schedule_exhausted',
  'waste_tenant_role_privilege_drift',
] as const;

export type PluginActivationPolicyFleetReconcileReasonCode =
  (typeof pluginActivationPolicyFleetReconcileReasonCodes)[number];

export type PluginActivationPolicyFleetReconcileRetryClass = 'retryable' | 'degraded';

export type PluginActivationPolicyFleetReconcileFailure = Readonly<{
  instanceId?: string;
  stage: 'list_instances' | 'reconcile_instance';
  code: 'plugin_activation_policy_reconcile_failed';
  reasonCode: PluginActivationPolicyFleetReconcileReasonCode;
  retryClass: PluginActivationPolicyFleetReconcileRetryClass;
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
let lastSuccessfulReconcileAtMs: number | undefined;
let fleetMetricsOwnedByProcess = false;

const fleetStates = ['unknown', 'ready', 'retrying', 'degraded'] as const;
const retryClasses = ['retryable', 'degraded'] as const;
const meter = metrics.getMeter('sva.plugin-activation-policy');
const fleetStateGauge = meter.createObservableGauge('sva_plugin_activation_policy_fleet_state', {
  description: 'One-hot state of the latest plugin activation policy fleet reconcile.',
});
const fleetFailureGauge = meter.createObservableGauge(
  'sva_plugin_activation_policy_fleet_failure_count',
  { description: 'Current fleet reconcile failures grouped by bounded reason and retry class.' }
);
const fleetSecondsSinceSuccessGauge = meter.createObservableGauge(
  'sva_plugin_activation_policy_fleet_seconds_since_success',
  { description: 'Seconds since the latest successful fleet reconcile; -1 means none observed.' }
);

const readFleetState = (): (typeof fleetStates)[number] => {
  if (!lastReport) return 'unknown';
  if (lastReport.status === 'ready') return 'ready';
  return lastReport.failures.some(({ retryClass }) => retryClass === 'retryable')
    ? 'retrying'
    : 'degraded';
};

fleetStateGauge.addCallback((result) => {
  if (!fleetMetricsOwnedByProcess) return;
  const state = readFleetState();
  for (const candidate of fleetStates) {
    result.observe(candidate === state ? 1 : 0, { state: candidate });
  }
});

fleetFailureGauge.addCallback((result) => {
  if (!fleetMetricsOwnedByProcess) return;
  for (const reasonCode of pluginActivationPolicyFleetReconcileReasonCodes) {
    for (const retryClass of retryClasses) {
      const failureCount =
        lastReport?.failures.filter(
          (failure) => failure.reasonCode === reasonCode && failure.retryClass === retryClass
        ).length ?? 0;
      result.observe(failureCount, { reason_code: reasonCode, retry_class: retryClass });
    }
  }
});

fleetSecondsSinceSuccessGauge.addCallback((result) => {
  if (!fleetMetricsOwnedByProcess) return;
  result.observe(
    lastSuccessfulReconcileAtMs === undefined
      ? -1
      : Math.max(0, (Date.now() - lastSuccessfulReconcileAtMs) / 1_000)
  );
});

const errorClassifications = Object.freeze({
  plugin_activation_state_conflict: {
    reasonCode: 'plugin_activation_state_conflict',
    retryClass: 'retryable',
  },
  plugin_tenant_lifecycle_schedule_exhausted: {
    reasonCode: 'plugin_tenant_lifecycle_schedule_exhausted',
    retryClass: 'retryable',
  },
  waste_tenant_role_privilege_drift: {
    reasonCode: 'waste_tenant_role_privilege_drift',
    retryClass: 'degraded',
  },
} satisfies Readonly<
  Record<
    Exclude<
      PluginActivationPolicyFleetReconcileReasonCode,
      'plugin_activation_policy_reconcile_unknown'
    >,
    Readonly<{
      reasonCode: PluginActivationPolicyFleetReconcileReasonCode;
      retryClass: PluginActivationPolicyFleetReconcileRetryClass;
    }>
  >
>);

const classifyFleetReconcileError = (
  error: unknown
): Readonly<{
  reasonCode: PluginActivationPolicyFleetReconcileReasonCode;
  retryClass: PluginActivationPolicyFleetReconcileRetryClass;
}> => {
  const separatorIndex = error instanceof Error ? error.message.indexOf(':') : -1;
  const stableCode =
    error instanceof Error
      ? error.message.slice(0, separatorIndex === -1 ? undefined : separatorIndex)
      : '';
  const classification = Object.prototype.hasOwnProperty.call(errorClassifications, stableCode)
    ? errorClassifications[stableCode as keyof typeof errorClassifications]
    : undefined;
  return (
    classification ?? {
      reasonCode: 'plugin_activation_policy_reconcile_unknown',
      retryClass: 'degraded',
    }
  );
};

const reconcileCapturedPluginActivationPoliciesForAllInstances = async (
  input: { revision: string },
  runtimeSnapshotGeneration: number
): Promise<PluginActivationPolicyFleetReconcileReport> => {
  const startedAt = new Date().toISOString();
  let instanceCount = 0;
  let reconciledInstanceCount = 0;
  const failures: PluginActivationPolicyFleetReconcileFailure[] = [];

  try {
    const instances = await withRegistryService((service) => service.listInstances());
    instanceCount = instances.length;
    for (const instance of instances) {
      try {
        await withScopedRegistryService(instance.instanceId, async () => undefined, {
          forceIamSync: true,
          awaitActivationPolicyFollowUp: true,
        });
        reconciledInstanceCount += 1;
      } catch (error) {
        failures.push({
          instanceId: instance.instanceId,
          stage: 'reconcile_instance',
          code: 'plugin_activation_policy_reconcile_failed',
          ...classifyFleetReconcileError(error),
        });
      }
    }
  } catch (error) {
    failures.push({
      stage: 'list_instances',
      code: 'plugin_activation_policy_reconcile_failed',
      ...classifyFleetReconcileError(error),
    });
  }

  const report = Object.freeze({
    revision: input.revision,
    status: failures.length === 0 ? 'ready' : 'degraded',
    startedAt,
    completedAt: new Date().toISOString(),
    instanceCount,
    reconciledInstanceCount,
    failures: Object.freeze(failures.map((failure) => Object.freeze({ ...failure }))),
  });
  if (runtimeSnapshotGeneration === readInstanceRegistryPluginRuntimeSnapshotGeneration()) {
    lastReport = report;
    if (report.status === 'ready') lastSuccessfulReconcileAtMs = Date.now();
  }
  return report;
};

export const reconcileConfiguredPluginActivationPoliciesForAllInstances = (input: {
  revision: string;
}): Promise<PluginActivationPolicyFleetReconcileReport> => {
  fleetMetricsOwnedByProcess = true;
  return withCapturedInstanceRegistryPluginRuntimeSnapshot((runtimeSnapshotGeneration) =>
    reconcileCapturedPluginActivationPoliciesForAllInstances(input, runtimeSnapshotGeneration)
  );
};

export const readPluginActivationPolicyFleetReconcileReport = ():
  PluginActivationPolicyFleetReconcileReport | undefined => lastReport;

export const recordUnexpectedPluginActivationPolicyFleetReconcileFailure = (input: {
  revision: string;
}): PluginActivationPolicyFleetReconcileReport => {
  fleetMetricsOwnedByProcess = true;
  const timestamp = new Date().toISOString();
  lastReport = Object.freeze({
    revision: input.revision,
    status: 'degraded',
    startedAt: timestamp,
    completedAt: timestamp,
    instanceCount: 0,
    reconciledInstanceCount: 0,
    failures: Object.freeze([
      Object.freeze({
        stage: 'list_instances',
        code: 'plugin_activation_policy_reconcile_failed',
        reasonCode: 'plugin_activation_policy_reconcile_unknown',
        retryClass: 'degraded',
      }),
    ]),
  });
  return lastReport;
};

export const resetPluginActivationPolicyFleetReconcileReportForTests = (): void => {
  lastReport = undefined;
  lastSuccessfulReconcileAtMs = undefined;
  fleetMetricsOwnedByProcess = false;
};
