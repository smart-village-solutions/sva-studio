import { metrics } from '@opentelemetry/api';
import { createSdkLogger } from '@sva/server-runtime';

import { resolvePool } from '../db.js';

export const pluginTenantLifecycleStallReasons = [
  'stale_claim',
  'queued_due',
  'retry_due',
  'pending_recheck_due',
  'generation_without_owner',
] as const;

export const pluginTenantLifecycleLaneStatuses = [
  'idle',
  'starting',
  'running',
  'stopped',
  'failed',
  'disabled',
] as const;

export const pluginTenantLifecycleLaneFailureReasons = [
  'studio_job_worker_not_started',
  'studio_job_worker_starting',
  'studio_job_worker_connection_failed',
  'studio_job_worker_claim_failed',
  'studio_job_worker_runtime_failed',
  'studio_job_worker_maintenance_failed',
  'studio_job_worker_start_failed',
  'studio_job_worker_stopped',
  'privileged_studio_job_worker_not_started',
  'privileged_studio_job_worker_starting',
  'privileged_studio_job_worker_connection_failed',
  'privileged_studio_job_worker_claim_failed',
  'privileged_studio_job_worker_runtime_failed',
  'privileged_studio_job_worker_maintenance_failed',
  'privileged_studio_job_worker_start_failed',
  'privileged_studio_job_worker_stopped',
] as const;

type StallReason = (typeof pluginTenantLifecycleStallReasons)[number];
type Lane = 'default' | 'privileged';
type LaneStatus = (typeof pluginTenantLifecycleLaneStatuses)[number];
type LaneFailureReason = (typeof pluginTenantLifecycleLaneFailureReasons)[number];
type StallSnapshot = Record<StallReason, number>;

export type PluginTenantLifecycleLaneHealth = {
  readonly ready: boolean;
  readonly reasonCode?: string;
  readonly status: LaneStatus;
};

type LaneSnapshot = PluginTenantLifecycleLaneHealth & {
  readonly lastSuccessAtMs: number | null;
};

type StallRow = {
  readonly reason_code: string;
  readonly stall_count: string | number;
};

const stallReasonSet = new Set<string>(pluginTenantLifecycleStallReasons);
const laneFailureReasonSet = new Set<string>(pluginTenantLifecycleLaneFailureReasons);
const logger = createSdkLogger({
  component: 'plugin-tenant-lifecycle-observability',
  level: 'info',
});
const meter = metrics.getMeter('sva.plugin-tenant-lifecycle');

const stallGauge = meter.createObservableGauge('sva_plugin_tenant_lifecycle_stall_count', {
  description: 'Fleet-wide plugin tenant lifecycle stalls grouped by a bounded reason code.',
});
const observationFailureGauge = meter.createObservableGauge(
  'sva_plugin_tenant_lifecycle_observation_failure',
  { description: 'Whether the fleet-wide lifecycle snapshot could be collected.' }
);
const laneReadyGauge = meter.createObservableGauge('sva_plugin_tenant_lifecycle_lane_ready', {
  description: 'Whether this process owns a ready Studio job worker lane.',
});
const laneStatusGauge = meter.createObservableGauge('sva_plugin_tenant_lifecycle_lane_status', {
  description: 'One-hot worker status for this process and lane.',
});
const laneFailureGauge = meter.createObservableGauge('sva_plugin_tenant_lifecycle_lane_failure', {
  description: 'One-hot bounded worker failure reason for this process and lane.',
});
const laneSecondsSinceSuccessGauge = meter.createObservableGauge(
  'sva_plugin_tenant_lifecycle_lane_seconds_since_success',
  {
    description:
      'Seconds since the latest successful processing on this process and lane; -1 means none observed.',
  }
);

const laneSnapshots: Record<Lane, LaneSnapshot> = {
  default: {
    ready: false,
    reasonCode: 'studio_job_worker_not_started',
    status: 'idle',
    lastSuccessAtMs: null,
  },
  privileged: {
    ready: false,
    reasonCode: 'privileged_studio_job_worker_not_started',
    status: 'idle',
    lastSuccessAtMs: null,
  },
};

const emptyStallSnapshot = (): StallSnapshot => ({
  stale_claim: 0,
  queued_due: 0,
  retry_due: 0,
  pending_recheck_due: 0,
  generation_without_owner: 0,
});

export const readPluginTenantLifecycleStallSnapshot = async (): Promise<StallSnapshot> => {
  const pool = resolvePool();
  if (!pool) throw new Error('plugin_tenant_lifecycle_observability_database_unavailable');
  const result = await pool.query<StallRow>(
    'SELECT reason_code, stall_count FROM iam.plugin_tenant_lifecycle_observability_snapshot();'
  );
  const snapshot = emptyStallSnapshot();
  for (const row of result.rows) {
    if (!stallReasonSet.has(row.reason_code)) {
      throw new Error('plugin_tenant_lifecycle_observability_reason_invalid');
    }
    const count = Number(row.stall_count);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error('plugin_tenant_lifecycle_observability_count_invalid');
    }
    snapshot[row.reason_code as StallReason] = count;
  }
  return snapshot;
};

meter.addBatchObservableCallback(
  async (result) => {
    const poolAvailable = resolvePool() !== null;
    try {
      const snapshot = await readPluginTenantLifecycleStallSnapshot();
      for (const reasonCode of pluginTenantLifecycleStallReasons) {
        result.observe(stallGauge, snapshot[reasonCode], { reason_code: reasonCode });
      }
      result.observe(observationFailureGauge, 0, { reason_code: 'database_unavailable' });
      result.observe(observationFailureGauge, 0, { reason_code: 'database_query_failed' });
    } catch (error) {
      const reasonCode = poolAvailable ? 'database_query_failed' : 'database_unavailable';
      result.observe(observationFailureGauge, reasonCode === 'database_unavailable' ? 1 : 0, {
        reason_code: 'database_unavailable',
      });
      result.observe(observationFailureGauge, reasonCode === 'database_query_failed' ? 1 : 0, {
        reason_code: 'database_query_failed',
      });
      logger.warn('plugin_tenant_lifecycle_observability_query_failed', {
        operation: 'plugin_tenant_lifecycle_observability_snapshot',
        dependency: 'database',
        reason_code: reasonCode,
        error_type: error instanceof Error ? error.name : typeof error,
      });
    }
  },
  [stallGauge, observationFailureGauge]
);

const ownLane = (): Lane =>
  process.env.SVA_PLUGIN_OPERATION_WORKER_LANE === 'privileged' ? 'privileged' : 'default';

const readOwnLaneSnapshot = (): LaneSnapshot => {
  const lane = ownLane();
  if (process.env.SVA_PLUGIN_OPERATION_WORKER_ENABLED === 'false') {
    return { ready: true, status: 'disabled', lastSuccessAtMs: null };
  }
  return laneSnapshots[lane];
};

laneReadyGauge.addCallback((result) => {
  const lane = ownLane();
  result.observe(readOwnLaneSnapshot().ready ? 1 : 0, { lane });
});

laneStatusGauge.addCallback((result) => {
  const lane = ownLane();
  const snapshot = readOwnLaneSnapshot();
  for (const status of pluginTenantLifecycleLaneStatuses) {
    result.observe(snapshot.status === status ? 1 : 0, { lane, status });
  }
});

laneFailureGauge.addCallback((result) => {
  const lane = ownLane();
  const snapshot = readOwnLaneSnapshot();
  for (const reasonCode of pluginTenantLifecycleLaneFailureReasons) {
    result.observe(snapshot.reasonCode === reasonCode ? 1 : 0, {
      lane,
      reason_code: reasonCode,
    });
  }
});

laneSecondsSinceSuccessGauge.addCallback((result) => {
  const lane = ownLane();
  const lastSuccessAtMs = readOwnLaneSnapshot().lastSuccessAtMs;
  result.observe(
    lastSuccessAtMs === null ? -1 : Math.max(0, (Date.now() - lastSuccessAtMs) / 1_000),
    {
      lane,
    }
  );
});

export const recordPluginTenantLifecycleLaneHealth = (
  lane: Lane,
  health: PluginTenantLifecycleLaneHealth
): void => {
  const reasonCode =
    health.reasonCode && laneFailureReasonSet.has(health.reasonCode)
      ? (health.reasonCode as LaneFailureReason)
      : undefined;
  laneSnapshots[lane] = {
    ready: health.ready,
    status: health.status,
    ...(reasonCode ? { reasonCode } : {}),
    lastSuccessAtMs: laneSnapshots[lane].lastSuccessAtMs,
  };
};

export const recordPluginTenantLifecycleLaneSuccess = (
  lane: Lane,
  observedAtMs = Date.now()
): void => {
  laneSnapshots[lane] = { ...laneSnapshots[lane], lastSuccessAtMs: observedAtMs };
};

export const readPluginTenantLifecycleLaneSnapshot = (lane: Lane): LaneSnapshot => ({
  ...laneSnapshots[lane],
});
