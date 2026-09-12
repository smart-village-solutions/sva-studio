import type { SqlExecutor } from '../iam/repositories/types.js';

import type { InstanceRegistryRepository } from './repository-contract.js';
import { mapAuditEvent, mapProvisioningRun } from './repository-mappers.js';
import { getRoleReconcileSummary } from './repository-role-reconcile.js';
import { queryRows, statement } from './repository-shared.js';
import type { AuditRow, ProvisioningRow } from './repository-types.js';

type ProvisioningRepository = Pick<
  InstanceRegistryRepository,
  | 'listProvisioningRuns'
  | 'listLatestProvisioningRuns'
  | 'listAuditEvents'
  | 'getLatestTenantIamAccessProbe'
  | 'getRoleReconcileSummary'
  | 'createProvisioningRun'
  | 'claimNextProvisioningRun'
  | 'updateProvisioningRun'
  | 'retryProvisioningRun'
  | 'appendAuditEvent'
>;

const provisioningColumns = `
  id::text, instance_id, operation, status, step_key, idempotency_key, payload_fingerprint,
  snapshot_version, desired_snapshot, child_keycloak_run_id::text, lease_owner,
  lease_expires_at::text, attempt_count, next_attempt_at::text, deadline_at::text,
  terminal_evidence, completed_at::text, error_code, error_message, request_id, actor_id,
  created_at::text, updated_at::text`;

const listProvisioningRuns = async (executor: SqlExecutor, instanceId: string) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
SELECT
  ${provisioningColumns}
FROM iam.instance_provisioning_runs
WHERE instance_id = $1
ORDER BY created_at DESC, id DESC;
`,
      [instanceId]
    )
  );
  return rows.map(mapProvisioningRun);
};

const listLatestProvisioningRuns = async (
  executor: SqlExecutor,
  instanceIds: readonly string[]
) => {
  if (instanceIds.length === 0) {
    return {};
  }
  const placeholders = instanceIds.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
SELECT DISTINCT ON (instance_id)
  ${provisioningColumns}
FROM iam.instance_provisioning_runs
WHERE instance_id IN (${placeholders})
ORDER BY instance_id ASC, created_at DESC, id DESC;
`,
      [...instanceIds]
    )
  );
  return Object.fromEntries(rows.map((row) => [row.instance_id, mapProvisioningRun(row)] as const));
};

const listAuditEvents = async (executor: SqlExecutor, instanceId: string) => {
  const rows = await queryRows<AuditRow>(
    executor,
    statement(
      `
SELECT id::text, instance_id, event_type, actor_id, request_id, details, created_at::text
FROM iam.instance_audit_events
WHERE instance_id = $1
ORDER BY created_at DESC, id DESC;
`,
      [instanceId]
    )
  );
  return rows.map(mapAuditEvent);
};

const getLatestTenantIamAccessProbe = async (executor: SqlExecutor, instanceId: string) => {
  const rows = await queryRows<{
    checked_at: string;
    status: 'ready' | 'degraded' | 'blocked' | 'unknown';
    summary: string;
    error_code: string | null;
    request_id: string | null;
  }>(
    executor,
    statement(
      `
SELECT
  created_at::text AS checked_at,
  COALESCE(details->>'status', 'unknown') AS status,
  COALESCE(details->>'summary', 'Keine Rechteprobe vorhanden.') AS summary,
  details->>'errorCode' AS error_code,
  COALESCE(details->>'requestId', request_id) AS request_id
FROM iam.instance_audit_events
WHERE instance_id = $1
  AND event_type = 'tenant_iam_access_probed'
ORDER BY created_at DESC, id DESC
LIMIT 1;
`,
      [instanceId]
    )
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    checkedAt: row.checked_at,
    status: row.status,
    summary: row.summary,
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.request_id ? { requestId: row.request_id } : {}),
  };
};

const createProvisioningRun = async (
  executor: SqlExecutor,
  input: Parameters<ProvisioningRepository['createProvisioningRun']>[0]
) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
INSERT INTO iam.instance_provisioning_runs (
  instance_id, operation, status, step_key, idempotency_key, payload_fingerprint,
  snapshot_version, desired_snapshot, deadline_at,
  error_code, error_message, request_id, actor_id, completed_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, COALESCE($9::timestamptz, now() + INTERVAL '30 minutes'),
  $10, $11, $12, $13,
  CASE WHEN $3 IN ('active', 'failed', 'suspended', 'archived') THEN now() ELSE NULL END)
ON CONFLICT (instance_id, operation, idempotency_key) DO UPDATE
SET status = EXCLUDED.status,
    step_key = EXCLUDED.step_key,
    error_code = EXCLUDED.error_code,
    error_message = EXCLUDED.error_message,
    request_id = COALESCE(EXCLUDED.request_id, iam.instance_provisioning_runs.request_id),
    actor_id = COALESCE(EXCLUDED.actor_id, iam.instance_provisioning_runs.actor_id),
    completed_at = EXCLUDED.completed_at,
    updated_at = now()
WHERE iam.instance_provisioning_runs.payload_fingerprint IS NOT DISTINCT FROM EXCLUDED.payload_fingerprint
RETURNING
  ${provisioningColumns};
`,
      [
        input.instanceId,
        input.operation,
        input.status,
        input.stepKey ?? null,
        input.idempotencyKey,
        input.payloadFingerprint ?? null,
        input.snapshotVersion ?? 'legacy',
        JSON.stringify(input.desiredSnapshot ?? {}),
        input.deadlineAt ?? null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.requestId ?? null,
        input.actorId ?? null,
      ]
    )
  );
  const row = rows[0];
  if (!row) throw new Error('idempotency_key_reuse');
  return mapProvisioningRun(row);
};

const claimNextProvisioningRun = async (
  executor: SqlExecutor,
  input: Parameters<ProvisioningRepository['claimNextProvisioningRun']>[0]
) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
WITH candidate AS (
  SELECT run.id AS candidate_run_id
  FROM iam.instance_provisioning_runs AS run
  JOIN iam.instances AS instance ON instance.id = run.instance_id
  WHERE run.operation = 'create'
    AND run.snapshot_version = '2.0'
    AND run.status IN ('requested', 'validated', 'provisioning')
    AND instance.parent_domain = $3
    AND run.next_attempt_at <= now()
    AND (run.lease_expires_at IS NULL OR run.lease_expires_at <= now())
  ORDER BY run.next_attempt_at ASC, run.created_at ASC, run.id ASC
  FOR UPDATE OF run SKIP LOCKED
  LIMIT 1
)
UPDATE iam.instance_provisioning_runs AS run
SET status = 'provisioning', lease_owner = $1, lease_expires_at = $2::timestamptz,
    attempt_count = run.attempt_count + 1, updated_at = now()
FROM candidate
WHERE run.id = candidate.candidate_run_id
RETURNING ${provisioningColumns};
`,
      [input.workerId, input.leaseExpiresAt, input.parentDomain]
    )
  );
  return rows[0] ? mapProvisioningRun(rows[0]) : null;
};

const updateProvisioningRun = async (
  executor: SqlExecutor,
  input: Parameters<ProvisioningRepository['updateProvisioningRun']>[0]
) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
UPDATE iam.instance_provisioning_runs
SET status = $3, step_key = $4,
    child_keycloak_run_id = COALESCE($5::uuid, child_keycloak_run_id),
    next_attempt_at = COALESCE($6::timestamptz, next_attempt_at),
    error_code = $7, error_message = $8,
    terminal_evidence = terminal_evidence || COALESCE($9::jsonb, '{}'::jsonb),
    completed_at = $10::timestamptz,
    lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
WHERE id = $1::uuid AND lease_owner = $2
RETURNING ${provisioningColumns};
`,
      [
        input.runId,
        input.leaseOwner,
        input.status,
        input.stepKey,
        input.childKeycloakRunId ?? null,
        input.nextAttemptAt ?? null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.terminalEvidence ? JSON.stringify(input.terminalEvidence) : null,
        input.completedAt ?? null,
      ]
    )
  );
  return rows[0] ? mapProvisioningRun(rows[0]) : null;
};

const retryProvisioningRun = async (
  executor: SqlExecutor,
  input: Parameters<ProvisioningRepository['retryProvisioningRun']>[0]
) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
UPDATE iam.instance_provisioning_runs
SET status = 'requested', step_key = 'registry', child_keycloak_run_id = NULL,
    lease_owner = NULL, lease_expires_at = NULL, next_attempt_at = now(),
    deadline_at = $5::timestamptz, completed_at = NULL,
    error_code = NULL, error_message = NULL,
    actor_id = COALESCE($3, actor_id), request_id = COALESCE($4, request_id), updated_at = now()
WHERE instance_id = $1 AND operation = 'create' AND idempotency_key = $2
  AND snapshot_version = '2.0' AND status = 'failed'
RETURNING ${provisioningColumns};
`,
      [
        input.instanceId,
        input.idempotencyKey,
        input.actorId ?? null,
        input.requestId ?? null,
        input.deadlineAt,
      ]
    )
  );
  return rows[0] ? mapProvisioningRun(rows[0]) : null;
};

const appendAuditEvent = async (
  executor: SqlExecutor,
  input: Parameters<ProvisioningRepository['appendAuditEvent']>[0]
): Promise<void> => {
  await executor.execute({
    text: `
INSERT INTO iam.instance_audit_events (instance_id, event_type, actor_id, request_id, details)
VALUES ($1, $2, $3, $4, $5::jsonb);
`,
    values: [
      input.instanceId,
      input.eventType,
      input.actorId ?? null,
      input.requestId ?? null,
      JSON.stringify(input.details ?? {}),
    ],
  });
};

export const createProvisioningRepository = (executor: SqlExecutor): ProvisioningRepository => ({
  listProvisioningRuns: (instanceId) => listProvisioningRuns(executor, instanceId),
  listLatestProvisioningRuns: (instanceIds) => listLatestProvisioningRuns(executor, instanceIds),
  listAuditEvents: (instanceId) => listAuditEvents(executor, instanceId),
  getLatestTenantIamAccessProbe: (instanceId) =>
    getLatestTenantIamAccessProbe(executor, instanceId),
  getRoleReconcileSummary: (instanceId) => getRoleReconcileSummary(executor, instanceId),
  createProvisioningRun: (input) => createProvisioningRun(executor, input),
  claimNextProvisioningRun: (input) => claimNextProvisioningRun(executor, input),
  updateProvisioningRun: (input) => updateProvisioningRun(executor, input),
  retryProvisioningRun: (input) => retryProvisioningRun(executor, input),
  appendAuditEvent: (input) => appendAuditEvent(executor, input),
});
