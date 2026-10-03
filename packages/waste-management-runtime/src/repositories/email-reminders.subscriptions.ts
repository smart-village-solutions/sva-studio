import type { SqlExecutor, SqlStatement } from '@sva/data-repositories';
import type {
  WasteEmailReminderPendingSignupInput,
  WasteEmailReminderPendingSignupItem,
  WasteEmailReminderRepository,
} from './email-reminders.js';

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

const buildInsertSubscriptionStatement = (
  input: WasteEmailReminderPendingSignupInput
): SqlStatement => ({
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
  AND (
    status = 'active'
    OR (status = 'pending' AND expires_at > NOW())
  );
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

export const createSubscriptionMethods = (
  executor: SqlExecutor
): Pick<
  WasteEmailReminderRepository,
  'createPendingSignup' | 'countSubscriptionsForEmailLocation' | 'listActiveSubscriptions'
> => ({
  async createPendingSignup(input) {
    await executor.execute(buildInsertSubscriptionStatement(input));
    for (const item of input.items) {
      await executor.execute(buildInsertSubscriptionItemStatement(input.subscriptionId, item));
    }
    await executor.execute(buildInsertOutboxStatement(input));
  },
  async countSubscriptionsForEmailLocation(input) {
    const result = await executor.execute<CountRow>(
      buildCountSubscriptionsForEmailLocationStatement(input)
    );
    const value = result.rows[0]?.total ?? 0;
    return typeof value === 'number' ? value : Number.parseInt(value, 10);
  },
  async listActiveSubscriptions() {
    const result = await executor.execute<ActiveSubscriptionRow>(
      buildListActiveSubscriptionsStatement()
    );
    const subscriptions = new Map<
      string,
      {
        id: string;
        email: string;
        locationLabel: string;
        regionId?: string;
        cityId: string;
        streetId: string;
        houseNumberId?: string;
        unsubscribeTokenHash: string;
        items: Array<{ fractionId: string; slotId: string }>;
      }
    >();
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
});

export const subscriptionStatements = {
  createPendingSignupSubscription: buildInsertSubscriptionStatement,
  createPendingSignupItem: buildInsertSubscriptionItemStatement,
  createPendingSignupOutbox: buildInsertOutboxStatement,
  countSubscriptionsForEmailLocation: buildCountSubscriptionsForEmailLocationStatement,
  listActiveSubscriptions: buildListActiveSubscriptionsStatement,
} as const;
