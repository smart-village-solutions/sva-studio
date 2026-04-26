import { createHash } from 'node:crypto';
import { getWorkspaceContext } from '@sva/server-runtime';

import {
  collectDsrExportPayload,
  serializeDsrExportPayload,
  type DsrExportAccountSnapshot,
  type DsrExportFormat,
} from './dsr-export-payload.js';
import type { QueryClient } from './query-client.js';

export type DsrMaintenanceInput = {
  instanceId: string;
  dryRun: boolean;
};

export type DsrMaintenanceResult = {
  dryRun: boolean;
  queuedExports: number;
  escalated: number;
  finalizedDeletions: number;
  recipientNotifications: number;
};

const hashPseudonym = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);

const resolveAccountById = async (
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

const isLegalHoldActive = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<boolean> => {
  const result = await client.query<{ id: string }>(
    `
SELECT id
FROM iam.legal_holds
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND active = true
  AND (hold_until IS NULL OR hold_until > NOW())
LIMIT 1;
`,
    [input.instanceId, input.accountId]
  );

  return result.rowCount > 0;
};

const emitDsrAuditEvent = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId?: string;
    eventType: string;
    payload: Record<string, unknown>;
  }
): Promise<void> => {
  await client.query(
    `
INSERT INTO iam.activity_logs (instance_id, account_id, event_type, payload, request_id, trace_id)
VALUES ($1, $2::uuid, $3, $4::jsonb, $5, $6);
`,
    [
      input.instanceId,
      input.accountId ?? null,
      input.eventType,
      JSON.stringify(input.payload),
      getWorkspaceContext().requestId ?? null,
      getWorkspaceContext().traceId ?? null,
    ]
  );
};

const appendDsrRequestEvent = async (
  client: QueryClient,
  input: {
    instanceId: string;
    requestId: string;
    actorAccountId?: string;
    eventType: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> => {
  await client.query(
    `
INSERT INTO iam.data_subject_request_events (instance_id, request_id, actor_account_id, event_type, event_payload)
VALUES ($1, $2::uuid, $3::uuid, $4, $5::jsonb);
`,
    [
      input.instanceId,
      input.requestId,
      input.actorAccountId ?? null,
      input.eventType,
      JSON.stringify(input.payload ?? {}),
    ]
  );
};

const processQueuedExportJobs = async (client: QueryClient, input: DsrMaintenanceInput): Promise<number> => {
  const queued = await client.query<{
    id: string;
    target_account_id: string;
    format: DsrExportFormat;
  }>(
    `
SELECT id, target_account_id, format
FROM iam.data_subject_export_jobs
WHERE instance_id = $1
  AND status = 'queued'
ORDER BY created_at ASC
LIMIT 20;
`,
    [input.instanceId]
  );

  if (input.dryRun || queued.rowCount <= 0) {
    return queued.rowCount;
  }

  for (const job of queued.rows) {
    await client.query(
      `
UPDATE iam.data_subject_export_jobs
SET status = 'processing', started_at = NOW(), error_message = NULL
WHERE id = $1::uuid;
`,
      [job.id]
    );

    try {
      const account = await resolveAccountById(client, {
        instanceId: input.instanceId,
        accountId: job.target_account_id,
      });
      if (!account) {
        throw new Error('target_account_not_found');
      }

      const payload = await collectDsrExportPayload(client, {
        instanceId: input.instanceId,
        account,
        format: job.format,
      });

      await client.query(
        `
UPDATE iam.data_subject_export_jobs
SET
  status = 'completed',
  completed_at = NOW(),
  payload_json = $2::jsonb,
  payload_csv = $3,
  payload_xml = $4,
  error_message = NULL
WHERE id = $1::uuid;
`,
        [
          job.id,
          JSON.stringify(payload),
          serializeDsrExportPayload('csv', payload),
          serializeDsrExportPayload('xml', payload),
        ]
      );
    } catch (error) {
      await client.query(
        `
UPDATE iam.data_subject_export_jobs
SET
  status = 'failed',
  completed_at = NOW(),
  error_message = $2
WHERE id = $1::uuid;
`,
        [job.id, error instanceof Error ? error.message : String(error)]
      );
    }
  }

  return queued.rowCount;
};

const escalateOverdueDeleteRequests = async (client: QueryClient, input: DsrMaintenanceInput): Promise<number> => {
  const overdue = await client.query<{ id: string; target_account_id: string }>(
    `
SELECT id, target_account_id
FROM iam.data_subject_requests
WHERE instance_id = $1
  AND request_type = 'deletion'
  AND status IN ('accepted', 'processing')
  AND sla_deadline_at IS NOT NULL
  AND sla_deadline_at < NOW()
  AND escalated_at IS NULL
ORDER BY request_accepted_at ASC;
`,
    [input.instanceId]
  );

  if (input.dryRun || overdue.rowCount <= 0) {
    return overdue.rowCount;
  }

  for (const entry of overdue.rows) {
    await client.query(
      `
UPDATE iam.data_subject_requests
SET status = 'escalated', escalated_at = NOW(), updated_at = NOW()
WHERE id = $1::uuid;
`,
      [entry.id]
    );

    await appendDsrRequestEvent(client, {
      instanceId: input.instanceId,
      requestId: entry.id,
      eventType: 'sla_escalated',
      payload: { reason: 'soft_delete_not_completed_in_time' },
    });

    await emitDsrAuditEvent(client, {
      instanceId: input.instanceId,
      accountId: entry.target_account_id,
      eventType: 'dsr_deletion_sla_escalated',
      payload: {
        request_id: entry.id,
        result: 'failure',
      },
    });
  }

  return overdue.rowCount;
};

const finalizeEligibleDeletions = async (client: QueryClient, input: DsrMaintenanceInput): Promise<number> => {
  const candidates = await client.query<{ id: string; keycloak_subject: string }>(
    `
SELECT id, keycloak_subject
FROM iam.accounts
WHERE instance_id = $1
  AND soft_deleted_at IS NOT NULL
  AND permanently_deleted_at IS NULL
  AND delete_after IS NOT NULL
  AND delete_after <= NOW();
`,
    [input.instanceId]
  );

  if (input.dryRun || candidates.rowCount <= 0) {
    return candidates.rowCount;
  }

  for (const account of candidates.rows) {
    const holdActive = await isLegalHoldActive(client, {
      instanceId: input.instanceId,
      accountId: account.id,
    });

    if (holdActive) {
      await client.query(
        `
UPDATE iam.data_subject_requests
SET
  status = 'blocked_legal_hold',
  legal_hold_blocked = true,
  updated_at = NOW()
WHERE instance_id = $1
  AND target_account_id = $2::uuid
  AND request_type = 'deletion'
  AND status IN ('accepted', 'processing', 'escalated');
`,
        [input.instanceId, account.id]
      );
      continue;
    }

    const pseudonym = `deleted:${hashPseudonym(`${input.instanceId}:${account.id}`)}`;

    await client.query(
      `
UPDATE iam.activity_logs
SET
  account_id = NULL,
  payload =
    (payload - 'actor_user_id' - 'actor_email' - 'actor_display_name') ||
    jsonb_build_object('subject_pseudonym', $2, 'deleted_account', true)
WHERE instance_id = $1
  AND account_id = $3::uuid;
`,
      [input.instanceId, pseudonym, account.id]
    );

    await client.query(
      `
DELETE FROM iam.account_roles
WHERE instance_id = $1
  AND account_id = $2::uuid;
`,
      [input.instanceId, account.id]
    );

    await client.query(
      `
DELETE FROM iam.account_organizations
WHERE instance_id = $1
  AND account_id = $2::uuid;
`,
      [input.instanceId, account.id]
    );

    await client.query(
      `
UPDATE iam.accounts
SET
  keycloak_subject = $3,
  email_ciphertext = NULL,
  display_name_ciphertext = NULL,
  permanently_deleted_at = NOW(),
  delete_after = NULL,
  processing_restricted_at = NULL,
  processing_restriction_reason = NULL,
  non_essential_processing_opt_out_at = NULL,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid;
`,
      [input.instanceId, account.id, pseudonym]
    );

    await client.query(
      `
UPDATE iam.data_subject_requests
SET status = 'completed', completed_at = NOW(), updated_at = NOW(), legal_hold_blocked = false
WHERE instance_id = $1
  AND target_account_id = $2::uuid
  AND request_type = 'deletion'
  AND status IN ('accepted', 'processing', 'escalated', 'blocked_legal_hold');
`,
      [input.instanceId, account.id]
    );

    await emitDsrAuditEvent(client, {
      instanceId: input.instanceId,
      eventType: 'dsr_deletion_finalized',
      payload: {
        subject_pseudonym: pseudonym,
        result: 'success',
      },
    });
  }

  return candidates.rowCount;
};

const processArt19Notifications = async (client: QueryClient, input: DsrMaintenanceInput): Promise<number> => {
  const pending = await client.query<{ id: string }>(
    `
SELECT n.id
FROM iam.data_subject_recipient_notifications n
JOIN iam.data_subject_requests r
  ON r.id = n.request_id
 AND r.instance_id = n.instance_id
WHERE n.instance_id = $1
  AND n.notification_status = 'pending'
  AND r.request_type IN ('rectification', 'restriction', 'deletion')
  AND r.status IN ('completed', 'processing', 'blocked_legal_hold', 'escalated')
ORDER BY n.created_at ASC
LIMIT 200;
`,
    [input.instanceId]
  );

  if (input.dryRun || pending.rowCount <= 0) {
    return pending.rowCount;
  }

  for (const row of pending.rows) {
    await client.query(
      `
UPDATE iam.data_subject_recipient_notifications
SET
  notification_status = 'sent',
  notification_result = 'documented_by_system',
  notified_at = NOW()
WHERE id = $1::uuid;
`,
      [row.id]
    );
  }

  return pending.rowCount;
};

export const runDsrMaintenance = async (
  client: QueryClient,
  input: DsrMaintenanceInput
): Promise<DsrMaintenanceResult> => {
  const queuedExports = await processQueuedExportJobs(client, input);
  const escalated = await escalateOverdueDeleteRequests(client, input);
  const finalizedDeletions = await finalizeEligibleDeletions(client, input);
  const recipientNotifications = await processArt19Notifications(client, input);

  await emitDsrAuditEvent(client, {
    instanceId: input.instanceId,
    eventType: 'dsr_maintenance_executed',
    payload: {
      dry_run: input.dryRun,
      queued_exports_processed: queuedExports,
      escalated_requests: escalated,
      finalized_deletions: finalizedDeletions,
      recipient_notifications_processed: recipientNotifications,
      result: 'success',
    },
  });

  return {
    dryRun: input.dryRun,
    queuedExports,
    escalated,
    finalizedDeletions,
    recipientNotifications,
  };
};
