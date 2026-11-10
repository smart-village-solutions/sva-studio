import type { SqlExecutor } from '@sva/data-repositories';
import type {
  WasteEmailDeliverySummary,
  WasteEmailMonitoringOverview,
  WasteEmailMonitoringQuery,
  WasteEmailSubscriptionSummary,
} from '@sva/waste-management-contracts';

// Preserve the agreed edge characters without exposing short address parts in full.
export const maskWasteEmail = (email: string): string => {
  const parts = email.split('@');
  if (parts.length !== 2 || parts.some((part) => !part)) return '***@***';
  return parts
    .map((part) => {
      const chars = Array.from(part);
      if (chars.length <= 2) return '*'.repeat(chars.length);
      return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars.at(-1)}`;
    })
    .join('@');
};

export const classifyWasteEmailError = (
  value: string | null
): WasteEmailDeliverySummary['error'] => {
  if (!value || value.startsWith('provider_message_id:') || value === 'dispatch_claimed')
    return null;
  if (value.startsWith('mail_transport_not_available:')) return 'transport_unavailable';
  if (
    [
      'subscription_unsubscribed',
      'doi_token_expired',
      'reminder_no_longer_applicable',
    ].includes(value)
  )
    return 'cancelled';
  return 'dispatch_failed';
};

type SubscriptionRow = Omit<WasteEmailSubscriptionSummary, 'maskedEmail'> & { email: string };
type DeliveryRow = Omit<WasteEmailDeliverySummary, 'error'> & { lastError: string | null };

export const loadWasteEmailMonitoring = async (
  executor: SqlExecutor,
  query: WasteEmailMonitoringQuery
): Promise<WasteEmailMonitoringOverview> => {
  const filter = query.status ?? null;
  const count = await executor.execute<{ total: number }>({
    text: `SELECT COUNT(*)::int AS total FROM waste_email_reminder_subscriptions
      WHERE ($1::text IS NULL OR status = $1)`,
    values: [filter],
  });
  const subscriptions = await executor.execute<SubscriptionRow>({
    text: `SELECT s.id::text, s.email, s.status, c.name AS city,
      to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt", to_char(s.activated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "activatedAt",
      to_char(s.unsubscribed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "unsubscribedAt",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('fraction', COALESCE(f.name, i.fraction_id::text), 'slotId', i.slot_id) ORDER BY f.name, i.slot_id)
        FROM waste_email_reminder_subscription_items i LEFT JOIN waste_fractions f ON f.id = i.fraction_id
        WHERE i.subscription_id = s.id), '[]'::jsonb) AS items
      FROM waste_email_reminder_subscriptions s LEFT JOIN waste_cities c ON c.id = s.city_id
      WHERE ($1::text IS NULL OR s.status = $1)
      ORDER BY s.created_at DESC, s.id DESC LIMIT $2 OFFSET $3`,
    values: [filter, query.pageSize, (query.page - 1) * query.pageSize],
  });
  let deliveries: readonly WasteEmailDeliverySummary[] = [];
  let deliveryTotal = 0;
  if (query.subscriptionId) {
    const deliveryCount = await executor.execute<{ total: number }>({
      text: 'SELECT COUNT(*)::int AS total FROM waste_email_reminder_outbox WHERE subscription_id = $1::uuid',
      values: [query.subscriptionId],
    });
    deliveryTotal = deliveryCount.rows[0]?.total ?? 0;
    const rows = await executor.execute<DeliveryRow>({
      text: `SELECT id::text, message_kind AS kind, status,
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt", to_char(send_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "scheduledAt", to_char(sent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "sentAt",
        attempt_count AS attempts, payload->'templatePayload'->>'fractionName' AS fraction,
        payload->'metadata'->>'pickupDate' AS "pickupDate", last_error AS "lastError"
        FROM waste_email_reminder_outbox WHERE subscription_id = $1::uuid
        ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
      values: [query.subscriptionId, query.pageSize, (query.deliveryPage - 1) * query.pageSize],
    });
    deliveries = rows.rows.map(({ lastError, ...row }) => ({
      ...row,
      error: classifyWasteEmailError(lastError),
    }));
  }
  return {
    subscriptions: subscriptions.rows.map(({ email, ...row }) => ({
      ...row,
      maskedEmail: maskWasteEmail(email),
    })),
    total: count.rows[0]?.total ?? 0,
    deliveries,
    deliveryTotal,
  };
};
