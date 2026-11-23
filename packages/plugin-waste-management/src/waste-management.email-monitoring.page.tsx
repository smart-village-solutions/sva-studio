import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import { StudioListPageTemplate, StudioLoadingState, StudioErrorState } from '@sva/studio-ui-react';
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

type Result = { data: WasteEmailMonitoringOverview; listKey: string; deliveryKey: string };
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
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listKey = `${selection.page}:${selection.status}:${selection.searchVersion}`;
  const deliveryKey = `${listKey}:${selection.selected?.id}:${selection.deliveryPage}`;
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const query = {
      page: selection.page,
      pageSize: emailMonitoringPageSize,
      deliveryPage: selection.deliveryPage,
      ...(selection.selected ? { subscriptionId: selection.selected.id } : {}),
    };
    const request = selection.searchEmail
      ? searchWasteEmailMonitoring(
          { ...query, email: selection.searchEmail },
          { signal: controller.signal }
        )
      : getWasteEmailMonitoring({
          ...query,
          ...(selection.status ? { status: selection.status } : {}),
        });
    void request
      .then((data) => {
        if (current) setResult({ data, listKey, deliveryKey });
      })
      .catch((requestError: unknown) => {
        if (current) {
          setError(
            selection.searchEmail && resolveApiErrorCode(requestError) === 'invalid_request'
              ? 'emailMonitoring.emailSearch.invalid'
              : 'emailMonitoring.error'
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [selection, listKey, deliveryKey]);
  return { selection, setSelection, result, listKey, deliveryKey, error, loading };
};

const WasteEmailMonitoringContent = ({ pt }: { pt: EmailMonitoringTranslate }) => {
  const { selection, setSelection, result, listKey, deliveryKey, error, loading } =
    useEmailMonitoring();
  const data = result?.listKey === listKey ? result.data : emptyData;
  const deliveries = result?.deliveryKey === deliveryKey ? result.data.deliveries : [];
  const deliveryTotal = result?.deliveryKey === deliveryKey ? result.data.deliveryTotal : 0;
  const activeTotal = result?.data.activeTotal;
  return (
    <div className="min-w-0 max-w-6xl space-y-6" aria-busy={loading}>
      {activeTotal !== undefined && (
        <p className="text-lg font-semibold tabular-nums" aria-live="polite">
          {pt('emailMonitoring.activeSubscriptions', { count: activeTotal })}
        </p>
      )}
      <MonitoringControls pt={pt} selection={selection} onChange={setSelection} />
      <p className="text-sm text-muted-foreground">{pt('emailMonitoring.privacy')}</p>
      {error && <StudioErrorState>{pt(error)}</StudioErrorState>}
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
