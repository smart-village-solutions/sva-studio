import { Activity, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { type WasteMainserverSyncStatusRecord } from '@sva/waste-management-contracts';
import {
  StudioErrorState,
  StudioLoadingState,
  StudioOverviewPageTemplate,
} from '@sva/studio-ui-react';
import {
  normalizeWasteManagementSearchParams,
  type WasteManagementSearchParams,
} from './search-params.js';
import {
  getWasteManagementSettings,
  getWasteMainserverSyncStatus,
  startWasteManagementMainserverSync,
} from './waste-management.api.js';
import { WasteManagementMainserverSyncStatus } from './waste-management-sync-status.js';
import { WasteManagementPageDescription } from './waste-management.page.description.js';
import { useWasteManagementUiAccess } from './waste-management.ui-access.js';
import {
  toMasterDataTab,
  useWasteManagementTabNavigation,
  useWasteManagementVisibleTabRedirect,
} from './waste-management.page.navigation.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { WasteManagementPageTabs } from './waste-management.page.layout.js';
const updateSearch = (
  navigate: ReturnType<typeof useNavigate>,
  currentSearch: WasteManagementSearchParams,
  patch: Partial<WasteManagementSearchParams>
) => {
  const nextTab = patch.tab ?? currentSearch.tab;
  const nextSearch = {
    ...currentSearch,
    ...patch,
    masterDataTab: patch.masterDataTab ?? toMasterDataTab(nextTab) ?? currentSearch.masterDataTab,
    page: patch.page ?? (patch.q !== undefined || patch.tab !== undefined ? 1 : currentSearch.page),
  };

  void navigate({
    to: '/plugins/waste-management',
    search: nextSearch,
  });
};

const useWasteManagementCalendarWebUrl = (
  uiAccess: ReturnType<typeof useWasteManagementUiAccess>
) => {
  const [calendarWebUrl, setCalendarWebUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!uiAccess.canRead || !uiAccess.canAccessSettings) {
      setCalendarWebUrl(null);
      return;
    }

    let active = true;

    void getWasteManagementSettings()
      .then((settings) => {
        if (!active) {
          return;
        }
        setCalendarWebUrl(settings?.calendarWebUrl ?? null);
      })
      .catch(() => {
        if (active) {
          setCalendarWebUrl(null);
        }
      });

    return () => {
      active = false;
    };
  }, [uiAccess.canAccessSettings, uiAccess.canRead, uiAccess.contextKey]);

  return calendarWebUrl;
};

const useWasteManagementSyncAction = (pt: ReturnType<typeof usePluginTranslation>) => {
  const [syncRunning, setSyncRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

  const startSync = async (onStarted: () => Promise<void>) => {
    setStatusMessage(null);
    setSyncRunning(true);
    try {
      try {
        await startWasteManagementMainserverSync({});
      } catch {
        setStatusMessage({
          kind: 'error',
          text: pt('tools.sync.startError'),
        });
        return;
      }
      setStatusMessage({
        kind: 'success',
        text: pt('tools.sync.startSuccess'),
      });
      await onStarted().catch(() => undefined);
    } finally {
      setSyncRunning(false);
    }
  };

  return {
    syncRunning,
    statusMessage,
    startSync,
  };
};

const useWasteManagementMainserverSyncStatus = (enabled: boolean) => {
  const [status, setStatus] = useState<WasteMainserverSyncStatusRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const latestRequestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const requestId = ++latestRequestId.current;
    try {
      setError(false);
      const nextStatus = await getWasteMainserverSyncStatus();
      if (requestId === latestRequestId.current) {
        setStatus(nextStatus);
      }
    } catch {
      if (requestId === latestRequestId.current) {
        setError(true);
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      latestRequestId.current += 1;
      setLoading(false);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  const pollingDelayMs = status?.activeJob ? 3_000 : 10_000;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timeoutId: number | undefined;
    const scheduleRefresh = () => {
      timeoutId = window.setTimeout(async () => {
        await refresh();
        if (!cancelled) {
          scheduleRefresh();
        }
      }, pollingDelayMs);
    };

    scheduleRefresh();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [enabled, pollingDelayMs, refresh]);

  return { error, loading, refresh, status };
};

export const WasteManagementPage = () => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  const routeSearch = normalizeWasteManagementSearchParams(rawSearch as Record<string, unknown>);
  const locationKey = useLocation({ select: (location) => location.state.__TSR_key ?? location.href });
  const uiAccess = useWasteManagementUiAccess(routeSearch.tab);
  const { search, changeTab } = useWasteManagementTabNavigation(
    navigate, routeSearch, uiAccess, locationKey
  );
  const isAssignmentPage = search.tab === 'tours' && search.toursView === 'assignments';
  const calendarWebUrl = useWasteManagementCalendarWebUrl(uiAccess);
  const { syncRunning, statusMessage, startSync } = useWasteManagementSyncAction(pt);
  const syncStatus = useWasteManagementMainserverSyncStatus(uiAccess.canRead);
  const activeAccess = uiAccess.canRead ? uiAccess : null;
  const [confirmedAccess, setConfirmedAccess] = useState(activeAccess);
  if (
    activeAccess !== confirmedAccess &&
    (uiAccess.isResolved || uiAccess.contextKey !== confirmedAccess?.contextKey)
  ) {
    setConfirmedAccess(activeAccess);
  }

  const retainTourEditor =
    !uiAccess.isResolved &&
    search.tab === 'tours' &&
    uiAccess.contextKey !== null &&
    uiAccess.contextKey === confirmedAccess?.contextKey &&
    confirmedAccess.canManageTours;
  const tabsAccess = activeAccess ?? (retainTourEditor ? confirmedAccess : null);

  useWasteManagementVisibleTabRedirect(navigate, search, uiAccess);

  return (
    <StudioOverviewPageTemplate
      title={pt(isAssignmentPage ? 'tours.assignments.title' : 'page.title')}
      description={
        isAssignmentPage ? undefined : (
          <WasteManagementPageDescription
            description={pt('page.description')}
            calendarWebUrl={uiAccess.canRead ? calendarWebUrl : null}
            webVersionLead={pt('page.webVersionLead')}
            webVersionLinkLabel={pt('page.webVersionLinkLabel')}
          />
        )
      }
    >
      {activeAccess && !isAssignmentPage ? (
        <div className="mb-6 space-y-3">
          <WasteManagementMainserverSyncStatus
            canOpenJobDetails={uiAccess.canOpenJobDetails}
            canRunMainserverSync={uiAccess.canRunMainserverSync}
            error={syncStatus.error}
            loading={syncStatus.loading}
            onStartSync={() => startSync(syncStatus.refresh)}
            pt={pt}
            starting={syncRunning}
            status={syncStatus.status}
          />
          {statusMessage ? <StatusNotice message={statusMessage} /> : null}
        </div>
      ) : null}
      {uiAccess.hasError ? (
        <StudioErrorState>{pt('page.accessUnavailable')}</StudioErrorState>
      ) : uiAccess.isResolved && !uiAccess.canRead ? (
        <StudioErrorState>{pt('page.accessDenied')}</StudioErrorState>
      ) : !uiAccess.isResolved ? (
        <StudioLoadingState>{pt('page.accessLoading')}</StudioLoadingState>
      ) : null}
      {tabsAccess ? (
        <div hidden={!activeAccess}>
          <Activity key={tabsAccess.contextKey} mode={activeAccess ? 'visible' : 'hidden'}>
            <WasteManagementPageTabs
              pt={pt}
              search={search}
              rawSearch={rawSearch as Record<string, unknown>}
              access={tabsAccess}
              visibleTabIds={tabsAccess.visibleTabIds}
              assignmentContextKey={tabsAccess.canManageTours ? tabsAccess.contextKey : null}
              onTabChange={changeTab}
              onAddressSearchChange={(patch) => updateSearch(navigate, search, patch)}
            />
          </Activity>
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
};
