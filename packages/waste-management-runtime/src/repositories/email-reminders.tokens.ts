import type { SqlExecutor, SqlStatement } from '@sva/data-repositories';
import type { WasteEmailReminderRepository } from './email-reminders.js';
import { buildCancelPendingReminderOutboxEntriesStatement } from './email-reminders.outbox-dispatch.js';

type SubscriptionStatusRow = Readonly<{
  id: string;
  status: string;
  location_label: string;
  expires_at: string;
}>;

type UnsubscribeSubscriptionRow = Readonly<{
  subscription_id: string;
  unsubscribe_token_hash: string;
}>;

const buildSelectSubscriptionByDoiTokenHashStatement = (tokenHash: string): SqlStatement => ({
  text: `
SELECT id, status, location_label, expires_at
FROM waste_email_reminder_subscriptions
WHERE doi_token_hash = $1
LIMIT 1;
`,
  values: [tokenHash],
});

const buildSelectSubscriptionByUnsubscribeTokenHashStatement = (
  tokenHash: string
): SqlStatement => ({
  text: `
SELECT id, status, location_label, expires_at
FROM waste_email_reminder_subscriptions
WHERE unsubscribe_token_hash = $1
LIMIT 1;
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
    activated_at = $2::timestamptz,
    updated_at = $2::timestamptz
WHERE id = $1::uuid
  AND status = 'pending';
`,
  values: [input.subscriptionId, input.now],
});

const buildUnsubscribeSubscriptionStatement = (input: {
  readonly subscriptionId: string;
  readonly now: string;
}): SqlStatement => ({
  text: `
UPDATE waste_email_reminder_subscriptions
SET status = 'unsubscribed',
    unsubscribed_at = $2::timestamptz,
    updated_at = $2::timestamptz
WHERE id = $1::uuid
  AND status IN ('pending', 'active');
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
    if (new Date(subscription.expires_at).getTime() < new Date(input.now).getTime()) {
      return { status: 'expired' };
    }
    await executor.execute(
      buildActivateSubscriptionStatement({ subscriptionId: subscription.id, now: input.now })
    );
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
    if (subscription.status === 'unsubscribed') {
      return {
        status: 'already_unsubscribed',
        subscriptionId: subscription.id,
        locationLabel: subscription.location_label,
      };
    }
    if (subscription.status !== 'pending' && subscription.status !== 'active') {
      return { status: 'invalid' };
    }
    await executor.execute(
      buildUnsubscribeSubscriptionStatement({ subscriptionId: subscription.id, now: input.now })
    );
    await executor.execute(
      buildCancelPendingReminderOutboxEntriesStatement({
        subscriptionId: subscription.id,
        now: input.now,
      })
    );
    return {
      status: 'unsubscribed',
      subscriptionId: subscription.id,
      locationLabel: subscription.location_label,
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
