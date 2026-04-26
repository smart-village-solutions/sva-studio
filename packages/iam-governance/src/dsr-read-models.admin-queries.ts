import type { QueryClient } from './query-client.js';

import type {
  AdminDsrSourceRows,
  DsrFilters,
  ExportJobRow,
  LegalHoldRow,
  ProfileCorrectionRow,
  RecipientNotificationRow,
  RequestRow,
} from './dsr-read-models.types.js';

const queryAdminRequests = (client: QueryClient, input: DsrFilters) =>
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
  AND ($2::uuid IS NULL OR request.requester_account_id = $2::uuid OR request.target_account_id = $2::uuid)
ORDER BY request.request_accepted_at DESC;
`,
    [input.instanceId, input.relatedAccountId ?? null]
  );

const queryAdminExportJobs = (client: QueryClient, input: DsrFilters) =>
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
  AND ($2::uuid IS NULL OR job.target_account_id = $2::uuid OR job.requested_by_account_id = $2::uuid)
ORDER BY job.created_at DESC;
`,
    [input.instanceId, input.relatedAccountId ?? null]
  );

const queryAdminLegalHolds = (client: QueryClient, input: DsrFilters) =>
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
  AND ($2::uuid IS NULL OR hold.account_id = $2::uuid OR hold.created_by_account_id = $2::uuid OR hold.lifted_by_account_id = $2::uuid)
ORDER BY hold.created_at DESC;
`,
    [input.instanceId, input.relatedAccountId ?? null]
  );

const queryAdminProfileCorrections = (client: QueryClient, input: DsrFilters) =>
  client.query<ProfileCorrectionRow>(
    `
SELECT
  correction.id,
  correction.account_id::text,
  correction.actor_account_id::text,
  correction.correction_reason,
  correction.created_at::text,
  target.display_name_ciphertext AS target_display_name_ciphertext,
  target.first_name_ciphertext AS target_first_name_ciphertext,
  target.last_name_ciphertext AS target_last_name_ciphertext,
  target.keycloak_subject AS target_keycloak_subject,
  actor.display_name_ciphertext AS actor_display_name_ciphertext,
  actor.first_name_ciphertext AS actor_first_name_ciphertext,
  actor.last_name_ciphertext AS actor_last_name_ciphertext,
  actor.keycloak_subject AS actor_keycloak_subject
FROM iam.account_profile_corrections correction
JOIN iam.accounts target
  ON target.id = correction.account_id
LEFT JOIN iam.accounts actor
  ON actor.id = correction.actor_account_id
WHERE correction.instance_id = $1
  AND ($2::uuid IS NULL OR correction.account_id = $2::uuid OR correction.actor_account_id = $2::uuid)
ORDER BY correction.created_at DESC;
`,
    [input.instanceId, input.relatedAccountId ?? null]
  );

const queryAdminRecipientNotifications = (client: QueryClient, input: DsrFilters) =>
  client.query<RecipientNotificationRow>(
    `
SELECT
  notification.id,
  notification.request_id::text,
  notification.recipient_class,
  notification.notification_status,
  notification.notification_result,
  notification.created_at::text,
  notification.notified_at::text,
  request.target_account_id::text,
  target.display_name_ciphertext AS target_display_name_ciphertext,
  target.first_name_ciphertext AS target_first_name_ciphertext,
  target.last_name_ciphertext AS target_last_name_ciphertext,
  target.keycloak_subject AS target_keycloak_subject
FROM iam.data_subject_recipient_notifications notification
JOIN iam.data_subject_requests request
  ON request.id = notification.request_id
JOIN iam.accounts target
  ON target.id = request.target_account_id
WHERE notification.instance_id = $1
  AND ($2::uuid IS NULL OR request.target_account_id = $2::uuid)
ORDER BY notification.created_at DESC;
`,
    [input.instanceId, input.relatedAccountId ?? null]
  );

export const loadAdminDsrRows = async (client: QueryClient, input: DsrFilters): Promise<AdminDsrSourceRows> => {
  const requests = await queryAdminRequests(client, input);
  const exportJobs = await queryAdminExportJobs(client, input);
  const legalHolds = await queryAdminLegalHolds(client, input);
  const profileCorrections = await queryAdminProfileCorrections(client, input);
  const recipientNotifications = await queryAdminRecipientNotifications(client, input);

  return {
    requests: requests.rows,
    exportJobs: exportJobs.rows,
    legalHolds: legalHolds.rows,
    profileCorrections: profileCorrections.rows,
    recipientNotifications: recipientNotifications.rows,
  };
};
