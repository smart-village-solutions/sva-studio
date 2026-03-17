import type { QueryClient } from '../shared/db-helpers';

import type {
  AccountSnapshotRow,
  DsrSelfServiceRows,
  ExportJobRow,
  LegalHoldRow,
  RequestRow,
} from './read-models.types';

const queryAccountSnapshot = (client: QueryClient, input: { instanceId: string; accountId: string }) =>
  client.query<AccountSnapshotRow>(
    `
SELECT id, processing_restricted_at::text, processing_restriction_reason, non_essential_processing_opt_out_at::text
FROM iam.accounts
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.accountId]
  );

const querySelfServiceRequests = (client: QueryClient, input: { instanceId: string; accountId: string }) =>
  client.query<RequestRow>(
    `
SELECT
  request.id,
  request.request_type,
  request.status,
  request.requester_account_id::text,
  request.target_account_id::text,
  request.legal_hold_blocked,
  request.request_accepted_at::text,
  request.completed_at::text,
  request.updated_at::text,
  requester.display_name_ciphertext AS requester_display_name_ciphertext,
  requester.first_name_ciphertext AS requester_first_name_ciphertext,
  requester.last_name_ciphertext AS requester_last_name_ciphertext,
  requester.keycloak_subject AS requester_keycloak_subject,
  target.display_name_ciphertext AS target_display_name_ciphertext,
  target.first_name_ciphertext AS target_first_name_ciphertext,
  target.last_name_ciphertext AS target_last_name_ciphertext,
  target.keycloak_subject AS target_keycloak_subject
FROM iam.data_subject_requests request
LEFT JOIN iam.accounts requester
  ON requester.id = request.requester_account_id
JOIN iam.accounts target
  ON target.id = request.target_account_id
WHERE request.instance_id = $1
  AND request.target_account_id = $2::uuid
ORDER BY request.request_accepted_at DESC
LIMIT 50;
`,
    [input.instanceId, input.accountId]
  );

const querySelfServiceExportJobs = (client: QueryClient, input: { instanceId: string; accountId: string }) =>
  client.query<ExportJobRow>(
    `
SELECT
  job.id,
  job.format,
  job.status,
  job.error_message,
  job.target_account_id::text,
  job.requested_by_account_id::text,
  job.created_at::text,
  job.completed_at::text,
  target.display_name_ciphertext AS target_display_name_ciphertext,
  target.first_name_ciphertext AS target_first_name_ciphertext,
  target.last_name_ciphertext AS target_last_name_ciphertext,
  target.keycloak_subject AS target_keycloak_subject,
  requester.display_name_ciphertext AS requester_display_name_ciphertext,
  requester.first_name_ciphertext AS requester_first_name_ciphertext,
  requester.last_name_ciphertext AS requester_last_name_ciphertext,
  requester.keycloak_subject AS requester_keycloak_subject
FROM iam.data_subject_export_jobs job
JOIN iam.accounts target
  ON target.id = job.target_account_id
LEFT JOIN iam.accounts requester
  ON requester.id = job.requested_by_account_id
WHERE job.instance_id = $1
  AND job.target_account_id = $2::uuid
ORDER BY job.created_at DESC
LIMIT 50;
`,
    [input.instanceId, input.accountId]
  );

const querySelfServiceLegalHolds = (client: QueryClient, input: { instanceId: string; accountId: string }) =>
  client.query<LegalHoldRow>(
    `
SELECT
  hold.id,
  hold.active,
  hold.hold_reason,
  hold.hold_until::text,
  hold.account_id::text,
  hold.created_by_account_id::text,
  hold.lifted_by_account_id::text,
  hold.created_at::text,
  hold.lifted_at::text,
  target.display_name_ciphertext AS target_display_name_ciphertext,
  target.first_name_ciphertext AS target_first_name_ciphertext,
  target.last_name_ciphertext AS target_last_name_ciphertext,
  target.keycloak_subject AS target_keycloak_subject,
  creator.display_name_ciphertext AS created_by_display_name_ciphertext,
  creator.first_name_ciphertext AS created_by_first_name_ciphertext,
  creator.last_name_ciphertext AS created_by_last_name_ciphertext,
  creator.keycloak_subject AS created_by_keycloak_subject
FROM iam.legal_holds hold
JOIN iam.accounts target
  ON target.id = hold.account_id
LEFT JOIN iam.accounts creator
  ON creator.id = hold.created_by_account_id
WHERE hold.instance_id = $1
  AND hold.account_id = $2::uuid
ORDER BY hold.created_at DESC
LIMIT 20;
`,
    [input.instanceId, input.accountId]
  );

export const loadDsrSelfServiceRows = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<DsrSelfServiceRows> => {
  const [accountResult, requestResult, exportResult, holdResult] = await Promise.all([
    queryAccountSnapshot(client, input),
    querySelfServiceRequests(client, input),
    querySelfServiceExportJobs(client, input),
    querySelfServiceLegalHolds(client, input),
  ]);

  return {
    account: accountResult.rows[0]!,
    requests: requestResult.rows,
    exportJobs: exportResult.rows,
    legalHolds: holdResult.rows,
  };
};
