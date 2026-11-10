import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Badge,
  Button,
  Select,
  StudioDataTable,
  StudioListPageTemplate,
  StudioLoadingState,
  StudioErrorState,
  type StudioColumnDef,
} from '@sva/studio-ui-react';
import {
  wasteEmailMonitoringPermission,
  type WasteEmailMonitoringOverview,
  type WasteEmailSubscriptionStatus,
  type WasteEmailSubscriptionSummary,
  type WasteEmailDeliverySummary,
} from '@sva/waste-management-contracts';
import { getWasteEmailMonitoring } from './waste-management.api.read.js';

const pageSize = 25;
type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;
const timestamp = (value: string | null, fallback: string) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString();
};

const Pagination = ({
  page,
  total,
  onPage,
  pt,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
  pt: Translate;
}) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pt('emailMonitoring.page', { page, pages, total })}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {pt('emailMonitoring.previous')}
        </Button>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {pt('emailMonitoring.next')}
        </Button>
      </div>
    </div>
  );
};

const subscriptionColumns = (
  pt: Translate
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
const deliveryColumns = (pt: Translate): readonly StudioColumnDef<WasteEmailDeliverySummary>[] => [
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

const WasteEmailMonitoringContent = () => {
  const pt = usePluginTranslation('waste-management');
  const access = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const canRead =
    access.isResolved &&
    !access.hasError &&
    access.permissionActions.includes(wasteEmailMonitoringPermission);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<WasteEmailSubscriptionStatus | ''>('');
  const [selected, setSelected] = useState<WasteEmailSubscriptionSummary | null>(null);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<WasteEmailMonitoringOverview | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let current = true;
    setData(null);
    setError(false);
    if (!canRead) return;
    void getWasteEmailMonitoring({
      page,
      pageSize,
      deliveryPage,
      ...(status ? { status } : {}),
      ...(selected ? { subscriptionId: selected.id } : {}),
    })
      .then((result) => {
        if (current) setData(result);
      })
      .catch(() => {
        if (current) setError(true);
      });
    return () => {
      current = false;
    };
  }, [canRead, page, status, selected, deliveryPage, refresh]);
  const labels = {
    selectionColumn: pt('emailMonitoring.select'),
    actionsColumn: pt('emailMonitoring.select'),
    loading: pt('emailMonitoring.loading'),
    selectAllRows: () => pt('emailMonitoring.select'),
    selectRow: () => pt('emailMonitoring.select'),
  };
  return (
    <StudioListPageTemplate
      title={pt('emailMonitoring.title')}
      description={pt('emailMonitoring.description')}
    >
      {!access.isResolved ? (
        <StudioLoadingState>{pt('emailMonitoring.loading')}</StudioLoadingState>
      ) : !canRead ? (
        <StudioErrorState>{pt('emailMonitoring.forbidden')}</StudioErrorState>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <label className="space-y-2 text-sm font-medium">
              {pt('emailMonitoring.statusFilter')}
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as WasteEmailSubscriptionStatus | '');
                  setPage(1);
                  setSelected(null);
                  setDeliveryPage(1);
                }}
              >
                <option value="">{pt('emailMonitoring.all')}</option>
                {(['pending', 'active', 'unsubscribed', 'expired'] as const).map((value) => (
                  <option key={value} value={value}>
                    {pt(`emailMonitoring.states.${value}`)}
                  </option>
                ))}
              </Select>
            </label>
            <Button variant="secondary" onClick={() => setRefresh((v) => v + 1)}>
              {pt('emailMonitoring.refresh')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{pt('emailMonitoring.privacy')}</p>
          {error ? (
            <StudioErrorState>{pt('emailMonitoring.error')}</StudioErrorState>
          ) : !data ? (
            <StudioLoadingState>{pt('emailMonitoring.loading')}</StudioLoadingState>
          ) : (
            <>
              <StudioDataTable
                selectionMode="none"
                sorting={{ mode: 'disabled' }}
                ariaLabel={pt('emailMonitoring.subscriptions')}
                caption={pt('emailMonitoring.subscriptions')}
                labels={labels}
                data={data.subscriptions}
                columns={subscriptionColumns(pt)}
                getRowId={(row) => row.id}
                emptyState={<p>{pt('emailMonitoring.empty')}</p>}
                rowActions={(row) => (
                  <Button
                    variant="secondary"
                    aria-pressed={row.id === selected?.id}
                    onClick={() => {
                      setSelected(row);
                      setDeliveryPage(1);
                    }}
                  >
                    {pt('emailMonitoring.select')}
                  </Button>
                )}
                footer={
                  <Pagination
                    page={page}
                    total={data.total}
                    onPage={(next) => {
                      setPage(next);
                      setSelected(null);
                      setDeliveryPage(1);
                    }}
                    pt={pt}
                  />
                }
              />
              {selected && (
                <section className="space-y-3" aria-label={pt('emailMonitoring.deliveries')}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">
                      {pt('emailMonitoring.deliveries')} · {selected.maskedEmail}
                    </h2>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelected(null);
                        setDeliveryPage(1);
                      }}
                    >
                      {pt('emailMonitoring.close')}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {pt('emailMonitoring.deliveryNotice')}
                  </p>
                  <StudioDataTable
                    selectionMode="none"
                    sorting={{ mode: 'disabled' }}
                    ariaLabel={pt('emailMonitoring.deliveries')}
                    caption={selected.id}
                    labels={labels}
                    data={data.deliveries}
                    columns={deliveryColumns(pt)}
                    getRowId={(row) => row.id}
                    emptyState={<p>{pt('emailMonitoring.emptyDeliveries')}</p>}
                    footer={
                      <Pagination
                        page={deliveryPage}
                        total={data.deliveryTotal}
                        onPage={setDeliveryPage}
                        pt={pt}
                      />
                    }
                  />
                </section>
              )}
            </>
          )}
        </div>
      )}
    </StudioListPageTemplate>
  );
};

export const WasteEmailMonitoringPage = () => {
  const access = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  return (
    <WasteEmailMonitoringContent
      key={`${access.instanceId}:${access.subjectId}:${access.organizationId}:${access.isResolved}`}
    />
  );
};
