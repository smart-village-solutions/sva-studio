import type { WasteTenantProvisioningRecord } from '@sva/core';
import type { SqlExecutor } from '../iam/repositories/types.js';

import type { InstanceRegistryRepository } from './repository-contract.js';
import { statement } from './repository-shared.js';

type WasteProvisioningRow = {
  instance_id: string;
  status: WasteTenantProvisioningRecord['status'];
  desired_generation: number;
  completed_generation: number;
  database_name: string | null;
  interface_id: string | null;
  active_job_id: string | null;
  error_code: string | null;
  error_message: string | null;
  requested_at: Date | string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  updated_at: Date | string;
};

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapRow = (row: WasteProvisioningRow): WasteTenantProvisioningRecord => ({
  instanceId: row.instance_id,
  status: row.status,
  desiredGeneration: row.desired_generation,
  completedGeneration: row.completed_generation,
  ...(row.database_name ? { databaseName: row.database_name } : {}),
  ...(row.interface_id ? { interfaceId: row.interface_id } : {}),
  ...(row.active_job_id ? { activeJobId: row.active_job_id } : {}),
  ...(row.error_code ? { errorCode: row.error_code } : {}),
  ...(row.error_message ? { errorMessage: row.error_message } : {}),
  requestedAt: toIso(row.requested_at),
  ...(row.started_at ? { startedAt: toIso(row.started_at) } : {}),
  ...(row.completed_at ? { completedAt: toIso(row.completed_at) } : {}),
  updatedAt: toIso(row.updated_at),
});

type WasteProvisioningRepository = Pick<
  InstanceRegistryRepository,
  | 'requestWasteProvisioning'
  | 'getWasteProvisioning'
  | 'disableWasteProvisioning'
  | 'claimWasteProvisioning'
  | 'completeWasteProvisioning'
  | 'failWasteProvisioning'
>;

export const createWasteProvisioningRepository = (
  executor: SqlExecutor
): WasteProvisioningRepository => ({
  async requestWasteProvisioning(instanceId) {
    const result = await executor.execute<WasteProvisioningRow>(
      statement(
        `
INSERT INTO iam.instance_waste_provisioning (
  instance_id, status, desired_generation, completed_generation, requested_at, updated_at
)
VALUES ($1, 'provisioning', 1, 0, NOW(), NOW())
ON CONFLICT (instance_id) DO UPDATE
SET status = CASE
      WHEN iam.instance_waste_provisioning.status = 'ready' THEN 'ready'
      ELSE 'provisioning'
    END,
    desired_generation = CASE
      WHEN iam.instance_waste_provisioning.status IN ('failed', 'disabled')
        THEN iam.instance_waste_provisioning.desired_generation + 1
      ELSE iam.instance_waste_provisioning.desired_generation
    END,
    error_code = NULL,
    error_message = NULL,
    requested_at = NOW(),
    updated_at = NOW()
RETURNING *;
`,
        [instanceId]
      )
    );
    return mapRow(result.rows[0]!);
  },

  async getWasteProvisioning(instanceId) {
    const result = await executor.execute<WasteProvisioningRow>(
      statement('SELECT * FROM iam.instance_waste_provisioning WHERE instance_id = $1;', [instanceId])
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  async disableWasteProvisioning(instanceId) {
    const result = await executor.execute<WasteProvisioningRow>(
      statement(
        `
UPDATE iam.instance_waste_provisioning
SET status = 'disabled',
    active_job_id = NULL,
    error_code = NULL,
    error_message = NULL,
    completed_at = NOW(),
    updated_at = NOW()
WHERE instance_id = $1
RETURNING *;
`,
        [instanceId]
      )
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  async claimWasteProvisioning(input) {
    const result = await executor.execute<WasteProvisioningRow>(
      statement(
        `
UPDATE iam.instance_waste_provisioning
SET status = 'provisioning',
    active_job_id = $2::uuid,
    started_at = NOW(),
    completed_at = NULL,
    error_code = NULL,
    error_message = NULL,
    updated_at = NOW()
WHERE instance_id = $1
  AND desired_generation = $3
  AND status <> 'disabled'
  AND (active_job_id IS NULL OR active_job_id = $2::uuid)
RETURNING *;
`,
        [input.instanceId, input.jobId, input.desiredGeneration]
      )
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  async completeWasteProvisioning(input) {
    const result = await executor.execute<WasteProvisioningRow>(
      statement(
        `
UPDATE iam.instance_waste_provisioning
SET status = 'ready',
    completed_generation = $3,
    database_name = $4,
    interface_id = $5,
    active_job_id = NULL,
    error_code = NULL,
    error_message = NULL,
    completed_at = NOW(),
    updated_at = NOW()
WHERE instance_id = $1
  AND active_job_id = $2::uuid
  AND desired_generation = $3
  AND status = 'provisioning'
RETURNING *;
`,
        [input.instanceId, input.jobId, input.desiredGeneration, input.databaseName, input.interfaceId]
      )
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  async failWasteProvisioning(input) {
    const result = await executor.execute<WasteProvisioningRow>(
      statement(
        `
UPDATE iam.instance_waste_provisioning
SET status = 'failed',
    active_job_id = NULL,
    error_code = $4,
    error_message = $5,
    completed_at = NOW(),
    updated_at = NOW()
WHERE instance_id = $1
  AND active_job_id = $2::uuid
  AND desired_generation = $3
  AND status = 'provisioning'
RETURNING *;
`,
        [input.instanceId, input.jobId, input.desiredGeneration, input.errorCode, input.errorMessage]
      )
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },
});
