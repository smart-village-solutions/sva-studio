import { useLayoutEffect, useRef } from 'react';
import { Button, StudioDataTable } from '@sva/studio-ui-react';
import type {
  WasteEmailMonitoringOverview,
  WasteEmailSubscriptionSummary,
} from '@sva/waste-management-contracts';
import {
  emailMonitoringSubscriptionColumns,
  emailMonitoringDeliveryColumns,
  type EmailMonitoringTranslate,
} from './waste-management.email-monitoring.columns.js';

export const emailMonitoringPageSize = 25;
type TableProps = {
  data: WasteEmailMonitoringOverview;
  pt: EmailMonitoringTranslate;
  selected: WasteEmailSubscriptionSummary | null;
  page: number;
  deliveryPage: number;
  onSelect: (row: WasteEmailSubscriptionSummary | null) => void;
  onPage: (page: number) => void;
  onDeliveryPage: (page: number) => void;
};
const tableLabels = (pt: EmailMonitoringTranslate) => ({
  selectionColumn: pt('emailMonitoring.select'),
  actionsColumn: pt('emailMonitoring.select'),
  loading: pt('emailMonitoring.loading'),
  selectAllRows: () => pt('emailMonitoring.select'),
  selectRow: () => pt('emailMonitoring.select'),
});
const Pagination = ({
  page,
  total,
  onPage,
  pt,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
  pt: EmailMonitoringTranslate;
}) => {
  const pages = Math.max(1, Math.ceil(total / emailMonitoringPageSize));
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
const SubscriptionTable = ({ pt, data, selected, onSelect, page, onPage }: TableProps) => (
  <StudioDataTable
    selectionMode="none"
    sorting={{ mode: 'disabled' }}
    ariaLabel={pt('emailMonitoring.subscriptions')}
    caption={pt('emailMonitoring.subscriptions')}
    labels={tableLabels(pt)}
    data={data.subscriptions}
    columns={emailMonitoringSubscriptionColumns(pt)}
    getRowId={(row) => row.id}
    emptyState={<p>{pt('emailMonitoring.empty')}</p>}
    rowActions={(row) => (
      <Button
        variant="secondary"
        aria-pressed={row.id === selected?.id}
        onClick={() => onSelect(row)}
      >
        {pt('emailMonitoring.select')}
      </Button>
    )}
    footer={<Pagination page={page} total={data.total} onPage={onPage} pt={pt} />}
  />
);
const DeliveryTable = ({
  pt,
  data,
  selected,
  onSelect,
  deliveryPage,
  onDeliveryPage,
}: TableProps & { selected: WasteEmailSubscriptionSummary }) => {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    heading.current?.focus();
  }, [selected.id]);
  return (
    <section className="space-y-3" aria-label={pt('emailMonitoring.deliveries')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold">
          {pt('emailMonitoring.deliveries')} · {selected.maskedEmail}
        </h2>
        <Button variant="secondary" onClick={() => onSelect(null)}>
          {pt('emailMonitoring.close')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{pt('emailMonitoring.deliveryNotice')}</p>
      <StudioDataTable
        selectionMode="none"
        sorting={{ mode: 'disabled' }}
        ariaLabel={pt('emailMonitoring.deliveries')}
        caption={selected.id}
        labels={tableLabels(pt)}
        data={data.deliveries}
        columns={emailMonitoringDeliveryColumns(pt)}
        getRowId={(row) => row.id}
        emptyState={<p>{pt('emailMonitoring.emptyDeliveries')}</p>}
        footer={
          <Pagination
            page={deliveryPage}
            total={data.deliveryTotal}
            onPage={onDeliveryPage}
            pt={pt}
          />
        }
      />
    </section>
  );
};
export const EmailMonitoringTables = (props: TableProps) => {
  const subscriptionHeading = useRef<HTMLHeadingElement>(null);
  const onSelect = (row: WasteEmailSubscriptionSummary | null) => {
    props.onSelect(row);
    if (!row) subscriptionHeading.current?.focus();
  };
  return (
    <>
      <h2 ref={subscriptionHeading} tabIndex={-1} className="text-lg font-semibold">
        {props.pt('emailMonitoring.subscriptions')}
      </h2>
      <SubscriptionTable {...props} onSelect={onSelect} />
      {props.selected && <DeliveryTable {...props} selected={props.selected} onSelect={onSelect} />}
    </>
  );
};
