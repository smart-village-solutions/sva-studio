import type { SqlExecutor } from '../iam/repositories/types.js';

import { mapAuditEvent, mapProvisioningRun } from './repository-mappers.js';
import { queryRows, statement } from './repository-shared.js';
import type { AuditRow, ProvisioningRow } from './repository-types.js';

const provisioningColumns = `
  id::text, instance_id, operation, status, step_key, idempotency_key, payload_fingerprint,
  snapshot_version, desired_snapshot, child_keycloak_run_id::text, lease_owner,
  lease_expires_at::text, attempt_count, next_attempt_at::text, deadline_at::text,
  terminal_evidence, completed_at::text, error_code, error_message, request_id, actor_id,
  created_at::text, updated_at::text`;

export const listProvisioningRuns = async (executor: SqlExecutor, instanceId: string) => {
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

export const listLatestProvisioningRuns = async (
  executor: SqlExecutor,
  instanceIds: readonly string[]
) => {
  if (instanceIds.length === 0) return {};
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

export const listAuditEvents = async (executor: SqlExecutor, instanceId: string) => {
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

export const getLatestTenantIamAccessProbe = async (executor: SqlExecutor, instanceId: string) => {
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
  if (!row) return null;
  return {
    checkedAt: row.checked_at,
    status: row.status,
    summary: row.summary,
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.request_id ? { requestId: row.request_id } : {}),
  };
};

export { provisioningColumns };
