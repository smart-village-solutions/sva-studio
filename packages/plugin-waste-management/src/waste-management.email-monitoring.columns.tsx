import { Badge, type StudioColumnDef } from '@sva/studio-ui-react';
import { readPluginLocales } from '@sva/plugin-sdk';
import type {
  WasteEmailSubscriptionSummary,
  WasteEmailDeliverySummary,
} from '@sva/waste-management-contracts';
export type EmailMonitoringTranslate = (
  key: string,
  variables?: Readonly<Record<string, string | number>>
) => string;
export const formatEmailMonitoringTimestamp = (value: string | null, fallback: string) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? fallback
    : parsed.toLocaleString(readPluginLocales().locale, { dateStyle: 'short', timeStyle: 'short' });
};
const pickupDate = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString(readPluginLocales().locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });

export const emailMonitoringSubscriptionColumns = (
  pt: EmailMonitoringTranslate
): readonly StudioColumnDef<WasteEmailSubscriptionSummary>[] => [
  {
    id: 'email',
    header: pt('emailMonitoring.email'),
    cell: (row) => (
      <div className="space-y-1 break-words">
        <p className="break-all font-medium">{row.maskedEmail}</p>
        <p className="text-muted-foreground">{row.city ?? pt('emailMonitoring.unavailable')}</p>
        <Badge>{pt(`emailMonitoring.states.${row.status}`)}</Badge>
        <p className="max-w-56 text-sm text-muted-foreground">
          {pt(`emailMonitoring.stateDescriptions.${row.status}`)}
        </p>
      </div>
    ),
  },
  {
    id: 'items',
    header: pt('emailMonitoring.items'),
    cell: (row) => (
      <ul className="max-w-sm space-y-2 break-words">
        {[...new Set(row.items.map((item) => item.fraction))].map((fraction) => (
          <li key={fraction}>
            <p>{fraction}</p>
            <p className="text-xs text-muted-foreground">
              {row.items
                .filter((item) => item.fraction === fraction)
                .map((item) =>
                  item.slotId.endsWith(':second')
                    ? pt('emailMonitoring.second')
                    : item.slotId.endsWith(':first')
                      ? pt('emailMonitoring.first')
                      : pt('emailMonitoring.reminder')
                )
                .join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: 'delivery',
    header: pt('emailMonitoring.emailDelivery'),
    cell: (row) => (
      <dl className="max-w-72 space-y-3 text-sm">
        <div>
          <dt className="font-medium">{pt('emailMonitoring.lastSentEmail')}</dt>
          <dd>
            {row.lastSentEmail ? (
              <>
                <p>{pt(`emailMonitoring.kinds.${row.lastSentEmail.kind}`)}</p>
                <p className="text-xs text-muted-foreground">{pt('emailMonitoring.sent')}</p>
                <p>
                  {formatEmailMonitoringTimestamp(
                    row.lastSentEmail.sentAt,
                    pt('emailMonitoring.unavailable')
                  )}
                </p>
              </>
            ) : row.lastSentEmail === null ? (
              pt('emailMonitoring.noSentEmail')
            ) : (
              pt('emailMonitoring.unavailable')
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium">
            {row.nextEmail?.status === 'processing'
              ? pt('emailMonitoring.deliveryStates.processing')
              : pt('emailMonitoring.nextEmail')}
          </dt>
          <dd>
            {row.nextEmail ? (
              <>
                <p>{pt(`emailMonitoring.kinds.${row.nextEmail.kind}`)}</p>
                <p className="text-xs text-muted-foreground">{pt('emailMonitoring.scheduled')}</p>
                <p>
                  {formatEmailMonitoringTimestamp(
                    row.nextEmail.scheduledAt,
                    pt('emailMonitoring.unavailable')
                  )}
                </p>
              </>
            ) : row.nextEmail === null ? (
              pt('emailMonitoring.noNextEmail')
            ) : (
              pt('emailMonitoring.unavailable')
            )}
          </dd>
        </div>
      </dl>
    ),
  },
];
export const emailMonitoringDeliveryColumns = (
  pt: EmailMonitoringTranslate
): readonly StudioColumnDef<WasteEmailDeliverySummary>[] => [
  {
    id: 'kind',
    header: pt('emailMonitoring.kind'),
    cell: (row) => (
      <div className="max-w-64 space-y-1 break-words">
        <p className="font-medium">{pt(`emailMonitoring.kinds.${row.kind}`)}</p>
        {row.fraction && <p>{row.fraction}</p>}
        {row.pickupDate && (
          <p className="text-sm text-muted-foreground">
            {pt('emailMonitoring.pickup', { date: pickupDate(row.pickupDate) })}
          </p>
        )}
      </div>
    ),
  },
  {
    id: 'status',
    header: pt('emailMonitoring.deliveryStatus'),
    cell: (row) => (
      <div className="max-w-80 space-y-2">
        <Badge>{pt(`emailMonitoring.deliveryStates.${row.status}`)}</Badge>
        <p className="text-sm text-muted-foreground">
          {row.error
            ? pt(`emailMonitoring.errors.${row.error}`)
            : pt(`emailMonitoring.deliveryDescriptions.${row.status}`)}
        </p>
        <p className="text-xs text-muted-foreground">
          {pt('emailMonitoring.attemptsCount', { count: row.attempts })}
        </p>
      </div>
    ),
  },
  {
    id: 'dates',
    header: pt('emailMonitoring.dates'),
    cell: (row) => (
      <dl className="space-y-2 text-sm">
        {(['createdAt', 'scheduledAt', 'sentAt'] as const).map(
          (key, i) =>
            row[key] && (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">
                  {pt(`emailMonitoring.${['messageCreated', 'scheduled', 'sent'][i]}`)}
                </dt>
                <dd>
                  {formatEmailMonitoringTimestamp(row[key], pt('emailMonitoring.unavailable'))}
                </dd>
              </div>
            )
        )}
      </dl>
    ),
  },
];
