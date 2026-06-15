import type { SqlExecutor } from '../iam/repositories/types.js';

import type { CreateKeycloakProvisioningRunResult, InstanceRegistryRepository } from './repository-contract.js';
import {
  listKeycloakProvisioningStepRows,
  loadConflictingRun,
  mapRunsWithSteps,
} from './repository-keycloak-provisioning-shared.js';
import { mapKeycloakProvisioningRun, mapKeycloakProvisioningRunStep } from './repository-mappers.js';
import { queryRows, statement } from './repository-shared.js';
import type {
  CreatedKeycloakProvisioningRunRow,
  KeycloakProvisioningRunRow,
  KeycloakProvisioningStepRow,
} from './repository-types.js';

type KeycloakProvisioningRepository = Pick<
  InstanceRegistryRepository,
  | 'listKeycloakProvisioningRuns'
  | 'getKeycloakProvisioningRun'
  | 'claimNextKeycloakProvisioningRun'
  | 'createKeycloakProvisioningRun'
  | 'updateKeycloakProvisioningRun'
  | 'appendKeycloakProvisioningStep'
>;

const listKeycloakProvisioningRuns = async (executor: SqlExecutor, instanceId: string) => {
  const rows = await queryRows<KeycloakProvisioningRunRow>(
    executor,
    statement(
      `
SELECT
  id::text, instance_id, mutation, idempotency_key, payload_fingerprint, mode, intent,
  overall_status, drift_summary, request_id, actor_id, created_at::text, updated_at::text
FROM iam.instance_keycloak_provisioning_runs
WHERE instance_id = $1
ORDER BY created_at DESC, id DESC;
`,
      [instanceId]
    )
  );
  return mapRunsWithSteps(executor, rows);
};

const getKeycloakProvisioningRun = async (executor: SqlExecutor, instanceId: string, runId: string) => {
  const rows = await queryRows<KeycloakProvisioningRunRow>(
    executor,
    statement(
      `
SELECT
  id::text, instance_id, mutation, idempotency_key, payload_fingerprint, mode, intent,
  overall_status, drift_summary, request_id, actor_id, created_at::text, updated_at::text
FROM iam.instance_keycloak_provisioning_runs
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
      [instanceId, runId]
    )
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  const stepsByRunId = await listKeycloakProvisioningStepRows(executor, [row.id]);
  return mapKeycloakProvisioningRun(row, stepsByRunId[row.id] ?? []);
};

const claimNextKeycloakProvisioningRun = async (
  executor: SqlExecutor,
  input?: { createdAtOrAfter?: string }
) => {
  const createdAtOrAfter = input?.createdAtOrAfter?.trim();
  const createdAtFilter = createdAtOrAfter ? '    AND created_at >= $1::timestamptz\n' : '';
  const rows = await queryRows<KeycloakProvisioningRunRow>(
    executor,
    statement(
      `
WITH next_run AS (
  SELECT id
  FROM iam.instance_keycloak_provisioning_runs
  WHERE overall_status = 'planned'
${createdAtFilter}
  ORDER BY created_at ASC, id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE iam.instance_keycloak_provisioning_runs AS runs
SET
  overall_status = 'running',
  updated_at = NOW()
FROM next_run
WHERE runs.id = next_run.id
RETURNING
  runs.id::text AS id,
  runs.instance_id,
  runs.mutation,
  runs.idempotency_key,
  runs.payload_fingerprint,
  runs.mode,
  runs.intent,
  runs.overall_status,
  runs.drift_summary,
  runs.request_id,
  runs.actor_id,
  runs.created_at::text,
  runs.updated_at::text;
`,
      createdAtOrAfter ? [createdAtOrAfter] : []
    )
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  const stepsByRunId = await listKeycloakProvisioningStepRows(executor, [row.id]);
  return mapKeycloakProvisioningRun(row, stepsByRunId[row.id] ?? []);
};

const createKeycloakProvisioningRun = async (
  executor: SqlExecutor,
  input: Parameters<KeycloakProvisioningRepository['createKeycloakProvisioningRun']>[0]
): Promise<CreateKeycloakProvisioningRunResult> => {
  const rows = await queryRows<CreatedKeycloakProvisioningRunRow>(
    executor,
    statement(
      `
INSERT INTO iam.instance_keycloak_provisioning_runs (
  instance_id, mutation, idempotency_key, payload_fingerprint, mode, intent, overall_status,
  drift_summary, request_id, actor_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (instance_id, mutation, idempotency_key)
  WHERE idempotency_key IS NOT NULL
DO UPDATE SET updated_at = iam.instance_keycloak_provisioning_runs.updated_at
WHERE iam.instance_keycloak_provisioning_runs.payload_fingerprint = EXCLUDED.payload_fingerprint
RETURNING
  id::text, instance_id, mutation, idempotency_key, payload_fingerprint, mode, intent,
  overall_status, drift_summary, request_id, actor_id, created_at::text, updated_at::text,
  (xmax = 0) AS created;
`,
        [
          input.instanceId,
          input.mutation,
          input.idempotencyKey,
          input.payloadFingerprint,
          input.mode,
          input.intent,
          input.overallStatus,
          input.driftSummary,
          input.requestId ?? null,
          input.actorId ?? null,
        ]
      )
    );
  const row = rows[0];
  if (!row) {
    const conflictingRow = await loadConflictingRun(executor, input.instanceId, input.mutation, input.idempotencyKey);
    if (conflictingRow) {
      throw new Error('idempotency_key_reuse');
    }
    throw new Error('keycloak_provisioning_run_idempotency_conflict');
  }
  const stepsByRunId = row.created ? {} : await listKeycloakProvisioningStepRows(executor, [row.id]);
  return {
    run: mapKeycloakProvisioningRun(row, stepsByRunId[row.id] ?? []),
    created: row.created,
  };
};

const updateKeycloakProvisioningRun = async (
  executor: SqlExecutor,
  input: Parameters<KeycloakProvisioningRepository['updateKeycloakProvisioningRun']>[0]
) => {
  const rows = await queryRows<KeycloakProvisioningRunRow>(
    executor,
    statement(
      `
UPDATE iam.instance_keycloak_provisioning_runs
SET
  overall_status = $2,
  drift_summary = COALESCE($3, drift_summary),
  updated_at = NOW()
WHERE id = $1::uuid
RETURNING
  id::text, instance_id, mutation, idempotency_key, payload_fingerprint, mode, intent,
  overall_status, drift_summary, request_id, actor_id, created_at::text, updated_at::text;
`,
      [input.runId, input.overallStatus, input.driftSummary ?? null]
    )
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  const stepsByRunId = await listKeycloakProvisioningStepRows(executor, [row.id]);
  return mapKeycloakProvisioningRun(row, stepsByRunId[row.id] ?? []);
};

const appendKeycloakProvisioningStep = async (
  executor: SqlExecutor,
  input: Parameters<KeycloakProvisioningRepository['appendKeycloakProvisioningStep']>[0]
) => {
  const rows = await queryRows<KeycloakProvisioningStepRow>(
    executor,
    statement(
      `
INSERT INTO iam.instance_keycloak_provisioning_steps (
  run_id, step_key, title, status, started_at, finished_at, summary, details, request_id
)
VALUES ($1::uuid, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8::jsonb, $9)
RETURNING
  id::text, run_id::text, step_key, title, status, started_at::text, finished_at::text,
  summary, details, request_id, created_at::text;
`,
      [
        input.runId,
        input.stepKey,
        input.title,
        input.status,
        input.startedAt ?? null,
        input.finishedAt ?? null,
        input.summary,
        JSON.stringify(input.details ?? {}),
        input.requestId ?? null,
      ]
    )
  );
  return mapKeycloakProvisioningRunStep(rows[0]);
};

export const createKeycloakProvisioningRepository = (executor: SqlExecutor): KeycloakProvisioningRepository => ({
  listKeycloakProvisioningRuns: (instanceId) => listKeycloakProvisioningRuns(executor, instanceId),
  getKeycloakProvisioningRun: (instanceId, runId) => getKeycloakProvisioningRun(executor, instanceId, runId),
  claimNextKeycloakProvisioningRun: (input) => claimNextKeycloakProvisioningRun(executor, input),
  createKeycloakProvisioningRun: (input) => createKeycloakProvisioningRun(executor, input),
  updateKeycloakProvisioningRun: (input) => updateKeycloakProvisioningRun(executor, input),
  appendKeycloakProvisioningStep: (input) => appendKeycloakProvisioningStep(executor, input),
});
