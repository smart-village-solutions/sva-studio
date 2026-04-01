import { createSdkLogger } from '@sva/sdk/server';
import { metrics } from '@opentelemetry/api';

export const logger: ReturnType<typeof createSdkLogger> = createSdkLogger({
  component: 'iam-service',
  level: 'info',
});

const meter = metrics.getMeter('sva.iam.service');

export const iamUserOperationsCounter = meter.createCounter('iam_user_operations_total', {
  description: 'Counter for IAM user and role operations.',
});

const iamKeycloakRequestLatency = meter.createHistogram('iam_keycloak_request_duration_seconds', {
  description: 'Latency for outbound Keycloak admin operations.',
  unit: 's',
});

export const iamRoleSyncCounter = meter.createCounter('iam_role_sync_operations_total', {
  description: 'Role catalog sync operations grouped by operation, result and error code.',
});

const iamRoleDriftBacklogGauge = meter.createObservableGauge('iam_role_drift_backlog', {
  description: 'Latest known drift backlog per instance from role catalog reconciliation.',
});

const roleDriftBacklogByInstance = new Map<string, number>();

iamRoleDriftBacklogGauge.addCallback((result) => {
  for (const [instanceId, backlog] of roleDriftBacklogByInstance.entries()) {
    result.observe(backlog, { instance_id: instanceId });
  }
});

export const setRoleDriftBacklog = (instanceId: string, backlog: number): void => {
  roleDriftBacklogByInstance.set(instanceId, backlog);
};

export const trackKeycloakCall = async <T>(operation: string, execute: () => Promise<T>): Promise<T> => {
  const startedAt = Date.now();
  try {
    const result = await execute();
    iamKeycloakRequestLatency.record((Date.now() - startedAt) / 1000, { operation, result: 'success' });
    return result;
  } catch (error) {
    iamKeycloakRequestLatency.record((Date.now() - startedAt) / 1000, { operation, result: 'failure' });
    throw error;
  }
};
