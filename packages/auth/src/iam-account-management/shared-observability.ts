import { createSdkLogger } from '@sva/sdk/server';
import { metrics } from '@opentelemetry/api';
import { resolvePool } from './shared-runtime.js';

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
const instanceAdminClientDriftByInstance = new Map<string, { drift: number; reason: string }>();
const INSTANCE_ADMIN_CLIENT_DRIFT_REFRESH_INTERVAL_MS = 30_000;

let instanceAdminClientDriftLastRefreshAt = 0;
let instanceAdminClientDriftRefreshPromise: Promise<void> | null = null;

iamRoleDriftBacklogGauge.addCallback((result) => {
  for (const [instanceId, backlog] of roleDriftBacklogByInstance.entries()) {
    result.observe(backlog, { instance_id: instanceId });
  }
});

const instanceAdminClientDriftGauge = meter.createObservableGauge('sva_instance_admin_client_drift', {
  description:
    'Drift state for active tenant instances where the tenant admin client contract is incomplete (1=drift, 0=aligned).',
});

type InstanceAdminClientDriftRow = {
  readonly instance_id: string;
  readonly drift: number;
  readonly reason: string;
};

const refreshInstanceAdminClientDriftSnapshotInternal = async (): Promise<void> => {
  const pool = resolvePool();
  if (!pool) {
    instanceAdminClientDriftByInstance.clear();
    return;
  }

  const query = await pool.query<InstanceAdminClientDriftRow>(`
    SELECT
      id AS instance_id,
      CASE
        WHEN tenant_admin_client_id IS NULL OR btrim(tenant_admin_client_id) = '' THEN 1
        WHEN tenant_admin_client_secret_ciphertext IS NULL OR btrim(tenant_admin_client_secret_ciphertext) = '' THEN 1
        ELSE 0
      END AS drift,
      CASE
        WHEN tenant_admin_client_id IS NULL OR btrim(tenant_admin_client_id) = '' THEN 'missing_client'
        WHEN tenant_admin_client_secret_ciphertext IS NULL OR btrim(tenant_admin_client_secret_ciphertext) = '' THEN 'missing_secret'
        ELSE 'aligned'
      END AS reason
    FROM iam.instances
    WHERE status = 'active'
  `);

  const next = new Map<string, { drift: number; reason: string }>();
  for (const row of query.rows) {
    next.set(row.instance_id, {
      drift: Number(row.drift) > 0 ? 1 : 0,
      reason: row.reason,
    });
  }

  instanceAdminClientDriftByInstance.clear();
  for (const [instanceId, entry] of next.entries()) {
    instanceAdminClientDriftByInstance.set(instanceId, entry);
  }
};

export const refreshInstanceAdminClientDriftSnapshot = async (force = false): Promise<void> => {
  const now = Date.now();
  if (!force && now - instanceAdminClientDriftLastRefreshAt < INSTANCE_ADMIN_CLIENT_DRIFT_REFRESH_INTERVAL_MS) {
    return;
  }
  if (instanceAdminClientDriftRefreshPromise) {
    return instanceAdminClientDriftRefreshPromise;
  }

  instanceAdminClientDriftRefreshPromise = refreshInstanceAdminClientDriftSnapshotInternal()
    .catch((error) => {
      logger.warn('instance_admin_client_drift_metric_refresh_failed', {
        operation: 'refresh_instance_admin_client_drift_metric',
        dependency: 'database',
        error_type: error instanceof Error ? error.name : typeof error,
      });
    })
    .finally(() => {
      instanceAdminClientDriftLastRefreshAt = Date.now();
      instanceAdminClientDriftRefreshPromise = null;
    });

  return instanceAdminClientDriftRefreshPromise;
};

instanceAdminClientDriftGauge.addCallback((result) => {
  void refreshInstanceAdminClientDriftSnapshot();
  for (const [instanceId, entry] of instanceAdminClientDriftByInstance.entries()) {
    result.observe(entry.drift, {
      instance_id: instanceId,
      drift_reason: entry.reason,
    });
  }
});

void refreshInstanceAdminClientDriftSnapshot(true);

export const setRoleDriftBacklog = (instanceId: string, backlog: number): void => {
  roleDriftBacklogByInstance.set(instanceId, backlog);
};

export const resetInstanceAdminClientDriftSnapshotForTest = (): void => {
  instanceAdminClientDriftByInstance.clear();
  instanceAdminClientDriftLastRefreshAt = 0;
  instanceAdminClientDriftRefreshPromise = null;
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
