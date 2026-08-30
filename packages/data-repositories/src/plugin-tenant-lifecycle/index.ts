import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';

export type PluginTenantLifecycleOperation =
  'provision' | 'reconcile' | 'suspend' | 'reactivate' | 'readiness';
export type PluginTenantReadinessStatus = 'pending' | 'ready' | 'degraded' | 'blocked';
export type PluginTenantAccessState = 'active' | 'suspended';
export type PluginTenantLifecycleRetryKind = 'terminal' | 'retryable';

export type PluginTenantLifecycleRecord = {
  readonly instanceId: string;
  readonly pluginId: string;
  readonly accessState: PluginTenantAccessState;
  readonly readinessStatus: PluginTenantReadinessStatus;
  readonly desiredOperation: PluginTenantLifecycleOperation;
  readonly desiredGeneration: number;
  readonly completedGeneration: number;
  readonly claimedGeneration?: number;
  readonly activeJobId?: string;
  readonly readinessRevision?: string;
  readonly readinessChecks: readonly Readonly<Record<string, unknown>>[];
  readonly errorCode?: string;
  readonly retryKind?: PluginTenantLifecycleRetryKind;
  readonly retryAfter?: string;
  readonly requestedAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly updatedAt: string;
};

export type PluginTenantLifecycleRepository = {
  readonly requestLifecycle: (input: {
    readonly instanceId: string;
    readonly pluginId: string;
    readonly operation: PluginTenantLifecycleOperation;
  }) => Promise<PluginTenantLifecycleRecord>;
  readonly getLifecycle: (
    instanceId: string,
    pluginId: string
  ) => Promise<PluginTenantLifecycleRecord | null>;
  readonly listLifecycles: (instanceId: string) => Promise<readonly PluginTenantLifecycleRecord[]>;
  readonly claimLifecycle: (input: {
    readonly instanceId: string;
    readonly pluginId: string;
    readonly jobId: string;
    readonly generation: number;
    readonly operation: PluginTenantLifecycleOperation;
  }) => Promise<PluginTenantLifecycleRecord | null>;
  readonly completeLifecycle: (input: {
    readonly instanceId: string;
    readonly pluginId: string;
    readonly jobId: string;
    readonly generation: number;
    readonly operation: PluginTenantLifecycleOperation;
    readonly readinessStatus: PluginTenantReadinessStatus;
    readonly readinessRevision: string;
    readonly readinessChecks: readonly Readonly<Record<string, unknown>>[];
  }) => Promise<PluginTenantLifecycleRecord | null>;
  readonly failLifecycle: (input: {
    readonly instanceId: string;
    readonly pluginId: string;
    readonly jobId: string;
    readonly generation: number;
    readonly readinessStatus: Extract<PluginTenantReadinessStatus, 'degraded' | 'blocked'>;
    readonly errorCode: string;
    readonly retryKind: PluginTenantLifecycleRetryKind;
    readonly retryAfter?: string;
  }) => Promise<PluginTenantLifecycleRecord | null>;
};

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

const statement = (text: string, values: SqlStatement['values']): SqlStatement => ({
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

const readOptionalRow = async (
  executor: SqlExecutor,
  sql: SqlStatement
): Promise<PluginTenantLifecycleRecord | null> => {
  const result = await executor.execute<PluginTenantLifecycleRow>(sql);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
};

export const createPluginTenantLifecycleRepository = (
  executor: SqlExecutor
): PluginTenantLifecycleRepository => ({
  async requestLifecycle(input) {
    const record = await readOptionalRow(
      executor,
      statement(
        `
INSERT INTO iam.instance_plugin_lifecycle (
  instance_id,
  plugin_id,
  access_state,
  readiness_status,
  desired_operation,
  desired_generation,
  completed_generation,
  requested_at,
  updated_at
)
VALUES (
  $1,
  $2,
  CASE WHEN $3 = 'suspend' THEN 'suspended' ELSE 'active' END,
  'pending',
  $3,
  1,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (instance_id, plugin_id) DO UPDATE
SET access_state = CASE
      WHEN EXCLUDED.desired_operation = 'suspend' THEN 'suspended'
      ELSE iam.instance_plugin_lifecycle.access_state
    END,
    readiness_status = 'pending',
    desired_operation = EXCLUDED.desired_operation,
    desired_generation = iam.instance_plugin_lifecycle.desired_generation + 1,
    claimed_generation = NULL,
    active_job_id = NULL,
    error_code = NULL,
    retry_kind = NULL,
    retry_after = NULL,
    requested_at = NOW(),
    started_at = NULL,
    completed_at = NULL,
    updated_at = NOW()
RETURNING *;
`,
        [input.instanceId, input.pluginId, input.operation]
      )
    );
    if (!record) {
      throw new Error('plugin_tenant_lifecycle_request_not_persisted');
    }
    return record;
  },

  getLifecycle(instanceId, pluginId) {
    return readOptionalRow(
      executor,
      statement(
        'SELECT * FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2;',
        [instanceId, pluginId]
      )
    );
  },

  async listLifecycles(instanceId) {
    const result = await executor.execute<PluginTenantLifecycleRow>(
      statement(
        'SELECT * FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 ORDER BY plugin_id ASC;',
        [instanceId]
      )
    );
    return result.rows.map(mapRow);
  },

  claimLifecycle(input) {
    return readOptionalRow(
      executor,
      statement(
        `
UPDATE iam.instance_plugin_lifecycle
SET claimed_generation = $4,
    active_job_id = $3::uuid,
    started_at = NOW(),
    completed_at = NULL,
    updated_at = NOW()
WHERE instance_id = $1
  AND plugin_id = $2
  AND desired_generation = $4
  AND desired_operation = $5
  AND (active_job_id IS NULL OR active_job_id = $3::uuid)
RETURNING *;
`,
        [input.instanceId, input.pluginId, input.jobId, input.generation, input.operation]
      )
    );
  },

  completeLifecycle(input) {
    return readOptionalRow(
      executor,
      statement(
        `
UPDATE iam.instance_plugin_lifecycle
SET access_state = CASE
      WHEN $5 = 'suspend' THEN 'suspended'
      WHEN $5 = 'reactivate' THEN 'active'
      ELSE access_state
    END,
    readiness_status = $6,
    completed_generation = $4,
    claimed_generation = NULL,
    active_job_id = NULL,
    readiness_revision = $7,
    readiness_checks = $8::jsonb,
    error_code = NULL,
    retry_kind = NULL,
    retry_after = NULL,
    completed_at = NOW(),
    updated_at = NOW()
WHERE instance_id = $1
  AND plugin_id = $2
  AND active_job_id = $3::uuid
  AND claimed_generation = $4
  AND desired_generation = $4
  AND desired_operation = $5
RETURNING *;
`,
        [
          input.instanceId,
          input.pluginId,
          input.jobId,
          input.generation,
          input.operation,
          input.readinessStatus,
          input.readinessRevision,
          JSON.stringify(input.readinessChecks),
        ]
      )
    );
  },

  failLifecycle(input) {
    return readOptionalRow(
      executor,
      statement(
        `
UPDATE iam.instance_plugin_lifecycle
SET readiness_status = $5,
    claimed_generation = NULL,
    active_job_id = NULL,
    error_code = $6,
    retry_kind = $7,
    retry_after = $8::timestamptz,
    completed_at = NOW(),
    updated_at = NOW()
WHERE instance_id = $1
  AND plugin_id = $2
  AND active_job_id = $3::uuid
  AND claimed_generation = $4
  AND desired_generation = $4
RETURNING *;
`,
        [
          input.instanceId,
          input.pluginId,
          input.jobId,
          input.generation,
          input.readinessStatus,
          input.errorCode,
          input.retryKind,
          input.retryAfter ?? null,
        ]
      )
    );
  },
});
