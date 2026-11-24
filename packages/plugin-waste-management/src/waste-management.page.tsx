import { Activity, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { type WasteMainserverSyncStatusRecord } from '@sva/waste-management-contracts';
import {
  StudioErrorState,
  StudioLoadingState,
  StudioOverviewPageTemplate,
} from '@sva/studio-ui-react';
import { normalizeWasteManagementSearchParams } from './search-params.js';
import {
  getWasteManagementSettings,
  getWasteMainserverSyncStatus,
  startWasteManagementMainserverSync,
} from './waste-management.api.js';
import { WasteManagementMainserverSyncStatus } from './waste-management-sync-status.js';
import { WasteManagementPageDescription } from './waste-management.page.description.js';
import { useWasteManagementUiAccess } from './waste-management.ui-access.js';
import {
  updateWasteManagementSearch,
  useWasteManagementTabNavigation,
  useWasteManagementVisibleTabRedirect,
  useWasteManagementTabsAccess,
} from './waste-management.page.navigation.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { WasteManagementPageTabs } from './waste-management.page.layout.js';
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
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      latestRequestId.current += 1;
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

  return { error, loading: !status && !error, refresh, status };
};

const useWasteWorkspaceLayout = (isActive: boolean) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const [pageHeight, setPageHeight] = useState(0);

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!isActive || !page) return;
    const measure = () => setPageHeight(page.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    return () => observer.disconnect();
  }, [isActive]);

  const restoreTabFocus = useCallback((tabs: HTMLDivElement | null) => {
    if (!tabs) {
      const previous = tabsRef.current;
      const focused = previous?.ownerDocument.activeElement;
      lastFocus.current =
        focused instanceof HTMLElement && previous?.contains(focused) ? focused : null;
    } else {
      const focused = lastFocus.current;
      if (
        tabs.ownerDocument.activeElement === tabs.ownerDocument.body &&
        focused &&
        tabs.contains(focused)
      ) {
        focused.focus({ preventScroll: true });
      }
      lastFocus.current = null;
    }
    tabsRef.current = tabs;
  }, []);

  return { pageHeight, pageRef, restoreTabFocus };
};

const WasteManagementAccessStatus = ({
  uiAccess,
  pt,
}: {
  readonly uiAccess: ReturnType<typeof useWasteManagementUiAccess>;
  readonly pt: ReturnType<typeof usePluginTranslation>;
}) => {
  if (uiAccess.hasError) {
    return <StudioErrorState>{pt('page.accessUnavailable')}</StudioErrorState>;
  }
  if (!uiAccess.isResolved) {
    return <StudioLoadingState>{pt('page.accessLoading')}</StudioLoadingState>;
  }
  return uiAccess.canRead ? null : <StudioErrorState>{pt('page.accessDenied')}</StudioErrorState>;
};

export const WasteManagementPage = () => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  const routeSearch = normalizeWasteManagementSearchParams(rawSearch as Record<string, unknown>);
  const locationKey = useLocation({
    select: (location) => location.state.__TSR_key ?? location.href,
  });
  const uiAccess = useWasteManagementUiAccess(routeSearch.tab);
  const { search, changeTab } = useWasteManagementTabNavigation(
    navigate,
    routeSearch,
    uiAccess,
    locationKey
  );
  const isAssignmentPage = search.tab === 'tours' && search.toursView === 'assignments';
  const calendarWebUrl = useWasteManagementCalendarWebUrl(uiAccess);
  const { syncRunning, statusMessage, startSync } = useWasteManagementSyncAction(pt);
  const syncStatus = useWasteManagementMainserverSyncStatus(uiAccess.canRead && !isAssignmentPage);
  const { activeAccess, tabsAccess } = useWasteManagementTabsAccess(uiAccess);
  // A changed capability can invalidate an already-open confirmation or draft.
  const workspaceKey = tabsAccess ? JSON.stringify(tabsAccess) : undefined;
  const { pageHeight, pageRef, restoreTabFocus } = useWasteWorkspaceLayout(Boolean(activeAccess));
  useWasteManagementVisibleTabRedirect(navigate, search, uiAccess);

  const page = (
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
      <WasteManagementAccessStatus uiAccess={uiAccess} pt={pt} />
      {tabsAccess ? (
        <div hidden={!activeAccess}>
          <Activity key={workspaceKey} mode={activeAccess ? 'visible' : 'hidden'}>
            <div ref={restoreTabFocus}>
              <WasteManagementPageTabs
                pt={pt}
                search={search}
                rawSearch={rawSearch as Record<string, unknown>}
                access={tabsAccess}
                visibleTabIds={tabsAccess.visibleTabIds}
                assignmentContextKey={tabsAccess.canManageTours ? tabsAccess.contextKey : null}
                onTabChange={changeTab}
                onAddressSearchChange={(patch) =>
                  updateWasteManagementSearch(navigate, search, patch)
                }
              />
            </div>
          </Activity>
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
  return (
    <div
      ref={pageRef}
      style={
        !activeAccess && tabsAccess && !uiAccess.hasError ? { minHeight: pageHeight } : undefined
      }
    >
      {page}
    </div>
  );
};
