import type { SqlExecutor, SqlStatement } from '@sva/data-repositories';
import { z } from 'zod';
import type { WasteEmailReminderPlanningOrder, WasteEmailReminderRepository } from './email-reminders.js';
import {
  MAIL_TRANSPORT_NOT_AVAILABLE,
  REMINDER_OUTCOME_UNKNOWN,
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
    AND status = 'pending' AND send_at <= $1::timestamptz
    AND (attempt_count = 0 OR last_error = '${MAIL_TRANSPORT_NOT_AVAILABLE}')
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
  AND status = 'pending'
  AND (attempt_count = 0 OR last_error = '${MAIL_TRANSPORT_NOT_AVAILABLE}')
  AND NOT (dedupe_key = ANY($1::text[]));
`,
  values: [input.validDedupeKeys, input.now],
});

const buildMarkUnresolvedReminderDeliveriesStatement = (input: { readonly now: string }): SqlStatement => ({
  text: `
WITH unresolved AS (
  SELECT id
  FROM waste_email_reminder_outbox
  WHERE message_kind = 'reminder'
    AND (
      (status = 'processing' AND leased_at <= $1::timestamptz - ${STALE_OUTBOX_LEASE_INTERVAL})
      OR (status = 'pending' AND attempt_count > 0
          AND last_error IS DISTINCT FROM '${MAIL_TRANSPORT_NOT_AVAILABLE}')
    )
  ORDER BY id
  FOR UPDATE SKIP LOCKED
)
UPDATE waste_email_reminder_outbox AS outbox
SET status = 'failed',
    last_error = '${REMINDER_OUTCOME_UNKNOWN}',
    leased_at = NULL,
    updated_at = $1::timestamptz
FROM unresolved
WHERE outbox.id = unresolved.id;`,
  values: [input.now],
});

type LockedPlanningOrder = Omit<WasteEmailReminderPlanningOrder, 'memberKeys'> & Readonly<{
  serializedMemberKeys: string | null;
}>;

const memberKeysSchema = z.array(z.string().startsWith('reminder:')).nonempty();

const readReminderMemberKeys = (order: LockedPlanningOrder) => {
  if (!order.dedupeKey.startsWith('reminder-group:')) return undefined;
  try {
    return memberKeysSchema.parse(JSON.parse(order.serializedMemberKeys ?? 'null'));
  } catch {
    throw new Error('invalid_reminder_group_membership');
  }
};

export const createOutboxReconcileMethods = (
  executor: SqlExecutor
): Pick<
  WasteEmailReminderRepository,
  | 'hasDueReminderOutboxEntries'
  | 'cancelInvalidReminderOutboxEntries'
  | 'loadLockedReminderPlanningOrders'
  | 'markUnresolvedReminderDeliveries'
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
  async loadLockedReminderPlanningOrders({ subscriptionId, pickupDates, dedupeKeys }) {
    const subscription = await executor.execute<{ id: string }>({
      text: `SELECT id FROM waste_email_reminder_subscriptions
        WHERE id = $1::uuid AND status = 'active' FOR UPDATE`,
      values: [subscriptionId],
    });
    if (subscription.rows.length === 0) return null;
    const orders = await executor.execute<LockedPlanningOrder>({
      text: `SELECT dedupe_key AS "dedupeKey", status, attempt_count AS "attemptCount",
          payload->'metadata'->>'reminderMemberKeys' AS "serializedMemberKeys"
        FROM waste_email_reminder_outbox
        WHERE subscription_id = $1::uuid AND message_kind = 'reminder'
          AND (dedupe_key = ANY($2::text[]) OR payload->'metadata'->>'pickupDate' = ANY($3::text[]))
        ORDER BY dedupe_key
        FOR UPDATE`,
      values: [subscriptionId, dedupeKeys, pickupDates],
    });
    return orders.rows.map((order) => ({
      dedupeKey: order.dedupeKey,
      status: order.status,
      attemptCount: order.attemptCount,
      memberKeys: readReminderMemberKeys(order),
    }));
  },
  async markUnresolvedReminderDeliveries(input) {
    return (await executor.execute(buildMarkUnresolvedReminderDeliveriesStatement(input))).rowCount;
  },
});

export const outboxReconcileStatements = {
  hasDueReminderOutboxEntries: buildHasDueReminderOutboxEntriesStatement,
  cancelInvalidReminderOutboxEntries: buildCancelInvalidReminderOutboxEntriesStatement,
} as const;
