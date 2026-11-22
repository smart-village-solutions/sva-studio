import type { SqlExecutor, SqlStatement } from '@sva/data-repositories';
import type { WasteEmailReminderRepository } from './email-reminders.js';
import {
  OUTBOX_DISPATCH_CLAIM,
  STALE_OUTBOX_LEASE_INTERVAL,
} from './email-reminders.outbox-dispatch.js';

const buildHasDueReminderOutboxEntriesStatement = (input: {
  readonly now: string;
}): SqlStatement => ({
  text: `
SELECT EXISTS (
  SELECT 1
  FROM waste_email_reminder_outbox
  WHERE message_kind = 'reminder'
    AND (
      (status = 'pending' AND send_at <= $1::timestamptz)
      OR (status = 'processing' AND leased_at <= $1::timestamptz - ${STALE_OUTBOX_LEASE_INTERVAL})
    )
) AS due;
`,
  values: [input.now],
});

const buildCancelInvalidReminderOutboxEntriesStatement = (input: {
  readonly validDedupeKeys: readonly string[];
  readonly now: string;
}): SqlStatement => ({
  text: `
UPDATE waste_email_reminder_outbox
SET status = 'cancelled',
    leased_at = NULL,
    updated_at = $2::timestamptz,
    last_error = 'reminder_no_longer_applicable'
WHERE message_kind = 'reminder'
  AND status IN ('pending', 'processing')
  AND (
    last_error IS DISTINCT FROM '${OUTBOX_DISPATCH_CLAIM}'
    OR leased_at <= $2::timestamptz - ${STALE_OUTBOX_LEASE_INTERVAL}
  )
  AND NOT (dedupe_key = ANY($1::text[]));
`,
  values: [input.validDedupeKeys, input.now],
});

export const createOutboxReconcileMethods = (
  executor: SqlExecutor
): Pick<
  WasteEmailReminderRepository,
  | 'hasDueReminderOutboxEntries'
  | 'cancelInvalidReminderOutboxEntries'
> => ({
  async hasDueReminderOutboxEntries(input) {
    const result = await executor.execute<{ due: boolean }>(
      buildHasDueReminderOutboxEntriesStatement(input)
    );
    return result.rows[0]?.due === true;
  },
  async cancelInvalidReminderOutboxEntries(input) {
    const result = await executor.execute(buildCancelInvalidReminderOutboxEntriesStatement(input));
    return result.rowCount;
  },
});

export const outboxReconcileStatements = {
  hasDueReminderOutboxEntries: buildHasDueReminderOutboxEntriesStatement,
  cancelInvalidReminderOutboxEntries: buildCancelInvalidReminderOutboxEntriesStatement,
} as const;
