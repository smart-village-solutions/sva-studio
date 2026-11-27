import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  StudioListPageTemplate,
  StudioLoadingState,
  StudioErrorState,
  useStudioTableQuery,
} from '@sva/studio-ui-react';
import {
  wasteEmailMonitoringPermission,
  type WasteEmailMonitoringOverview,
} from '@sva/waste-management-contracts';
import {
  getWasteEmailMonitoring,
  searchWasteEmailMonitoring,
} from './waste-management.api.read.js';
import {
  EmailMonitoringTables,
  emailMonitoringPageSize,
} from './waste-management.email-monitoring.tables.js';
import type { EmailMonitoringTranslate } from './waste-management.email-monitoring.columns.js';
import {
  MonitoringControls,
  type EmailMonitoringSelection,
} from './waste-management.email-monitoring.controls.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

const emptyData: WasteEmailMonitoringOverview = {
  subscriptions: [],
  total: 0,
  deliveries: [],
  deliveryTotal: 0,
};
const useEmailMonitoring = () => {
  const [selection, setSelection] = useState<EmailMonitoringSelection>({
    page: 1,
    status: '',
    searchEmail: '',
    searchVersion: 0,
    selected: null,
    deliveryPage: 1,
    refresh: 0,
  });
  const query = { page: selection.page, pageSize: emailMonitoringPageSize };
  const read = (
    controls: { deliveryPage: number; subscriptionId?: string },
    signal: AbortSignal
  ) =>
    selection.searchEmail
      ? searchWasteEmailMonitoring(
          { ...query, ...controls, email: selection.searchEmail },
          { signal }
        )
      : getWasteEmailMonitoring({
          ...query,
          ...controls,
          ...(selection.status ? { status: selection.status } : {}),
        });
  const key = ['waste-email-monitoring', query, selection.status, selection.searchEmail];
  const overview = useStudioTableQuery([...key, { deliveryPage: 1 }], (signal) =>
    read({ deliveryPage: 1 }, signal)
  );
  const detail = {
    deliveryPage: selection.deliveryPage,
    ...(selection.selected ? { subscriptionId: selection.selected.id } : {}),
  };
  const hasDeliveryQuery = Boolean(selection.selected) || selection.deliveryPage !== 1;
  const delivery = useStudioTableQuery(
    [...key, detail],
    (signal) => read(detail, signal),
    hasDeliveryQuery
  );
  const list = hasDeliveryQuery ? delivery : overview;
  const refreshVersion = useRef(selection.refresh);
  useEffect(() => {
    if (refreshVersion.current === selection.refresh) return;
    refreshVersion.current = selection.refresh;
    void list.refetch();
  }, [list.refetch, selection.refresh]);
  const error = list.error
    ? selection.searchEmail && resolveApiErrorCode(list.error) === 'invalid_request'
      ? 'emailMonitoring.emailSearch.invalid'
      : 'emailMonitoring.error'
    : null;
  const data = list.data ?? overview.data ?? emptyData;
  return {
    selection,
    setSelection,
    data: hasDeliveryQuery && !delivery.data ? { ...data, deliveries: [], deliveryTotal: 0 } : data,
    error,
    loading: list.state === 'loading',
  };
};

const WasteEmailMonitoringContent = ({ pt }: { pt: EmailMonitoringTranslate }) => {
  const { selection, setSelection, data, error, loading } = useEmailMonitoring();
  const activeTotal = data.activeTotal;
  return (
    <div className="min-w-0 max-w-6xl space-y-6" aria-busy={loading}>
      <p className="min-h-7 text-lg font-semibold tabular-nums" aria-live="polite">
        {activeTotal === undefined
          ? null
          : pt('emailMonitoring.activeSubscriptions', { count: activeTotal })}
      </p>
      <MonitoringControls pt={pt} selection={selection} onChange={setSelection} />
      <p className="text-sm text-muted-foreground">{pt('emailMonitoring.privacy')}</p>
      {error && <StudioErrorState>{pt(error)}</StudioErrorState>}
      <EmailMonitoringTables
        pt={pt}
        data={data}
        loading={loading && data.subscriptions.length === 0}
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
