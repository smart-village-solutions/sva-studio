import type { DsrExportAccountSnapshot, DsrExportFormat } from './dsr-export-payload.js';
import type { QueryClient } from './query-client.js';

export const resolveAccountBySubject = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
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
WHERE a.keycloak_subject = $2
LIMIT 1;
`,
    [input.instanceId, input.keycloakSubject]
  );

  return query.rowCount > 0 ? query.rows[0] : undefined;
};

export const createAsyncExportJob = async (
  client: QueryClient,
  input: {
    instanceId: string;
    targetAccountId: string;
    requestedByAccountId: string;
    format: DsrExportFormat;
  }
): Promise<{ id: string; status: string }> => {
  const created = await client.query<{ id: string; status: string }>(
    `
INSERT INTO iam.data_subject_export_jobs (
  instance_id,
  target_account_id,
  requested_by_account_id,
  format,
  status
)
VALUES ($1, $2::uuid, $3::uuid, $4, 'queued')
RETURNING id, status;
`,
    [input.instanceId, input.targetAccountId, input.requestedByAccountId, input.format]
  );

  const job = created.rows[0];
  if (!job) {
    throw new Error('export_job_not_created');
  }
  return job;
};

export const createDsrRequest = async (
  client: QueryClient,
  input: {
    instanceId: string;
    status: 'accepted' | 'completed';
    requesterAccountId: string;
    targetAccountId: string;
    payload: Record<string, unknown>;
    completedAt?: string;
  }
): Promise<string> => {
  const created = await client.query<{ id: string }>(
    `
INSERT INTO iam.data_subject_requests (
  instance_id,
  request_type,
  status,
  requester_account_id,
  target_account_id,
  legal_hold_blocked,
  payload,
  sla_deadline_at,
  completed_at
)
VALUES ($1, 'access', $2, $3::uuid, $4::uuid, false, $5::jsonb, NULL, $6::timestamptz)
RETURNING id;
`,
    [
      input.instanceId,
      input.status,
      input.requesterAccountId,
      input.targetAccountId,
      JSON.stringify(input.payload),
      input.completedAt ?? null,
    ]
  );

  const requestRow = created.rows[0];
  if (!requestRow) {
    throw new Error('dsr_request_not_created');
  }
  return requestRow.id;
};

export const linkStudioJobToExportJob = async (
  client: QueryClient,
  input: { exportJobId: string; studioJobId: string }
): Promise<void> => {
  await client.query(
    `
UPDATE iam.data_subject_export_jobs
SET studio_job_id = $2::uuid
WHERE id = $1::uuid;
`,
    [input.exportJobId, input.studioJobId]
  );
};

export const markExportJobQueueFailed = async (
  client: QueryClient,
  input: { exportJobId: string; errorMessage: string }
): Promise<void> => {
  await client.query(
    `
UPDATE iam.data_subject_export_jobs
SET
  status = 'failed',
  completed_at = NOW(),
  error_message = $2
WHERE id = $1::uuid;
`,
    [input.exportJobId, input.errorMessage]
  );
};
