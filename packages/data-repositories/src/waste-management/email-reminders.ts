import type { MailDispatchPayload } from '@sva/core';

import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';

export type WasteEmailReminderPendingSignupItem = Readonly<{
  id: string;
  fractionId: string;
  slotId: string;
}>;

export type WasteEmailReminderPendingSignupInput = Readonly<{
  subscriptionId: string;
  email: string;
  emailHash: string;
  selection: Readonly<{
    regionId?: string;
    cityId: string;
    streetId: string;
    houseNumberId?: string;
  }>;
  locationLabel: string;
  consentVersion: string;
  consentAcceptedAt: string;
  doiTokenHash: string;
  unsubscribeTokenHash: string;
  expiresAt: string;
  items: readonly WasteEmailReminderPendingSignupItem[];
  outbox: Readonly<{
    id: string;
    transportId: string;
    templateKey: string;
    sendAt: string;
    dedupeKey: string;
    payload: MailDispatchPayload;
  }>;
}>;

export type WasteEmailReminderActivationResult =
  | Readonly<{
      status: 'activated' | 'already_active';
      subscriptionId: string;
      locationLabel: string;
    }>
  | Readonly<{
      status: 'expired' | 'invalid';
    }>;

export type WasteEmailReminderUnsubscribeResult =
  | Readonly<{
      status: 'unsubscribed' | 'already_unsubscribed';
      subscriptionId: string;
      locationLabel: string;
    }>
  | Readonly<{
      status: 'invalid';
    }>;

export type WasteEmailReminderActiveSubscription = Readonly<{
  id: string;
  email: string;
  locationLabel: string;
  regionId?: string;
  cityId: string;
  streetId: string;
  houseNumberId?: string;
  unsubscribeTokenHash: string;
  items: readonly Readonly<{
    fractionId: string;
    slotId: string;
  }>[];
}>;

export type WasteEmailReminderOutboxEntryInput = Readonly<{
  id: string;
  subscriptionId: string;
  messageKind: 'doi' | 'reminder';
  transportId: string;
  templateKey: string;
  sendAt: string;
  dedupeKey: string;
  payload: MailDispatchPayload;
}>;

export type WasteEmailReminderOutboxLease = Readonly<{
  id: string;
  subscriptionId: string;
  messageKind: 'doi' | 'reminder';
  transportId: string;
  templateKey: string;
  dedupeKey: string;
  attemptCount: number;
  payload: MailDispatchPayload;
}>;

export type WasteEmailReminderRepository = Readonly<{
  createPendingSignup: (input: WasteEmailReminderPendingSignupInput) => Promise<void>;
  countSubscriptionsForEmailLocation: (input: {
    readonly emailHash: string;
    readonly selection: WasteEmailReminderPendingSignupInput['selection'];
  }) => Promise<number>;
  listActiveSubscriptions: () => Promise<readonly WasteEmailReminderActiveSubscription[]>;
  enqueueOutboxEntry: (input: WasteEmailReminderOutboxEntryInput) => Promise<'inserted' | 'duplicate'>;
  leaseDueOutboxEntries: (input: {
    readonly now: string;
    readonly limit: number;
  }) => Promise<readonly WasteEmailReminderOutboxLease[]>;
  markOutboxEntrySent: (input: {
    readonly outboxId: string;
    readonly now: string;
    readonly providerMessageId?: string;
  }) => Promise<void>;
  markOutboxEntryFailed: (input: {
    readonly outboxId: string;
    readonly now: string;
    readonly errorMessage: string;
    readonly retryAt?: string;
  }) => Promise<void>;
  activateByDoiTokenHash: (input: { readonly tokenHash: string; readonly now: string }) => Promise<WasteEmailReminderActivationResult>;
  unsubscribeByTokenHash: (input: { readonly tokenHash: string; readonly now: string }) => Promise<WasteEmailReminderUnsubscribeResult>;
}>;

type SubscriptionStatusRow = Readonly<{
  id: string;
  status: string;
  location_label: string;
  expires_at: string;
}>;

type CountRow = Readonly<{
  total: number | string;
}>;

type ActiveSubscriptionRow = Readonly<{
  subscription_id: string;
  email: string;
  location_label: string;
  region_id: string | null;
  city_id: string;
  street_id: string;
  house_number_id: string | null;
  unsubscribe_token_hash: string;
  fraction_id: string;
  slot_id: string;
}>;

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

const buildInsertSubscriptionStatement = (input: WasteEmailReminderPendingSignupInput): SqlStatement => ({
  text: `
INSERT INTO waste_email_reminder_subscriptions (
  id,
  email,
  email_hash,
  status,
  region_id,
  city_id,
  street_id,
  house_number_id,
  location_label,
  consent_version,
  consent_accepted_at,
  doi_token_hash,
  unsubscribe_token_hash,
  expires_at
)
VALUES ($1::uuid, $2, $3, 'pending', $4::uuid, $5::uuid, $6, $7::uuid, $8, $9, $10::timestamptz, $11, $12, $13::timestamptz);
`,
  values: [
    input.subscriptionId,
    input.email,
    input.emailHash,
    input.selection.regionId ?? null,
    input.selection.cityId,
    input.selection.streetId,
    input.selection.houseNumberId ?? null,
    input.locationLabel,
    input.consentVersion,
    input.consentAcceptedAt,
    input.doiTokenHash,
    input.unsubscribeTokenHash,
    input.expiresAt,
  ],
});

const buildInsertSubscriptionItemStatement = (
  subscriptionId: string,
  item: WasteEmailReminderPendingSignupItem
): SqlStatement => ({
  text: `
INSERT INTO waste_email_reminder_subscription_items (
  id,
  subscription_id,
  fraction_id,
  slot_id
)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4);
`,
  values: [item.id, subscriptionId, item.fractionId, item.slotId],
});

const buildInsertOutboxStatement = (input: WasteEmailReminderPendingSignupInput): SqlStatement => ({
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
VALUES ($1::uuid, $2::uuid, 'doi', $3, $4, $5::timestamptz, $6, 'pending', $7::jsonb)
ON CONFLICT (dedupe_key) DO NOTHING;
`,
  values: [
    input.outbox.id,
    input.subscriptionId,
    input.outbox.transportId,
    input.outbox.templateKey,
    input.outbox.sendAt,
    input.outbox.dedupeKey,
    JSON.stringify(input.outbox.payload),
  ],
});

const buildInsertGenericOutboxStatement = (input: WasteEmailReminderOutboxEntryInput): SqlStatement => ({
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
ON CONFLICT (dedupe_key) DO NOTHING;
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

const buildCountSubscriptionsForEmailLocationStatement = (input: {
  readonly emailHash: string;
  readonly selection: WasteEmailReminderPendingSignupInput['selection'];
}): SqlStatement => ({
  text: `
SELECT COUNT(*)::int AS total
FROM waste_email_reminder_subscriptions
WHERE email_hash = $1
  AND region_id IS NOT DISTINCT FROM $2::uuid
  AND city_id = $3::uuid
  AND street_id = $4
  AND house_number_id IS NOT DISTINCT FROM $5::uuid
  AND status IN ('pending', 'active');
`,
  values: [
    input.emailHash,
    input.selection.regionId ?? null,
    input.selection.cityId,
    input.selection.streetId,
    input.selection.houseNumberId ?? null,
  ],
});

const buildListActiveSubscriptionsStatement = (): SqlStatement => ({
  text: `
SELECT
  s.id AS subscription_id,
  s.email,
  s.location_label,
  s.region_id,
  s.city_id,
  s.street_id,
  s.house_number_id,
  s.unsubscribe_token_hash,
  i.fraction_id,
  i.slot_id
FROM waste_email_reminder_subscriptions AS s
INNER JOIN waste_email_reminder_subscription_items AS i
  ON i.subscription_id = s.id
WHERE s.status = 'active'
ORDER BY s.created_at ASC, i.created_at ASC;
`,
  values: [],
});

const buildLeaseDueOutboxEntriesStatement = (input: { readonly now: string; readonly limit: number }): SqlStatement => ({
  text: `
WITH due AS (
  SELECT id
  FROM waste_email_reminder_outbox
  WHERE status = 'pending'
    AND send_at <= $1::timestamptz
  ORDER BY send_at ASC, created_at ASC
  LIMIT $2
  FOR UPDATE SKIP LOCKED
)
UPDATE waste_email_reminder_outbox AS outbox
SET status = 'processing',
    leased_at = $1::timestamptz,
    attempt_count = outbox.attempt_count + 1,
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

const buildMarkOutboxEntrySentStatement = (input: {
  readonly outboxId: string;
  readonly now: string;
  readonly providerMessageId?: string;
}): SqlStatement => ({
  text: `
UPDATE waste_email_reminder_outbox
SET status = 'sent',
    sent_at = $2::timestamptz,
    leased_at = NULL,
    updated_at = $2::timestamptz,
    last_error = CASE
      WHEN $3 IS NULL THEN NULL
      ELSE CONCAT('provider_message_id:', $3)
    END
WHERE id = $1::uuid;
`,
  values: [input.outboxId, input.now, input.providerMessageId ?? null],
});

const buildMarkOutboxEntryFailedStatement = (input: {
  readonly outboxId: string;
  readonly now: string;
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
WHERE id = $1::uuid;
`,
  values: [input.outboxId, input.now, input.errorMessage, input.retryAt ?? null],
});

const buildSelectSubscriptionByDoiTokenHashStatement = (tokenHash: string): SqlStatement => ({
  text: `
SELECT id, status, location_label, expires_at
FROM waste_email_reminder_subscriptions
WHERE doi_token_hash = $1
LIMIT 1;
`,
  values: [tokenHash],
});

const buildSelectSubscriptionByUnsubscribeTokenHashStatement = (tokenHash: string): SqlStatement => ({
  text: `
SELECT id, status, location_label, expires_at
FROM waste_email_reminder_subscriptions
WHERE unsubscribe_token_hash = $1
LIMIT 1;
`,
  values: [tokenHash],
});

const buildActivateSubscriptionStatement = (input: { readonly subscriptionId: string; readonly now: string }): SqlStatement => ({
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

const buildUnsubscribeSubscriptionStatement = (input: { readonly subscriptionId: string; readonly now: string }): SqlStatement => ({
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

export const createWasteEmailReminderRepository = (executor: SqlExecutor): WasteEmailReminderRepository => ({
  async createPendingSignup(input) {
    await executor.execute(buildInsertSubscriptionStatement(input));
    for (const item of input.items) {
      await executor.execute(buildInsertSubscriptionItemStatement(input.subscriptionId, item));
    }
    await executor.execute(buildInsertOutboxStatement(input));
  },
  async countSubscriptionsForEmailLocation(input) {
    const result = await executor.execute<CountRow>(buildCountSubscriptionsForEmailLocationStatement(input));
    const value = result.rows[0]?.total ?? 0;
    return typeof value === 'number' ? value : Number.parseInt(value, 10);
  },
  async listActiveSubscriptions() {
    const result = await executor.execute<ActiveSubscriptionRow>(buildListActiveSubscriptionsStatement());
    const subscriptions = new Map<string, {
      id: string;
      email: string;
      locationLabel: string;
      regionId?: string;
      cityId: string;
      streetId: string;
      houseNumberId?: string;
      unsubscribeTokenHash: string;
      items: Array<{ fractionId: string; slotId: string }>;
    }>();
    for (const row of result.rows) {
      const existing = subscriptions.get(row.subscription_id) ?? {
        id: row.subscription_id,
        email: row.email,
        locationLabel: row.location_label,
        cityId: row.city_id,
        streetId: row.street_id,
        unsubscribeTokenHash: row.unsubscribe_token_hash,
        items: [],
        ...(row.region_id ? { regionId: row.region_id } : {}),
        ...(row.house_number_id ? { houseNumberId: row.house_number_id } : {}),
      };
      existing.items.push({
        fractionId: row.fraction_id,
        slotId: row.slot_id,
      });
      subscriptions.set(row.subscription_id, existing);
    }
    return [...subscriptions.values()];
  },
  async enqueueOutboxEntry(input) {
    const result = await executor.execute(buildInsertGenericOutboxStatement(input));
    return result.rowCount > 0 ? 'inserted' : 'duplicate';
  },
  async leaseDueOutboxEntries(input) {
    const result = await executor.execute<LeasedOutboxRow>(buildLeaseDueOutboxEntriesStatement(input));
    return result.rows.map((row) => ({
      id: row.id,
      subscriptionId: row.subscription_id,
      messageKind: row.message_kind,
      transportId: row.transport_id,
      templateKey: row.template_key,
      dedupeKey: row.dedupe_key,
      attemptCount: row.attempt_count,
      payload: typeof row.payload === 'string' ? (JSON.parse(row.payload) as MailDispatchPayload) : row.payload,
    }));
  },
  async markOutboxEntrySent(input) {
    await executor.execute(buildMarkOutboxEntrySentStatement(input));
  },
  async markOutboxEntryFailed(input) {
    await executor.execute(buildMarkOutboxEntryFailedStatement(input));
  },
  async activateByDoiTokenHash(input) {
    const result = await executor.execute<SubscriptionStatusRow>(buildSelectSubscriptionByDoiTokenHashStatement(input.tokenHash));
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
    await executor.execute(buildActivateSubscriptionStatement({ subscriptionId: subscription.id, now: input.now }));
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
    await executor.execute(buildUnsubscribeSubscriptionStatement({ subscriptionId: subscription.id, now: input.now }));
    return {
      status: 'unsubscribed',
      subscriptionId: subscription.id,
      locationLabel: subscription.location_label,
    };
  },
});

export const wasteEmailReminderStatements = {
  createPendingSignupSubscription: buildInsertSubscriptionStatement,
  createPendingSignupItem: buildInsertSubscriptionItemStatement,
  createPendingSignupOutbox: buildInsertOutboxStatement,
  createOutboxEntry: buildInsertGenericOutboxStatement,
  countSubscriptionsForEmailLocation: buildCountSubscriptionsForEmailLocationStatement,
  listActiveSubscriptions: buildListActiveSubscriptionsStatement,
  leaseDueOutboxEntries: buildLeaseDueOutboxEntriesStatement,
  markOutboxEntrySent: buildMarkOutboxEntrySentStatement,
  markOutboxEntryFailed: buildMarkOutboxEntryFailedStatement,
  selectSubscriptionByDoiTokenHash: buildSelectSubscriptionByDoiTokenHashStatement,
  selectSubscriptionByUnsubscribeTokenHash: buildSelectSubscriptionByUnsubscribeTokenHashStatement,
  activateSubscription: buildActivateSubscriptionStatement,
  unsubscribeSubscription: buildUnsubscribeSubscriptionStatement,
} as const;
