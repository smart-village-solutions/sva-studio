import type { SqlExecutor, SqlStatement } from '@sva/data-repositories';
import type {
  WasteEmailReminderOutboxEntryInput,
  WasteEmailReminderOutboxRefreshInput,
  WasteEmailReminderRepository,
} from './email-reminders.js';

type EnqueuedOutboxRow = Readonly<{ id: string }>;

const buildInsertGenericOutboxStatement = (
  input: WasteEmailReminderOutboxEntryInput
): SqlStatement => ({
  text: `
INSERT INTO waste_email_reminder_outbox (
  id,
  subscription_id,
  message_kind,
  transport_id,
  template_key,
  send_at,
  dedupe_key,
  status,
  payload
)
VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz, $7, 'pending', $8::jsonb)
ON CONFLICT (dedupe_key) DO UPDATE
SET transport_id = EXCLUDED.transport_id,
    template_key = EXCLUDED.template_key,
    send_at = CASE
      WHEN waste_email_reminder_outbox.attempt_count > 0
        THEN GREATEST(waste_email_reminder_outbox.send_at, EXCLUDED.send_at)
      ELSE EXCLUDED.send_at
    END,
    payload = EXCLUDED.payload,
    updated_at = NOW()
WHERE waste_email_reminder_outbox.status = 'pending'
RETURNING id;
`,
  values: [
    input.id,
    input.subscriptionId,
    input.messageKind,
    input.transportId,
    input.templateKey,
    input.sendAt,
    input.dedupeKey,
    JSON.stringify(input.payload),
  ],
});

const buildRefreshPendingOutboxStatement = (
  input: WasteEmailReminderOutboxRefreshInput
): SqlStatement => ({
  text: `
UPDATE waste_email_reminder_outbox
SET transport_id = $4,
    template_key = $5,
    send_at = CASE
      WHEN attempt_count > 0 THEN GREATEST(send_at, $6::timestamptz)
      ELSE $6::timestamptz
    END,
    payload = $7::jsonb,
    updated_at = NOW()
WHERE dedupe_key = $1
  AND subscription_id = $2::uuid
  AND message_kind = $3
  AND status = 'pending'
RETURNING id;
`,
  values: [
    input.dedupeKey,
    input.subscriptionId,
    input.messageKind,
    input.transportId,
    input.templateKey,
    input.sendAt,
    JSON.stringify(input.payload),
  ],
});

export const createOutboxUpsertMethods = (
  executor: SqlExecutor
): Pick<WasteEmailReminderRepository, 'enqueueOutboxEntry' | 'refreshPendingOutboxEntry'> => ({
  async enqueueOutboxEntry(input) {
    const result = await executor.execute<EnqueuedOutboxRow>(
      buildInsertGenericOutboxStatement(input)
    );
    const persistedId = result.rows[0]?.id;
    if (!persistedId) return 'duplicate';
    return persistedId === input.id ? 'inserted' : 'refreshed';
  },
  async refreshPendingOutboxEntry(input) {
    const result = await executor.execute<EnqueuedOutboxRow>(
      buildRefreshPendingOutboxStatement(input)
    );
    return result.rows.length > 0;
  },
});

export const outboxUpsertStatements = {
  createOutboxEntry: buildInsertGenericOutboxStatement,
} as const;
