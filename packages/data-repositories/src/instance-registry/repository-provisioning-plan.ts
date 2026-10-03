import type { SqlExecutor } from '../iam/repositories/types.js';

import type { InstanceRegistryRepository } from './repository-contract.js';
import { mapProvisioningRun } from './repository-mappers.js';
import { provisioningColumns } from './repository-provisioning-read.js';
import { queryRows, statement } from './repository-shared.js';
import type { ProvisioningRow } from './repository-types.js';

export const confirmProvisioningPlan = async (
  executor: SqlExecutor,
  input: Parameters<InstanceRegistryRepository['confirmProvisioningPlan']>[0]
) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
UPDATE iam.instance_provisioning_runs
SET status = 'provisioning', step_key = 'keycloak', child_keycloak_run_id = $5::uuid,
    next_attempt_at = now(), deadline_at = now() + INTERVAL '30 minutes',
    terminal_evidence = jsonb_set(
      terminal_evidence,
      '{keycloakPlanGate}',
      jsonb_build_object(
        'status', 'confirmed',
        'planFingerprint', $4::text,
        'childKeycloakRunId', $5::text,
        'confirmedBy', $6::text,
        'requestId', $7::text,
        'confirmedAt', now()
      ),
      true
    ),
    error_code = NULL, error_message = NULL, completed_at = NULL,
    lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
WHERE id = $1::uuid AND instance_id = $2
  AND operation = 'create' AND status = 'validated' AND completed_at IS NULL
  AND step_key = 'registry' AND child_keycloak_run_id IS NULL
  AND terminal_evidence #>> '{keycloakPlanGate,status}' = 'awaiting_plan_confirmation'
  AND terminal_evidence #>> '{keycloakPlanGate,planFingerprint}' = $3
RETURNING ${provisioningColumns};
`,
      [
        input.runId,
        input.instanceId,
        input.expectedPlanFingerprint,
        input.planFingerprint,
        input.childKeycloakRunId,
        input.actorId ?? null,
        input.requestId ?? null,
      ]
    )
  );
  return rows[0] ? mapProvisioningRun(rows[0]) : null;
};

export const bindProvisioningRemediation = async (
  executor: SqlExecutor,
  input: Parameters<InstanceRegistryRepository['bindProvisioningRemediation']>[0]
) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
UPDATE iam.instance_provisioning_runs
SET terminal_evidence = jsonb_set(
      terminal_evidence,
      '{keycloakPlanGate}',
      jsonb_build_object(
        'status', 'tenant_secret_rotation_running',
        'planFingerprint', $4::text,
        'remediationRunId', $5::text,
        'confirmedBy', $6::text,
        'requestId', $7::text,
        'confirmedAt', now()
      ),
      true
    ),
    error_code = NULL, error_message = NULL,
    lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
WHERE id = $1::uuid AND instance_id = $2
  AND operation = 'create' AND status = 'validated' AND completed_at IS NULL
  AND step_key = 'registry' AND child_keycloak_run_id IS NULL
  AND terminal_evidence #>> '{keycloakPlanGate,status}' = 'awaiting_tenant_secret'
  AND terminal_evidence #>> '{keycloakPlanGate,planFingerprint}' = $3
RETURNING ${provisioningColumns};
`,
      [
        input.runId,
        input.instanceId,
        input.expectedPlanFingerprint,
        input.planFingerprint,
        input.childKeycloakRunId,
        input.actorId ?? null,
        input.requestId ?? null,
      ]
    )
  );
  return rows[0] ? mapProvisioningRun(rows[0]) : null;
};

export const completeProvisioningRemediation = async (
  executor: SqlExecutor,
  input: Parameters<InstanceRegistryRepository['completeProvisioningRemediation']>[0]
) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
UPDATE iam.instance_provisioning_runs
SET status = CASE WHEN $3 THEN 'requested' ELSE 'validated' END,
    step_key = 'registry',
    next_attempt_at = CASE WHEN $3 THEN now() ELSE next_attempt_at END,
    deadline_at = CASE WHEN $3 THEN now() + INTERVAL '30 minutes' ELSE deadline_at END,
    terminal_evidence = jsonb_set(
      terminal_evidence,
      '{keycloakPlanGate}',
      jsonb_build_object(
        'status', CASE WHEN $3 THEN 'tenant_secret_restored' ELSE 'awaiting_tenant_secret' END,
        'planFingerprint', terminal_evidence #>> '{keycloakPlanGate,planFingerprint}',
        'remediationRunId', $2::text,
        'completedAt', now()
      ),
      true
    ),
    error_code = CASE WHEN $3 THEN NULL ELSE 'tenant_secret_remediation_failed' END,
    error_message = CASE WHEN $3 THEN NULL ELSE 'Tenant-Secret-Wiederherstellung fehlgeschlagen.' END,
    completed_at = NULL, lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
WHERE instance_id = $1 AND operation = 'create' AND completed_at IS NULL
  AND terminal_evidence #>> '{keycloakPlanGate,status}' = 'tenant_secret_rotation_running'
  AND terminal_evidence #>> '{keycloakPlanGate,remediationRunId}' = $2
RETURNING ${provisioningColumns};
`,
      [input.instanceId, input.childKeycloakRunId, input.succeeded]
    )
  );
  return rows[0] ? mapProvisioningRun(rows[0]) : null;
};

export const recordProvisioningWakeupFailure = async (
  executor: SqlExecutor,
  input: Parameters<InstanceRegistryRepository['recordProvisioningWakeupFailure']>[0]
) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
WITH candidate AS (
  SELECT id AS candidate_run_id
  FROM iam.instance_provisioning_runs
  WHERE instance_id = $1
    AND operation = 'create'
    AND status IN ('requested', 'validated', 'provisioning')
  ORDER BY created_at DESC, id DESC
  LIMIT 1
)
UPDATE iam.instance_provisioning_runs AS run
SET error_code = $2,
    error_message = $3,
    terminal_evidence = run.terminal_evidence || jsonb_build_object(
      'postCommitWakeup',
      jsonb_build_object('status', 'failed', 'code', $2, 'checkedAt', $4::timestamptz)
    ),
    next_attempt_at = LEAST(run.next_attempt_at, now()),
    updated_at = now()
FROM candidate
WHERE run.id = candidate.candidate_run_id
RETURNING ${provisioningColumns};
`,
      [input.instanceId, input.errorCode, input.errorMessage, input.occurredAt]
    )
  );
  return rows[0] ? mapProvisioningRun(rows[0]) : null;
};
