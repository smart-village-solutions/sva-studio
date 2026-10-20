import type { MailDispatchPayload } from '@sva/core';
import type { SqlExecutor, SqlStatement } from '@sva/data-repositories';
import type { WasteEmailReminderRepository } from './email-reminders.js';

type LeasedOutboxRow = Readonly<{
  id: string;
  subscription_id: string;
  message_kind: 'doi' | 'reminder';
  transport_id: string;
  template_key: string;
  dedupe_key: string;
  attempt_count: number;
  payload: MailDispatchPayload | string;
}>;

type EnqueuedOutboxRow = Readonly<{
  id: string;
}>;

export const STALE_OUTBOX_LEASE_INTERVAL = "INTERVAL '15 minutes'";
export const OUTBOX_DISPATCH_CLAIM = 'dispatch_claimed';

const buildLeaseDueOutboxEntriesStatement = (input: {
  readonly now: string;
  readonly limit: number;
}): SqlStatement => ({
  text: `
WITH due AS (
  SELECT outbox.id
  FROM waste_email_reminder_outbox AS outbox
  INNER JOIN waste_email_reminder_subscriptions AS subscription
    ON subscription.id = outbox.subscription_id
  WHERE (
    (outbox.status = 'pending' AND outbox.send_at <= $1::timestamptz)
    OR (
      outbox.status = 'processing'
      AND outbox.leased_at IS NOT NULL
      AND outbox.leased_at <= $1::timestamptz - ${STALE_OUTBOX_LEASE_INTERVAL}
    )
  )
  AND (
    (outbox.message_kind = 'doi' AND subscription.status = 'pending' AND subscription.expires_at > $1::timestamptz)
    OR (outbox.message_kind = 'reminder' AND subscription.status = 'active')
  )
  ORDER BY outbox.send_at ASC, outbox.created_at ASC
  LIMIT $2
  FOR UPDATE OF outbox SKIP LOCKED
)
UPDATE waste_email_reminder_outbox AS outbox
SET status = 'processing',
    leased_at = $1::timestamptz,
    attempt_count = outbox.attempt_count + 1,
    last_error = NULL,
    updated_at = $1::timestamptz
FROM due
WHERE outbox.id = due.id
RETURNING
  outbox.id,
  outbox.subscription_id,
  outbox.message_kind,
  outbox.transport_id,
  outbox.template_key,
  outbox.dedupe_key,
  outbox.attempt_count,
  outbox.payload;
`,
  values: [input.now, input.limit],
});

const buildClaimOutboxEntryForDispatchStatement = (input: {
  readonly outboxId: string;
  readonly leasedAt: string;
}): SqlStatement => ({
  text: `
UPDATE waste_email_reminder_outbox AS outbox
SET last_error = '${OUTBOX_DISPATCH_CLAIM}',
    updated_at = $2::timestamptz
FROM waste_email_reminder_subscriptions AS subscription
WHERE outbox.id = $1::uuid
  AND subscription.id = outbox.subscription_id
  AND outbox.status = 'processing'
  AND outbox.leased_at = $2::timestamptz
  AND outbox.last_error IS DISTINCT FROM '${OUTBOX_DISPATCH_CLAIM}'
  AND (
    (outbox.message_kind = 'doi' AND subscription.status = 'pending' AND subscription.expires_at > $2::timestamptz)
    OR (outbox.message_kind = 'reminder' AND subscription.status = 'active')
  )
RETURNING outbox.id;
`,
  values: [input.outboxId, input.leasedAt],
});

const buildMarkOutboxEntrySentStatement = (input: {
  readonly outboxId: string;
  readonly now: string;
  readonly leasedAt: string;
  readonly providerMessageId?: string;
}): SqlStatement => ({
  text: `
UPDATE waste_email_reminder_outbox
SET status = 'sent',
    sent_at = $2::timestamptz,
    leased_at = NULL,
    updated_at = $2::timestamptz,
    last_error = CASE
      WHEN $3::text IS NULL THEN NULL
      ELSE CONCAT('provider_message_id:', $3)
    END
WHERE id = $1::uuid
  AND status = 'processing'
  AND leased_at = $4::timestamptz
  AND last_error = '${OUTBOX_DISPATCH_CLAIM}'
RETURNING id;
`,
  values: [input.outboxId, input.now, input.providerMessageId ?? null, input.leasedAt],
});

const buildMarkOutboxEntryFailedStatement = (input: {
  readonly outboxId: string;
  readonly now: string;
  readonly leasedAt: string;
  readonly errorMessage: string;
  readonly retryAt?: string;
}): SqlStatement => ({
  text: `
UPDATE waste_email_reminder_outbox
SET status = CASE WHEN $4::timestamptz IS NULL THEN 'failed' ELSE 'pending' END,
    leased_at = NULL,
    updated_at = $2::timestamptz,
    send_at = COALESCE($4::timestamptz, send_at),
    last_error = $3
WHERE id = $1::uuid
  AND status = 'processing'
  AND leased_at = $5::timestamptz
  AND last_error = '${OUTBOX_DISPATCH_CLAIM}'
RETURNING id;
`,
  values: [input.outboxId, input.now, input.errorMessage, input.retryAt ?? null, input.leasedAt],
});

export const createOutboxDispatchMethods = (
  executor: SqlExecutor
): Pick<
  WasteEmailReminderRepository,
  | 'leaseDueOutboxEntries'
  | 'claimOutboxEntryForDispatch'
  | 'markOutboxEntrySent'
  | 'markOutboxEntryFailed'
> => ({
  async leaseDueOutboxEntries(input) {
    const result = await executor.execute<LeasedOutboxRow>(
      buildLeaseDueOutboxEntriesStatement(input)
    );
    return result.rows.map((row) => ({
      id: row.id,
      subscriptionId: row.subscription_id,
      messageKind: row.message_kind,
      transportId: row.transport_id,
      templateKey: row.template_key,
      dedupeKey: row.dedupe_key,
      attemptCount: row.attempt_count,
      payload:
        typeof row.payload === 'string'
          ? (JSON.parse(row.payload) as MailDispatchPayload)
          : row.payload,
    }));
  },
  async claimOutboxEntryForDispatch(input) {
    const result = await executor.execute<EnqueuedOutboxRow>(
      buildClaimOutboxEntryForDispatchStatement(input)
    );
    return result.rows.length > 0;
  },
  async markOutboxEntrySent(input) {
    const result = await executor.execute<EnqueuedOutboxRow>(
      buildMarkOutboxEntrySentStatement(input)
    );
    return result.rows.length > 0;
  },
  async markOutboxEntryFailed(input) {
    const result = await executor.execute<EnqueuedOutboxRow>(
      buildMarkOutboxEntryFailedStatement(input)
    );
    return result.rows.length > 0;
  },
});

export const outboxDispatchStatements = {
  leaseDueOutboxEntries: buildLeaseDueOutboxEntriesStatement,
  claimOutboxEntryForDispatch: buildClaimOutboxEntryForDispatchStatement,
  markOutboxEntrySent: buildMarkOutboxEntrySentStatement,
  markOutboxEntryFailed: buildMarkOutboxEntryFailedStatement,
} as const;
