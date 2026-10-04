import type { DsrExportAccountSnapshot as AccountSnapshot } from '@sva/iam-governance/dsr-export-payload';
import type { QueryClient } from '../db.js';
import type { DsrRequestType } from './shared.js';

const ART19_RECIPIENT_CLASSES = [
  'internal_processor',
  'downstream_export',
  'analytics_sink',
] as const;
export const resolveAccountBySubject = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<AccountSnapshot | undefined> => {
  const query = await client.query<AccountSnapshot>(
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

  if (query.rowCount <= 0) {
    return undefined;
  }
  return query.rows[0];
};
export const createDsrRequest = async (
  client: QueryClient,
  input: {
    instanceId: string;
    requestType: DsrRequestType;
    status: 'accepted' | 'processing' | 'blocked_legal_hold' | 'completed' | 'failed' | 'escalated';
    requesterAccountId?: string;
    targetAccountId: string;
    payload?: Record<string, unknown>;
    legalHoldBlocked?: boolean;
    slaDeadlineAt?: string;
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
VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6, $7::jsonb, $8::timestamptz, $9::timestamptz)
RETURNING id;
`,
    [
      input.instanceId,
      input.requestType,
      input.status,
      input.requesterAccountId ?? null,
      input.targetAccountId,
      input.legalHoldBlocked ?? false,
      JSON.stringify(input.payload ?? {}),
      input.slaDeadlineAt ?? null,
      input.completedAt ?? null,
    ]
  );

  return created.rows[0]!.id;
};

export const ensureArt19RecipientRows = async (
  client: QueryClient,
  input: { instanceId: string; requestId: string }
): Promise<void> => {
  for (const recipientClass of ART19_RECIPIENT_CLASSES) {
    await client.query(
      `
INSERT INTO iam.data_subject_recipient_notifications (
  instance_id,
  request_id,
  recipient_class,
  notification_status
)
VALUES ($1, $2::uuid, $3, 'pending')
ON CONFLICT (instance_id, request_id, recipient_class) DO NOTHING;
`,
      [input.instanceId, input.requestId, recipientClass]
    );
  }
};
export const resolveRequesterAccountId = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<string | undefined> => {
  const account = await resolveAccountBySubject(client, input);
  return account?.id;
};
