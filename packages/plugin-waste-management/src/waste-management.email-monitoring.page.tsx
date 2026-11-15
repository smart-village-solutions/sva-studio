import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  Select,
  StudioListPageTemplate,
  StudioLoadingState,
  StudioErrorState,
} from '@sva/studio-ui-react';
import {
  wasteEmailMonitoringPermission,
  type WasteEmailMonitoringOverview,
  type WasteEmailSubscriptionStatus,
  type WasteEmailSubscriptionSummary,
} from '@sva/waste-management-contracts';
import { getWasteEmailMonitoring } from './waste-management.api.read.js';
import {
  EmailMonitoringTables,
  emailMonitoringPageSize,
} from './waste-management.email-monitoring.tables.js';
import type { EmailMonitoringTranslate } from './waste-management.email-monitoring.columns.js';

type Selection = {
  page: number;
  status: WasteEmailSubscriptionStatus | '';
  selected: WasteEmailSubscriptionSummary | null;
  deliveryPage: number;
  refresh: number;
};
type Result = { data: WasteEmailMonitoringOverview; listKey: string; deliveryKey: string };
const emptyData: WasteEmailMonitoringOverview = {
  subscriptions: [],
  total: 0,
  deliveries: [],
  deliveryTotal: 0,
};
const MonitoringControls = ({
  pt,
  selection,
  onChange,
}: {
  pt: EmailMonitoringTranslate;
  selection: Selection;
  onChange: (selection: Selection) => void;
}) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <label className="space-y-2 text-sm font-medium">
      {pt('emailMonitoring.statusFilter')}
      <Select
        value={selection.status}
        onChange={(event) =>
          onChange({
            ...selection,
            status: event.target.value as Selection['status'],
            page: 1,
            selected: null,
            deliveryPage: 1,
          })
        }
      >
        <option value="">{pt('emailMonitoring.all')}</option>
        {(['pending', 'active', 'unsubscribed', 'expired'] as const).map((value) => (
          <option key={value} value={value}>
            {pt(`emailMonitoring.states.${value}`)}
          </option>
        ))}
      </Select>
    </label>
    <Button
      variant="secondary"
      onClick={() => onChange({ ...selection, refresh: selection.refresh + 1 })}
    >
      {pt('emailMonitoring.refresh')}
    </Button>
  </div>
);

const WasteEmailMonitoringContent = ({ pt }: { pt: EmailMonitoringTranslate }) => {
  const [selection, setSelection] = useState<Selection>({
    page: 1,
    status: '',
    selected: null,
    deliveryPage: 1,
    refresh: 0,
  });
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const listKey = `${selection.page}:${selection.status}`;
  const deliveryKey = `${listKey}:${selection.selected?.id}:${selection.deliveryPage}`;
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(false);
    void getWasteEmailMonitoring({
      page: selection.page,
      pageSize: emailMonitoringPageSize,
      deliveryPage: selection.deliveryPage,
      ...(selection.status ? { status: selection.status } : {}),
      ...(selection.selected ? { subscriptionId: selection.selected.id } : {}),
    })
      .then((data) => {
        if (current) setResult({ data, listKey, deliveryKey });
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [selection, listKey, deliveryKey]);
  const data = result?.listKey === listKey ? result.data : emptyData;
  const deliveries = result?.deliveryKey === deliveryKey ? result.data.deliveries : [];
  const deliveryTotal = result?.deliveryKey === deliveryKey ? result.data.deliveryTotal : 0;
  return (
    <div className="min-w-0 max-w-6xl space-y-6" aria-busy={loading}>
      <MonitoringControls pt={pt} selection={selection} onChange={setSelection} />
      <p className="text-sm text-muted-foreground">{pt('emailMonitoring.privacy')}</p>
      {error && <StudioErrorState>{pt('emailMonitoring.error')}</StudioErrorState>}
      {loading && <StudioLoadingState>{pt('emailMonitoring.loading')}</StudioLoadingState>}
      <EmailMonitoringTables
        pt={pt}
        data={{ ...data, deliveries, deliveryTotal }}
        selected={selection.selected}
        page={selection.page}
        deliveryPage={selection.deliveryPage}
        onSelect={(selected) => setSelection({ ...selection, selected, deliveryPage: 1 })}
        onPage={(page) => setSelection({ ...selection, page, selected: null, deliveryPage: 1 })}
        onDeliveryPage={(deliveryPage) => setSelection({ ...selection, deliveryPage })}
      />
    </div>
  );
};

export const WasteEmailMonitoringPage = () => {
  const access = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const pt = usePluginTranslation('wasteManagement');
  const canRead =
    access.isResolved &&
    !access.hasError &&
    access.permissionActions.includes(wasteEmailMonitoringPermission);
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
        <WasteEmailMonitoringContent
          pt={pt}
          key={`${access.instanceId}:${access.subjectId}:${access.organizationId}`}
        />
      )}
    </StudioListPageTemplate>
  );
};
