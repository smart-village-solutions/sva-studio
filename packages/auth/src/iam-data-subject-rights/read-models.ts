import type {
  IamDsrCanonicalStatus,
  IamDsrCaseListItem,
  IamDsrSelfServiceOverview,
} from '@sva/core';

import type { QueryClient } from '../shared/db-helpers';
import { readString } from '../shared/input-readers';
import { revealField } from '../iam-account-management/encryption';
import { resolveUserDisplayName } from '../iam-account-management/user-mapping';

type PersonColumns = {
  display_name_ciphertext: string | null;
  first_name_ciphertext: string | null;
  last_name_ciphertext: string | null;
  keycloak_subject: string;
};

type DsrFilters = {
  readonly instanceId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly type?: IamDsrCaseListItem['type'];
  readonly status?: IamDsrCanonicalStatus;
  readonly relatedAccountId?: string;
};

type AccountSnapshotRow = {
  id: string;
  processing_restricted_at: string | null;
  processing_restriction_reason: string | null;
  non_essential_processing_opt_out_at: string | null;
};

type RequestRow = {
  id: string;
  request_type: string;
  status: string;
  requester_account_id: string | null;
  target_account_id: string;
  legal_hold_blocked: boolean;
  request_accepted_at: string;
  completed_at: string | null;
  updated_at: string;
  requester_display_name_ciphertext: string | null;
  requester_first_name_ciphertext: string | null;
  requester_last_name_ciphertext: string | null;
  requester_keycloak_subject: string | null;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
};

type ExportJobRow = {
  id: string;
  format: string;
  status: string;
  error_message: string | null;
  target_account_id: string;
  requested_by_account_id: string | null;
  created_at: string;
  completed_at: string | null;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
  requester_display_name_ciphertext: string | null;
  requester_first_name_ciphertext: string | null;
  requester_last_name_ciphertext: string | null;
  requester_keycloak_subject: string | null;
};

type LegalHoldRow = {
  id: string;
  active: boolean;
  hold_reason: string;
  hold_until: string | null;
  account_id: string;
  created_by_account_id: string | null;
  lifted_by_account_id: string | null;
  created_at: string;
  lifted_at: string | null;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
  created_by_display_name_ciphertext: string | null;
  created_by_first_name_ciphertext: string | null;
  created_by_last_name_ciphertext: string | null;
  created_by_keycloak_subject: string | null;
};

type ProfileCorrectionRow = {
  id: string;
  account_id: string;
  actor_account_id: string | null;
  correction_reason: string | null;
  created_at: string;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
  actor_display_name_ciphertext: string | null;
  actor_first_name_ciphertext: string | null;
  actor_last_name_ciphertext: string | null;
  actor_keycloak_subject: string | null;
};

type RecipientNotificationRow = {
  id: string;
  request_id: string;
  recipient_class: string;
  notification_status: string;
  notification_result: string | null;
  created_at: string;
  notified_at: string | null;
  target_account_id: string;
  target_display_name_ciphertext: string | null;
  target_first_name_ciphertext: string | null;
  target_last_name_ciphertext: string | null;
  target_keycloak_subject: string;
};

const paginate = <T>(items: readonly T[], page: number, pageSize: number) => {
  const startIndex = (page - 1) * pageSize;
  return items.slice(startIndex, startIndex + pageSize);
};

const readPersonName = (person: PersonColumns): string =>
  resolveUserDisplayName({
    decryptedDisplayName: revealField(person.display_name_ciphertext, `iam.accounts.display_name:${person.keycloak_subject}`),
    firstName: revealField(person.first_name_ciphertext, `iam.accounts.first_name:${person.keycloak_subject}`),
    lastName: revealField(person.last_name_ciphertext, `iam.accounts.last_name:${person.keycloak_subject}`),
    keycloakSubject: person.keycloak_subject,
  });

export const toCanonicalDsrStatus = (status: string): IamDsrCanonicalStatus => {
  if (status === 'queued' || status === 'accepted') {
    return 'queued';
  }
  if (status === 'processing' || status === 'escalated') {
    return 'in_progress';
  }
  if (status === 'completed' || status === 'sent' || status === 'skipped') {
    return 'completed';
  }
  if (status === 'blocked_legal_hold') {
    return 'blocked';
  }
  return 'failed';
};

const includesSearch = (value: string | undefined, search: string) =>
  Boolean(value?.toLowerCase().includes(search.toLowerCase()));

const matchesSearch = (item: IamDsrCaseListItem, search?: string) => {
  if (!search) {
    return true;
  }

  return [
    item.title,
    item.summary,
    item.requestType,
    item.targetDisplayName,
    item.requesterDisplayName,
    item.actorDisplayName,
    item.rawStatus,
    item.type,
    item.format,
  ].some((value) => includesSearch(value, search));
};

const mapRequestRow = (row: RequestRow): IamDsrCaseListItem => {
  const requesterDisplayName =
    row.requester_keycloak_subject && row.requester_display_name_ciphertext !== undefined
      ? readPersonName({
          display_name_ciphertext: row.requester_display_name_ciphertext,
          first_name_ciphertext: row.requester_first_name_ciphertext,
          last_name_ciphertext: row.requester_last_name_ciphertext,
          keycloak_subject: row.requester_keycloak_subject,
        })
      : undefined;
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.target_display_name_ciphertext,
    first_name_ciphertext: row.target_first_name_ciphertext,
    last_name_ciphertext: row.target_last_name_ciphertext,
    keycloak_subject: row.target_keycloak_subject,
  });

  return {
    id: row.id,
    type: 'request',
    canonicalStatus: toCanonicalDsrStatus(row.status),
    rawStatus: row.status,
    title: row.request_type,
    summary: targetDisplayName,
    requestType: row.request_type,
    targetAccountId: row.target_account_id,
    targetDisplayName,
    requesterAccountId: row.requester_account_id ?? undefined,
    requesterDisplayName,
    createdAt: row.request_accepted_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    blockedReason: row.legal_hold_blocked ? 'legal_hold' : undefined,
    metadata: {},
  };
};

const mapExportJobRow = (row: ExportJobRow): IamDsrCaseListItem => {
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.target_display_name_ciphertext,
    first_name_ciphertext: row.target_first_name_ciphertext,
    last_name_ciphertext: row.target_last_name_ciphertext,
    keycloak_subject: row.target_keycloak_subject,
  });
  const requesterDisplayName =
    row.requester_keycloak_subject &&
    row.requester_display_name_ciphertext !== undefined
      ? readPersonName({
          display_name_ciphertext: row.requester_display_name_ciphertext,
          first_name_ciphertext: row.requester_first_name_ciphertext,
          last_name_ciphertext: row.requester_last_name_ciphertext,
          keycloak_subject: row.requester_keycloak_subject,
        })
      : undefined;

  return {
    id: row.id,
    type: 'export_job',
    canonicalStatus: toCanonicalDsrStatus(row.status),
    rawStatus: row.status,
    title: 'export',
    summary: targetDisplayName,
    targetAccountId: row.target_account_id,
    targetDisplayName,
    requesterAccountId: row.requested_by_account_id ?? undefined,
    requesterDisplayName,
    format: row.format,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    metadata: {
      errorMessage: row.error_message ?? undefined,
    },
  };
};

const mapLegalHoldRow = (row: LegalHoldRow): IamDsrCaseListItem => {
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.target_display_name_ciphertext,
    first_name_ciphertext: row.target_first_name_ciphertext,
    last_name_ciphertext: row.target_last_name_ciphertext,
    keycloak_subject: row.target_keycloak_subject,
  });
  const actorDisplayName =
    row.created_by_keycloak_subject && row.created_by_display_name_ciphertext !== undefined
      ? readPersonName({
          display_name_ciphertext: row.created_by_display_name_ciphertext,
          first_name_ciphertext: row.created_by_first_name_ciphertext,
          last_name_ciphertext: row.created_by_last_name_ciphertext,
          keycloak_subject: row.created_by_keycloak_subject,
        })
      : undefined;

  return {
    id: row.id,
    type: 'legal_hold',
    canonicalStatus: row.active ? 'blocked' : 'completed',
    rawStatus: row.active ? 'active' : 'released',
    title: 'legal_hold',
    summary: targetDisplayName,
    targetAccountId: row.account_id,
    targetDisplayName,
    actorAccountId: row.created_by_account_id ?? undefined,
    actorDisplayName,
    createdAt: row.created_at,
    completedAt: row.lifted_at ?? undefined,
    blockedReason: row.hold_reason,
    metadata: {
      holdUntil: row.hold_until ?? undefined,
      liftedByAccountId: row.lifted_by_account_id ?? undefined,
    },
  };
};

const mapProfileCorrectionRow = (row: ProfileCorrectionRow): IamDsrCaseListItem => {
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.target_display_name_ciphertext,
    first_name_ciphertext: row.target_first_name_ciphertext,
    last_name_ciphertext: row.target_last_name_ciphertext,
    keycloak_subject: row.target_keycloak_subject,
  });
  const actorDisplayName =
    row.actor_keycloak_subject && row.actor_display_name_ciphertext !== undefined
      ? readPersonName({
          display_name_ciphertext: row.actor_display_name_ciphertext,
          first_name_ciphertext: row.actor_first_name_ciphertext,
          last_name_ciphertext: row.actor_last_name_ciphertext,
          keycloak_subject: row.actor_keycloak_subject,
        })
      : undefined;

  return {
    id: row.id,
    type: 'profile_correction',
    canonicalStatus: 'completed',
    rawStatus: 'completed',
    title: 'profile_correction',
    summary: targetDisplayName,
    targetAccountId: row.account_id,
    targetDisplayName,
    actorAccountId: row.actor_account_id ?? undefined,
    actorDisplayName,
    createdAt: row.created_at,
    completedAt: row.created_at,
    metadata: {
      correctionReason: row.correction_reason ?? undefined,
    },
  };
};

const mapRecipientNotificationRow = (row: RecipientNotificationRow): IamDsrCaseListItem => {
  const targetDisplayName = readPersonName({
    display_name_ciphertext: row.target_display_name_ciphertext,
    first_name_ciphertext: row.target_first_name_ciphertext,
    last_name_ciphertext: row.target_last_name_ciphertext,
    keycloak_subject: row.target_keycloak_subject,
  });

  return {
    id: row.id,
    type: 'recipient_notification',
    canonicalStatus: toCanonicalDsrStatus(row.notification_status),
    rawStatus: row.notification_status,
    title: row.recipient_class,
    summary: targetDisplayName,
    targetAccountId: row.target_account_id,
    targetDisplayName,
    createdAt: row.created_at,
    completedAt: row.notified_at ?? undefined,
    metadata: {
      requestId: row.request_id,
      notificationResult: row.notification_result ?? undefined,
    },
  };
};

export const loadDsrSelfServiceOverview = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<IamDsrSelfServiceOverview> => {
  const [accountResult, requestResult, exportResult, holdResult] = await Promise.all([
    client.query<AccountSnapshotRow>(
      `
SELECT id, processing_restricted_at::text, processing_restriction_reason, non_essential_processing_opt_out_at::text
FROM iam.accounts
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
      [input.instanceId, input.accountId]
    ),
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
    ),
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
    ),
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
    ),
  ]);

  const account = accountResult.rows[0]!;

  return {
    instanceId: input.instanceId,
    accountId: input.accountId,
    processingRestrictedAt: account.processing_restricted_at ?? undefined,
    processingRestrictionReason: account.processing_restriction_reason ?? undefined,
    nonEssentialProcessingOptOutAt: account.non_essential_processing_opt_out_at ?? undefined,
    nonEssentialProcessingAllowed: !account.non_essential_processing_opt_out_at,
    legalHolds: holdResult.rows.map(mapLegalHoldRow),
    requests: requestResult.rows.map(mapRequestRow),
    exportJobs: exportResult.rows.map(mapExportJobRow),
  };
};

export const listAdminDsrCases = async (
  client: QueryClient,
  input: DsrFilters
): Promise<{ items: readonly IamDsrCaseListItem[]; total: number }> => {
  const [requests, exportJobs, legalHolds, profileCorrections, recipientNotifications] = await Promise.all([
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
    ),
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
    ),
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
    ),
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
    ),
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
    ),
  ]);

  const items: IamDsrCaseListItem[] = [
    ...requests.rows.map(mapRequestRow),
    ...exportJobs.rows.map(mapExportJobRow),
    ...legalHolds.rows.map(mapLegalHoldRow),
    ...profileCorrections.rows.map(mapProfileCorrectionRow),
    ...recipientNotifications.rows.map(mapRecipientNotificationRow),
  ]
    .filter((item) => (input.type ? item.type === input.type : true))
    .filter((item) => (input.status ? item.canonicalStatus === input.status : true))
    .filter((item) => matchesSearch(item, readString(input.search) ?? undefined))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    items: paginate(items, input.page, input.pageSize),
    total: items.length,
  };
};
