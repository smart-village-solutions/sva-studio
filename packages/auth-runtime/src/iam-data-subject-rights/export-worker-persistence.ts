import type {
  DsrExportAccountSnapshot,
  DsrExportFormat,
} from '@sva/iam-governance/dsr-export-payload';
import type { QueryClient } from '../db.js';

type DsrExportJobRow = {
  readonly id: string;
  readonly target_account_id: string;
  readonly format: DsrExportFormat;
  readonly status: 'queued' | 'processing' | 'completed' | 'failed';
};

export const resolveAccountById = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<DsrExportAccountSnapshot | undefined> => {
  const query = await client.query<DsrExportAccountSnapshot>(
    `
SELECT
  a.id,
  a.keycloak_subject,
  a.email_ciphertext,
  a.display_name_ciphertext,
  a.is_blocked,
  a.soft_deleted_at,
  a.delete_after,
  a.permanently_deleted_at,
  a.processing_restricted_at,
  a.processing_restriction_reason,
  a.non_essential_processing_opt_out_at,
  a.created_at,
  a.updated_at
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
WHERE a.id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.accountId]
  );

  return query.rowCount > 0 ? query.rows[0] : undefined;
};

export const loadExportJob = async (
  client: QueryClient,
  input: { instanceId: string; exportJobId: string }
): Promise<DsrExportJobRow | undefined> => {
  const result = await client.query<DsrExportJobRow>(
    `
SELECT id, target_account_id, format, status
FROM iam.data_subject_export_jobs
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.exportJobId]
  );

  return result.rowCount > 0 ? result.rows[0] : undefined;
};

export const claimQueuedExportJob = async (
  client: QueryClient,
  input: { instanceId: string; exportJobId: string }
): Promise<DsrExportJobRow | undefined> => {
  const result = await client.query<DsrExportJobRow>(
    `
UPDATE iam.data_subject_export_jobs
SET
  status = 'processing',
  started_at = COALESCE(started_at, NOW()),
  error_message = NULL
WHERE instance_id = $1
  AND id = $2::uuid
  AND status = 'queued'
RETURNING id, target_account_id, format, status;
`,
    [input.instanceId, input.exportJobId]
  );

  return result.rowCount > 0 ? result.rows[0] : undefined;
};

export const markExportJobFailed = async (
  client: QueryClient,
  input: { instanceId: string; exportJobId: string; errorMessage: string }
): Promise<void> => {
  await client.query(
    `
UPDATE iam.data_subject_export_jobs
SET
  status = 'failed',
  completed_at = NOW(),
  error_message = $3
WHERE instance_id = $1
  AND id = $2::uuid;
`,
    [input.instanceId, input.exportJobId, input.errorMessage]
  );
};
