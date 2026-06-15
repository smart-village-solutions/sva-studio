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
  | 'appendAuditEvent'
>;

const listProvisioningRuns = async (executor: SqlExecutor, instanceId: string) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
SELECT
  id::text, instance_id, operation, status, step_key, idempotency_key, error_code,
  error_message, request_id, actor_id, created_at::text, updated_at::text
FROM iam.instance_provisioning_runs
WHERE instance_id = $1
ORDER BY created_at DESC, id DESC;
`,
      [instanceId]
    )
  );
  return rows.map(mapProvisioningRun);
};

const listLatestProvisioningRuns = async (executor: SqlExecutor, instanceIds: readonly string[]) => {
  if (instanceIds.length === 0) {
    return {};
  }
  const placeholders = instanceIds.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
SELECT DISTINCT ON (instance_id)
  id::text, instance_id, operation, status, step_key, idempotency_key, error_code,
  error_message, request_id, actor_id, created_at::text, updated_at::text
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
  instance_id, operation, status, step_key, idempotency_key, error_code, error_message, request_id, actor_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING
  id::text, instance_id, operation, status, step_key, idempotency_key, error_code,
  error_message, request_id, actor_id, created_at::text, updated_at::text;
`,
      [
        input.instanceId,
        input.operation,
        input.status,
        input.stepKey ?? null,
        input.idempotencyKey,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.requestId ?? null,
        input.actorId ?? null,
      ]
    )
  );
  return mapProvisioningRun(rows[0]);
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
  getLatestTenantIamAccessProbe: (instanceId) => getLatestTenantIamAccessProbe(executor, instanceId),
  getRoleReconcileSummary: (instanceId) => getRoleReconcileSummary(executor, instanceId),
  createProvisioningRun: (input) => createProvisioningRun(executor, input),
  appendAuditEvent: (input) => appendAuditEvent(executor, input),
});
