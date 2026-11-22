import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  Input,
  Select,
  StudioListPageTemplate,
  StudioLoadingState,
  StudioErrorState,
  StudioField,
} from '@sva/studio-ui-react';
import {
  isWasteReminderEmailAddress,
  wasteEmailMonitoringPermission,
  type WasteEmailMonitoringOverview,
  type WasteEmailSubscriptionStatus,
  type WasteEmailSubscriptionSummary,
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
import { WastePanelTableTopBar } from './waste-management.table-frame.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

type Selection = {
  page: number;
  status: WasteEmailSubscriptionStatus | '';
  searchEmail: string;
  searchVersion: number;
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
}) => {
  const [draftEmail, setDraftEmail] = useState('');
  const [invalidDraft, setInvalidDraft] = useState(false);
  const emailId = useId();
  const status = selection.searchEmail ? 'active' : selection.status;
  const changeStatus = (status: Selection['status']) =>
    onChange({ ...selection, status, page: 1, selected: null, deliveryPage: 1 });
  const changeSearch = (searchEmail: string) =>
    onChange({
      ...selection,
      searchEmail,
      searchVersion: selection.searchVersion + 1,
      status: '',
      page: 1,
      selected: null,
      deliveryPage: 1,
    });
  return (
    <WastePanelTableTopBar
      activeFilters={
        <>
          {status ? <span>{pt(`emailMonitoring.states.${status}`)}</span> : null}
          {selection.searchEmail ? <span>{pt('emailMonitoring.emailSearch.applied')}</span> : null}
        </>
      }
      actions={
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange({ ...selection, refresh: selection.refresh + 1 })}
        >
          {pt('emailMonitoring.refresh')}
        </Button>
      }
    >
      <form
        className="flex max-w-full flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const email = draftEmail.trim();
          if (email.length > 254 || !isWasteReminderEmailAddress(email)) {
            setInvalidDraft(true);
            return;
          }
          changeSearch(email);
        }}
      >
        <StudioField
          id={emailId}
          label={pt('emailMonitoring.emailSearch.label')}
          error={
            invalidDraft ? (
              <span role="status">{pt('emailMonitoring.emailSearch.invalid')}</span>
            ) : undefined
          }
        >
          <Input
            id={emailId}
            type="text"
            inputMode="email"
            value={draftEmail}
            required
            maxLength={254}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={invalidDraft || undefined}
            aria-describedby={invalidDraft ? `${emailId}-error` : undefined}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setDraftEmail(value);
              setInvalidDraft(false);
              if (selection.searchEmail) changeSearch('');
            }}
          />
        </StudioField>
        <Button type="submit" variant="secondary" disabled={!draftEmail.trim()}>
          {pt('emailMonitoring.emailSearch.submit')}
        </Button>
      </form>
      <label className="space-y-2 text-sm font-medium">
        {pt('emailMonitoring.statusFilter')}
        <Select
          value={status}
          disabled={Boolean(selection.searchEmail)}
          onChange={(event) => changeStatus(event.currentTarget.value as Selection['status'])}
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
        type="button"
        variant="tertiary"
        disabled={!status && !draftEmail}
        onClick={() => {
          setDraftEmail('');
          setInvalidDraft(false);
          changeSearch('');
        }}
      >
        {pt('filters.reset')}
      </Button>
    </WastePanelTableTopBar>
  );
};

const WasteEmailMonitoringContent = ({ pt }: { pt: EmailMonitoringTranslate }) => {
  const [selection, setSelection] = useState<Selection>({
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
