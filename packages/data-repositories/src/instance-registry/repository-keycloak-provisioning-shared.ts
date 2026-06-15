import type { SqlExecutor } from '../iam/repositories/types.js';

import { mapKeycloakProvisioningRun } from './repository-mappers.js';
import { queryRows, statement } from './repository-shared.js';
import type { KeycloakProvisioningRunRow, KeycloakProvisioningStepRow } from './repository-types.js';

export const listKeycloakProvisioningStepRows = async (
  executor: SqlExecutor,
  runIds: readonly string[]
): Promise<Readonly<Record<string, readonly KeycloakProvisioningStepRow[]>>> => {
  if (runIds.length === 0) {
    return {};
  }
  const placeholders = runIds.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await queryRows<KeycloakProvisioningStepRow>(
    executor,
    statement(
      `
SELECT
  id::text, run_id::text, step_key, title, status, started_at::text, finished_at::text,
  summary, details, request_id, created_at::text
FROM iam.instance_keycloak_provisioning_steps
WHERE run_id IN (${placeholders})
ORDER BY created_at ASC, id ASC;
`,
      runIds
    )
  );
  return rows.reduce<Readonly<Record<string, readonly KeycloakProvisioningStepRow[]>>>((accumulator, row) => {
    const current = accumulator[row.run_id] ?? [];
    return { ...accumulator, [row.run_id]: [...current, row] };
  }, {});
};

export const mapRunsWithSteps = async (executor: SqlExecutor, rows: readonly KeycloakProvisioningRunRow[]) => {
  const stepsByRunId = await listKeycloakProvisioningStepRows(
    executor,
    rows.map((row) => row.id)
  );
  return rows.map((row) => mapKeycloakProvisioningRun(row, stepsByRunId[row.id] ?? []));
};

export const loadConflictingRun = async (
  executor: SqlExecutor,
  instanceId: string,
  mutation: string,
  idempotencyKey: string
): Promise<KeycloakProvisioningRunRow | null> => {
  const rows = await queryRows<KeycloakProvisioningRunRow>(
    executor,
    statement(
      `
SELECT
  id::text, instance_id, mutation, idempotency_key, payload_fingerprint, mode, intent,
  overall_status, drift_summary, request_id, actor_id, created_at::text, updated_at::text
FROM iam.instance_keycloak_provisioning_runs
WHERE instance_id = $1
  AND mutation = $2
  AND idempotency_key = $3
LIMIT 1;
`,
      [instanceId, mutation, idempotencyKey]
    )
  );
  return rows[0] ?? null;
};
