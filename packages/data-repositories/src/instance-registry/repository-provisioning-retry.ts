import type { SqlExecutor } from '../iam/repositories/types.js';

import type { InstanceRegistryRepository } from './repository-contract.js';
import { mapProvisioningRun } from './repository-mappers.js';
import { provisioningColumns } from './repository-provisioning-read.js';
import { queryRows, statement } from './repository-shared.js';
import type { ProvisioningRow } from './repository-types.js';

type ProvisioningRetryRepository = Pick<
  InstanceRegistryRepository,
  | 'reserveProvisioningRetryRun'
  | 'releaseProvisioningRetryReservation'
  | 'retryProvisioningRun'
>;

const retryProvisioningRun = async (
  executor: SqlExecutor,
  input: Parameters<ProvisioningRetryRepository['retryProvisioningRun']>[0]
) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
UPDATE iam.instance_provisioning_runs
SET status = 'requested',
    step_key = CASE
      WHEN $7::boolean THEN 'registry'
      WHEN step_key IN ('registry', 'keycloak') THEN 'registry'
      WHEN step_key = 'tls' THEN 'tls'
      WHEN step_key IN (
        'module_readiness', 'login', 'tenant_iam_roles', 'tenant_iam_access', 'activate'
      ) THEN 'lifecycle'
      ELSE step_key
    END,
    child_keycloak_run_id = CASE
      WHEN $7::boolean THEN child_keycloak_run_id
      WHEN $6::jsonb ->> 'realmMode' = 'new' THEN child_keycloak_run_id
      WHEN step_key IN ('registry', 'keycloak') THEN NULL
      ELSE child_keycloak_run_id
    END,
    lease_owner = NULL, lease_expires_at = NULL, next_attempt_at = now(),
    deadline_at = $5::timestamptz, completed_at = NULL,
    desired_snapshot = $6::jsonb,
    error_code = NULL, error_message = NULL,
    actor_id = COALESCE($3, actor_id), request_id = COALESCE($4, request_id), updated_at = now()
WHERE instance_id = $1 AND operation = 'create' AND idempotency_key = $2
  AND snapshot_version = '2.0' AND status = 'failed'
  AND lease_owner = $8 AND lease_expires_at > now()
RETURNING ${provisioningColumns};
`,
      [
        input.instanceId,
        input.idempotencyKey,
        input.actorId ?? null,
        input.requestId ?? null,
        input.deadlineAt,
        JSON.stringify(input.desiredSnapshot),
        input.keycloakReconcileRequired,
        input.leaseOwner,
      ]
    )
  );
  return rows[0] ? mapProvisioningRun(rows[0]) : null;
};

const reserveProvisioningRetryRun = async (
  executor: SqlExecutor,
  input: Parameters<ProvisioningRetryRepository['reserveProvisioningRetryRun']>[0]
) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
UPDATE iam.instance_provisioning_runs
SET lease_owner = $3, lease_expires_at = $4::timestamptz, updated_at = now()
WHERE instance_id = $1 AND operation = 'create' AND idempotency_key = $2
  AND snapshot_version = '2.0' AND status = 'failed'
  AND (lease_expires_at IS NULL OR lease_expires_at <= now())
RETURNING ${provisioningColumns};
`,
      [input.instanceId, input.idempotencyKey, input.leaseOwner, input.leaseExpiresAt]
    )
  );
  return rows[0] ? mapProvisioningRun(rows[0]) : null;
};

const releaseProvisioningRetryReservation = async (
  executor: SqlExecutor,
  input: Parameters<ProvisioningRetryRepository['releaseProvisioningRetryReservation']>[0]
) => {
  const rows = await queryRows<ProvisioningRow>(
    executor,
    statement(
      `
UPDATE iam.instance_provisioning_runs
SET lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
WHERE instance_id = $1 AND operation = 'create' AND idempotency_key = $2
  AND snapshot_version = '2.0' AND status = 'failed' AND lease_owner = $3
RETURNING ${provisioningColumns};
`,
      [input.instanceId, input.idempotencyKey, input.leaseOwner]
    )
  );
  return rows[0] ? mapProvisioningRun(rows[0]) : null;
};

export const createProvisioningRetryRepository = (
  executor: SqlExecutor
): ProvisioningRetryRepository => ({
  reserveProvisioningRetryRun: (input) => reserveProvisioningRetryRun(executor, input),
  releaseProvisioningRetryReservation: (input) =>
    releaseProvisioningRetryReservation(executor, input),
  retryProvisioningRun: (input) => retryProvisioningRun(executor, input),
});
