import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import type {
  PluginTenantAccessState,
  PluginTenantLifecycleOperation,
  PluginTenantLifecycleRecord,
  PluginTenantLifecycleRetryKind,
  PluginTenantReadinessStatus,
} from './types.js';

type PluginTenantLifecycleRow = {
  readonly instance_id: string;
  readonly plugin_id: string;
  readonly access_state: PluginTenantAccessState;
  readonly readiness_status: PluginTenantReadinessStatus;
  readonly desired_operation: PluginTenantLifecycleOperation;
  readonly desired_generation: string | number;
  readonly completed_generation: string | number;
  readonly claimed_generation: string | number | null;
  readonly active_job_id: string | null;
  readonly readiness_revision: string | null;
  readonly readiness_checks: readonly Readonly<Record<string, unknown>>[];
  readonly error_code: string | null;
  readonly retry_kind: PluginTenantLifecycleRetryKind | null;
  readonly retry_after: Date | string | null;
  readonly requested_at: Date | string;
  readonly started_at: Date | string | null;
  readonly completed_at: Date | string | null;
  readonly updated_at: Date | string;
};

export const lifecycleStatement = (text: string, values: SqlStatement['values']): SqlStatement => ({
  text,
  values,
});

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapRow = (row: PluginTenantLifecycleRow): PluginTenantLifecycleRecord => ({
  instanceId: row.instance_id,
  pluginId: row.plugin_id,
  accessState: row.access_state,
  readinessStatus: row.readiness_status,
  desiredOperation: row.desired_operation,
  desiredGeneration: Number(row.desired_generation),
  completedGeneration: Number(row.completed_generation),
  ...(row.claimed_generation === null ? {} : { claimedGeneration: Number(row.claimed_generation) }),
  ...(row.active_job_id ? { activeJobId: row.active_job_id } : {}),
  ...(row.readiness_revision ? { readinessRevision: row.readiness_revision } : {}),
  readinessChecks: row.readiness_checks,
  ...(row.error_code ? { errorCode: row.error_code } : {}),
  ...(row.retry_kind ? { retryKind: row.retry_kind } : {}),
  ...(row.retry_after ? { retryAfter: toIso(row.retry_after) } : {}),
  requestedAt: toIso(row.requested_at),
  ...(row.started_at ? { startedAt: toIso(row.started_at) } : {}),
  ...(row.completed_at ? { completedAt: toIso(row.completed_at) } : {}),
  updatedAt: toIso(row.updated_at),
});

export const readLifecycleRow = async (
  executor: SqlExecutor,
  sql: SqlStatement
): Promise<PluginTenantLifecycleRecord | null> => {
  const result = await executor.execute<PluginTenantLifecycleRow>(sql);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

export const readLifecycleRows = async (
  executor: SqlExecutor,
  sql: SqlStatement
): Promise<readonly PluginTenantLifecycleRecord[]> => {
  const result = await executor.execute<PluginTenantLifecycleRow>(sql);
  return result.rows.map(mapRow);
};
