import { Badge, type StudioColumnDef } from '@sva/studio-ui-react';
import type {
  WasteEmailSubscriptionSummary,
  WasteEmailDeliverySummary,
} from '@sva/waste-management-contracts';
export type EmailMonitoringTranslate = (
  key: string,
  variables?: Readonly<Record<string, string | number>>
) => string;
const timestamp = (value: string | null, fallback: string) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString();
};

export const emailMonitoringSubscriptionColumns = (
  pt: EmailMonitoringTranslate
): readonly StudioColumnDef<WasteEmailSubscriptionSummary>[] => [
  {
    id: 'email',
    header: pt('emailMonitoring.email'),
    cell: (row) => (
      <div>
        <p className="font-medium">{row.maskedEmail}</p>
        <p className="break-all font-mono text-xs text-muted-foreground">{row.id}</p>
      </div>
    ),
  },
  {
    id: 'status',
    header: pt('emailMonitoring.status'),
    cell: (row) => <Badge>{pt(`emailMonitoring.states.${row.status}`)}</Badge>,
  },
  {
    id: 'city',
    header: pt('emailMonitoring.city'),
    cell: (row) => row.city ?? pt('emailMonitoring.unavailable'),
  },
  {
    id: 'items',
    header: pt('emailMonitoring.items'),
    cell: (row) => (
      <ul className="space-y-1">
        {row.items.map((item) => (
          <li key={`${item.fraction}:${item.slotId}`}>
            {item.fraction} ·{' '}
            {item.slotId.endsWith(':second')
              ? pt('emailMonitoring.second')
              : item.slotId.endsWith(':first')
                ? pt('emailMonitoring.first')
                : item.slotId}
          </li>
        ))}
      </ul>
    ),
  },
  ...(['createdAt', 'activatedAt', 'unsubscribedAt'] as const).map((key, i) => ({
    id: key,
    header: pt(`emailMonitoring.${['created', 'activated', 'unsubscribed'][i]}`),
    cell: (row: WasteEmailSubscriptionSummary) =>
      timestamp(row[key], pt('emailMonitoring.unavailable')),
  })),
];
export const emailMonitoringDeliveryColumns = (
  pt: EmailMonitoringTranslate
): readonly StudioColumnDef<WasteEmailDeliverySummary>[] => [
  {
    id: 'kind',
    header: pt('emailMonitoring.kind'),
    cell: (row) => pt(`emailMonitoring.kinds.${row.kind}`),
  },
  {
    id: 'status',
    header: pt('emailMonitoring.status'),
    cell: (row) => <Badge>{pt(`emailMonitoring.deliveryStates.${row.status}`)}</Badge>,
  },
  {
    id: 'fraction',
    header: pt('emailMonitoring.fraction'),
    cell: (row) =>
      [row.fraction, row.pickupDate].filter(Boolean).join(' · ') ||
      pt('emailMonitoring.unavailable'),
  },
  ...(['createdAt', 'scheduledAt', 'sentAt'] as const).map((key, i) => ({
    id: key,
    header: pt(`emailMonitoring.${['created', 'scheduled', 'sent'][i]}`),
    cell: (row: WasteEmailDeliverySummary) =>
      timestamp(row[key], pt('emailMonitoring.unavailable')),
  })),
  { id: 'attempts', header: pt('emailMonitoring.attempts'), cell: (row) => row.attempts },
  {
    id: 'error',
    header: pt('emailMonitoring.failure'),
    cell: (row) =>
      row.error ? pt(`emailMonitoring.errors.${row.error}`) : pt('emailMonitoring.unavailable'),
  },
];
