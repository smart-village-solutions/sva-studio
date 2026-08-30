import type { SqlExecutor } from '../iam/repositories/types.js';
import { lifecycleStatement, readLifecycleRow, readLifecycleRows } from './shared.js';
import type { PluginTenantLifecycleRepository } from './types.js';

const createRequestLifecycle =
  (executor: SqlExecutor): PluginTenantLifecycleRepository['requestLifecycle'] =>
  async (input) => {
    const record = await readLifecycleRow(
      executor,
      lifecycleStatement(
        `
INSERT INTO iam.instance_plugin_lifecycle (
  instance_id, plugin_id, access_state, readiness_status, desired_operation,
  desired_generation, completed_generation, requested_at, updated_at
)
VALUES ($1, $2, CASE WHEN $3 = 'suspend' THEN 'suspended' ELSE 'active' END,
  'pending', $3, 1, 0, NOW(), NOW())
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
    if (!record) throw new Error('plugin_tenant_lifecycle_request_not_persisted');
    return record;
  };

const createClaimLifecycle =
  (executor: SqlExecutor): PluginTenantLifecycleRepository['claimLifecycle'] =>
  (input) =>
    readLifecycleRow(
      executor,
      lifecycleStatement(
        `
UPDATE iam.instance_plugin_lifecycle
SET claimed_generation = $4, active_job_id = $3::uuid, started_at = NOW(),
    completed_at = NULL, updated_at = NOW()
WHERE instance_id = $1 AND plugin_id = $2 AND desired_generation = $4
  AND desired_operation = $5 AND (active_job_id IS NULL OR active_job_id = $3::uuid)
RETURNING *;
`,
        [input.instanceId, input.pluginId, input.jobId, input.generation, input.operation]
      )
    );

const createCompleteLifecycle =
  (executor: SqlExecutor): PluginTenantLifecycleRepository['completeLifecycle'] =>
  (input) =>
    readLifecycleRow(
      executor,
      lifecycleStatement(
        `
UPDATE iam.instance_plugin_lifecycle
SET access_state = CASE WHEN $5 = 'suspend' THEN 'suspended'
      WHEN $5 = 'reactivate' THEN 'active' ELSE access_state END,
    readiness_status = $6, completed_generation = $4, claimed_generation = NULL,
    active_job_id = NULL, readiness_revision = $7, readiness_checks = $8::jsonb,
    error_code = NULL, retry_kind = NULL, retry_after = NULL,
    completed_at = NOW(), updated_at = NOW()
WHERE instance_id = $1 AND plugin_id = $2 AND active_job_id = $3::uuid
  AND claimed_generation = $4 AND desired_generation = $4 AND desired_operation = $5
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

const createFailLifecycle =
  (executor: SqlExecutor): PluginTenantLifecycleRepository['failLifecycle'] =>
  (input) =>
    readLifecycleRow(
      executor,
      lifecycleStatement(
        `
UPDATE iam.instance_plugin_lifecycle
SET readiness_status = $5, claimed_generation = NULL, active_job_id = NULL,
    error_code = $6, retry_kind = $7, retry_after = $8::timestamptz,
    completed_at = NOW(), updated_at = NOW()
WHERE instance_id = $1 AND plugin_id = $2 AND active_job_id = $3::uuid
  AND claimed_generation = $4 AND desired_generation = $4
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

export const createPluginTenantLifecycleRepository = (
  executor: SqlExecutor
): PluginTenantLifecycleRepository => ({
  requestLifecycle: createRequestLifecycle(executor),
  getLifecycle: (instanceId, pluginId) =>
    readLifecycleRow(
      executor,
      lifecycleStatement(
        'SELECT * FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2;',
        [instanceId, pluginId]
      )
    ),
  listLifecycles: (instanceId) =>
    readLifecycleRows(
      executor,
      lifecycleStatement(
        'SELECT * FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 ORDER BY plugin_id ASC;',
        [instanceId]
      )
    ),
  claimLifecycle: createClaimLifecycle(executor),
  completeLifecycle: createCompleteLifecycle(executor),
  failLifecycle: createFailLifecycle(executor),
});
