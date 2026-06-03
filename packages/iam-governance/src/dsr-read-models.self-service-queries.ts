import type { QueryClient } from './query-client.js';

import type {
  AccountSnapshotRow,
  DsrSelfServiceRows,
  ExportJobRow,
  LegalAcceptanceRow,
  LegalHoldRow,
  RequestRow,
} from './dsr-read-models.types.js';

export class DsrAccountSnapshotNotFoundError extends Error {
  constructor(accountId: string) {
    super(`account_snapshot_not_found:${accountId}`);
    this.name = 'DsrAccountSnapshotNotFoundError';
  }
}

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
  AND job.requested_by_account_id = $2::uuid
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

const querySelfServiceLegalAcceptances = (client: QueryClient, input: { instanceId: string; accountId: string }) =>
  client.query<LegalAcceptanceRow>(
    `
SELECT
  acceptance.id,
  version.legal_text_id,
  version.legal_text_version,
  version.locale,
  acceptance.accepted_at::text,
  acceptance.revoked_at::text,
  acceptance.request_id,
  acceptance.trace_id,
  account.id AS account_id,
  account.display_name_ciphertext,
  account.first_name_ciphertext,
  account.last_name_ciphertext,
  account.keycloak_subject
FROM iam.legal_text_acceptances acceptance
JOIN iam.legal_text_versions version
  ON version.id = acceptance.legal_text_version_id
JOIN iam.accounts account
  ON account.id = acceptance.account_id
WHERE acceptance.instance_id = $1
  AND acceptance.account_id = $2::uuid
ORDER BY acceptance.accepted_at DESC
LIMIT 50;
`,
    [input.instanceId, input.accountId]
  );

const querySelfServiceRequestByCaseId = (
  client: QueryClient,
  input: { instanceId: string; accountId: string; caseId: string }
) =>
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
  AND request.id = $3::uuid
LIMIT 1;
`,
    [input.instanceId, input.accountId, input.caseId]
  );

const querySelfServiceExportJobByCaseId = (
  client: QueryClient,
  input: { instanceId: string; accountId: string; caseId: string }
) =>
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
  AND job.requested_by_account_id = $2::uuid
  AND job.id = $3::uuid
LIMIT 1;
`,
    [input.instanceId, input.accountId, input.caseId]
  );

const querySelfServiceLegalHoldByCaseId = (
  client: QueryClient,
  input: { instanceId: string; accountId: string; caseId: string }
) =>
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
  AND hold.id = $3::uuid
LIMIT 1;
`,
    [input.instanceId, input.accountId, input.caseId]
  );

const querySelfServiceLegalAcceptanceByCaseId = (
  client: QueryClient,
  input: { instanceId: string; accountId: string; caseId: string }
) =>
  client.query<LegalAcceptanceRow>(
    `
SELECT
  acceptance.id,
  version.legal_text_id,
  version.legal_text_version,
  version.locale,
  acceptance.accepted_at::text,
  acceptance.revoked_at::text,
  acceptance.request_id,
  acceptance.trace_id,
  account.id AS account_id,
  account.display_name_ciphertext,
  account.first_name_ciphertext,
  account.last_name_ciphertext,
  account.keycloak_subject
FROM iam.legal_text_acceptances acceptance
JOIN iam.legal_text_versions version
  ON version.id = acceptance.legal_text_version_id
JOIN iam.accounts account
  ON account.id = acceptance.account_id
WHERE acceptance.instance_id = $1
  AND acceptance.account_id = $2::uuid
  AND acceptance.id = $3::uuid
LIMIT 1;
`,
    [input.instanceId, input.accountId, input.caseId]
  );

export const loadDsrSelfServiceRows = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<DsrSelfServiceRows> => {
  const accountResult = await queryAccountSnapshot(client, input);
  const requestResult = await querySelfServiceRequests(client, input);
  const exportResult = await querySelfServiceExportJobs(client, input);
  const holdResult = await querySelfServiceLegalHolds(client, input);
  const legalAcceptanceResult = await querySelfServiceLegalAcceptances(client, input);

  const account = accountResult.rows[0];
  if (!account) {
    throw new DsrAccountSnapshotNotFoundError(input.accountId);
  }

  return {
    account,
    requests: requestResult.rows,
    exportJobs: exportResult.rows,
    legalHolds: holdResult.rows,
    legalAcceptances: legalAcceptanceResult.rows,
  };
};

export const findSelfServiceActivityItemByCaseId = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; caseId: string }
) => {
  const requestResult = await querySelfServiceRequestByCaseId(client, input);
  if (requestResult.rows[0]) {
    return { request: requestResult.rows[0] };
  }

  const exportResult = await querySelfServiceExportJobByCaseId(client, input);
  if (exportResult.rows[0]) {
    return { exportJob: exportResult.rows[0] };
  }

  const holdResult = await querySelfServiceLegalHoldByCaseId(client, input);
  if (holdResult.rows[0]) {
    return { legalHold: holdResult.rows[0] };
  }

  const legalAcceptanceResult = await querySelfServiceLegalAcceptanceByCaseId(client, input);
  if (legalAcceptanceResult.rows[0]) {
    return { legalAcceptance: legalAcceptanceResult.rows[0] };
  }

  return null;
};
