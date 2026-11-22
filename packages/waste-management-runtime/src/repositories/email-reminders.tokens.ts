import type { SqlExecutor, SqlStatement } from '@sva/data-repositories';
import type { WasteEmailReminderRepository } from './email-reminders.js';

type SubscriptionStatusRow = Readonly<{
  id: string;
  status: string;
  location_label: string;
}>;

type UnsubscribeSubscriptionRow = Readonly<{
  subscription_id: string;
  unsubscribe_token_hash: string;
}>;

const buildSelectSubscriptionByDoiTokenHashStatement = (tokenHash: string): SqlStatement => ({
  text: `
SELECT id, status, location_label
FROM waste_email_reminder_subscriptions
WHERE doi_token_hash = $1
FOR UPDATE;
`,
  values: [tokenHash],
});

const buildSelectSubscriptionByUnsubscribeTokenHashStatement = (
  tokenHash: string
): SqlStatement => ({
  text: `
SELECT id, status, location_label
FROM waste_email_reminder_subscriptions
WHERE unsubscribe_token_hash = $1
FOR UPDATE;
`,
  values: [tokenHash],
});

const buildSelectSubscriptionByIdStatement = (subscriptionId: string): SqlStatement => ({
  text: `
SELECT
  id::text AS subscription_id,
  unsubscribe_token_hash
FROM waste_email_reminder_subscriptions
WHERE id = $1::uuid;
`,
  values: [subscriptionId],
});

const buildActivateSubscriptionStatement = (input: {
  readonly subscriptionId: string;
  readonly now: string;
}): SqlStatement => ({
  text: `
UPDATE waste_email_reminder_subscriptions
SET status = 'active',
    activated_at = GREATEST($2::timestamptz, clock_timestamp()),
    updated_at = GREATEST($2::timestamptz, clock_timestamp())
WHERE id = $1::uuid
  AND status = 'pending'
  AND expires_at > GREATEST($2::timestamptz, clock_timestamp())
RETURNING id;
`,
  values: [input.subscriptionId, input.now],
});

const buildUnsubscribeSubscriptionStatement = (input: {
  readonly subscriptionId: string;
  readonly now: string;
}): SqlStatement => ({
  text: `
WITH revoked AS (
  UPDATE waste_email_reminder_subscriptions
  SET status = 'unsubscribed',
      email = NULL,
      email_hash = NULL,
      location_label = '',
      house_number_id = NULL,
      unsubscribed_at = COALESCE(unsubscribed_at, $2::timestamptz),
      updated_at = CASE
        WHEN status <> 'unsubscribed' OR email IS NOT NULL OR email_hash IS NOT NULL
          OR location_label <> '' OR house_number_id IS NOT NULL
        THEN $2::timestamptz
        ELSE updated_at
      END
  WHERE id = $1::uuid
    AND status IN ('pending', 'active', 'unsubscribed')
  RETURNING id
)
UPDATE waste_email_reminder_outbox AS outbox
SET payload = '{}'::jsonb,
    status = CASE WHEN outbox.status IN ('pending', 'processing') THEN 'cancelled' ELSE outbox.status END,
    leased_at = NULL,
    last_error = CASE
      WHEN outbox.status IN ('pending', 'processing') THEN 'subscription_unsubscribed'
      WHEN outbox.last_error IN ('subscription_unsubscribed', 'doi_token_expired', 'reminder_no_longer_applicable') THEN outbox.last_error
      WHEN outbox.status = 'failed' THEN 'dispatch_failed'
      ELSE NULL
    END,
    updated_at = $2::timestamptz
FROM revoked
WHERE outbox.subscription_id = revoked.id
  AND (outbox.payload <> '{}'::jsonb OR outbox.leased_at IS NOT NULL
    OR outbox.status IN ('pending', 'processing')
    OR (outbox.last_error IS NOT NULL AND outbox.last_error NOT IN (
      'subscription_unsubscribed', 'doi_token_expired', 'reminder_no_longer_applicable', 'dispatch_failed'
    )));
`,
  values: [input.subscriptionId, input.now],
});

const loadUnsubscribeSubscriptionById = async (
  executor: SqlExecutor,
  input: Parameters<WasteEmailReminderRepository['loadUnsubscribeSubscriptionById']>[0]
): ReturnType<WasteEmailReminderRepository['loadUnsubscribeSubscriptionById']> => {
  const result = await executor.execute<UnsubscribeSubscriptionRow>(
    buildSelectSubscriptionByIdStatement(input.subscriptionId)
  );
  const subscription = result.rows[0];
  if (!subscription) return null;
  return {
    subscriptionId: subscription.subscription_id,
    unsubscribeTokenHash: subscription.unsubscribe_token_hash,
  };
};

export const createTokenMethods = (
  executor: SqlExecutor
): Pick<
  WasteEmailReminderRepository,
  'loadUnsubscribeSubscriptionById' | 'activateByDoiTokenHash' | 'unsubscribeByTokenHash'
> => ({
  loadUnsubscribeSubscriptionById: (input) => loadUnsubscribeSubscriptionById(executor, input),
  async activateByDoiTokenHash(input) {
    const result = await executor.execute<SubscriptionStatusRow>(
      buildSelectSubscriptionByDoiTokenHashStatement(input.tokenHash)
    );
    const subscription = result.rows[0];
    if (!subscription) {
      return { status: 'invalid' };
    }
    if (subscription.status === 'active') {
      return {
        status: 'already_active',
        subscriptionId: subscription.id,
        locationLabel: subscription.location_label,
      };
    }
    if (subscription.status !== 'pending') {
      return { status: 'invalid' };
    }
    const updated = await executor.execute(
      buildActivateSubscriptionStatement({ subscriptionId: subscription.id, now: input.now })
    );
    if (updated.rowCount === 0) {
      return { status: 'expired' };
    }
    return {
      status: 'activated',
      subscriptionId: subscription.id,
      locationLabel: subscription.location_label,
    };
  },
  async unsubscribeByTokenHash(input) {
    const result = await executor.execute<SubscriptionStatusRow>(
      buildSelectSubscriptionByUnsubscribeTokenHashStatement(input.tokenHash)
    );
    const subscription = result.rows[0];
    if (!subscription) {
      return { status: 'invalid' };
    }
    if (!['pending', 'active', 'unsubscribed'].includes(subscription.status)) {
      return { status: 'invalid' };
    }
    await executor.execute(
      buildUnsubscribeSubscriptionStatement({ subscriptionId: subscription.id, now: input.now })
    );
    return {
      status: subscription.status === 'unsubscribed' ? 'already_unsubscribed' : 'unsubscribed',
      subscriptionId: subscription.id,
      locationLabel: '',
    };
  },
});

export const tokenStatements = {
  selectSubscriptionByDoiTokenHash: buildSelectSubscriptionByDoiTokenHashStatement,
  selectSubscriptionByUnsubscribeTokenHash: buildSelectSubscriptionByUnsubscribeTokenHashStatement,
  selectSubscriptionById: buildSelectSubscriptionByIdStatement,
  activateSubscription: buildActivateSubscriptionStatement,
  unsubscribeSubscription: buildUnsubscribeSubscriptionStatement,
} as const;
