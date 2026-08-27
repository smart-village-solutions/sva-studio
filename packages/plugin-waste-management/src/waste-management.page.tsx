import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { usePluginTranslation, type WasteMainserverSyncStatusRecord } from '@sva/plugin-sdk';
import { StudioOverviewPageTemplate } from '@sva/studio-ui-react';

import {
  normalizeWasteManagementSearchParams,
  type WasteManagementMasterDataTabId,
  type WasteManagementSearchParams,
  type WasteManagementTabId,
} from './search-params.js';
import {
  getWasteManagementSettings,
  getWasteMainserverSyncStatus,
  startWasteManagementMainserverSync,
} from './waste-management.api.js';
import { WasteManagementMainserverSyncStatus } from './waste-management-sync-status.js';
import { WasteManagementPageDescription } from './waste-management.page.description.js';
import { useWasteManagementUiAccess } from './waste-management.ui-access.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { WasteManagementPageTabs } from './waste-management.page.layout.js';

const toMasterDataTab = (tab: WasteManagementTabId): WasteManagementMasterDataTabId | undefined => {
  if (tab === 'fractions' || tab === 'locations') {
    return tab;
  }

  return undefined;
};

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

const useWasteManagementVisibleTabRedirect = (
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams,
  uiAccess: ReturnType<typeof useWasteManagementUiAccess>
) => {
  useEffect(() => {
    if (!uiAccess.isResolved || uiAccess.visibleTabIds.includes(search.tab)) {
      return;
    }

    const fallbackTab = uiAccess.visibleTabIds[0];
    if (!fallbackTab) {
      return;
    }

    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        tab: fallbackTab,
        masterDataTab: toMasterDataTab(fallbackTab) ?? search.masterDataTab,
        page: 1,
      },
      replace: true,
    });
  }, [navigate, search, uiAccess.isResolved, uiAccess.visibleTabIds]);
};

const useWasteManagementCalendarWebUrl = (
  uiAccess: ReturnType<typeof useWasteManagementUiAccess>
) => {
  const [calendarWebUrl, setCalendarWebUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!uiAccess.isResolved || !uiAccess.canAccessSettings) {
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
  }, [uiAccess.canAccessSettings, uiAccess.isResolved]);

  return calendarWebUrl;
};

const useWasteManagementSyncAction = (pt: ReturnType<typeof usePluginTranslation>) => {
  const [syncRunning, setSyncRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

  const startSync = async (onStarted: () => Promise<void>) => {
    setStatusMessage(null);
    setSyncRunning(true);
    try {
      await startWasteManagementMainserverSync({});
      setStatusMessage({
        kind: 'success',
        text: pt('tools.sync.startSuccess'),
      });
      await onStarted();
    } catch {
      setStatusMessage({
        kind: 'error',
        text: pt('tools.sync.startError'),
      });
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

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setError(false);
      setStatus(await getWasteMainserverSyncStatus());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !status?.activeJob) return;
    const intervalId = window.setInterval(() => void refresh(), 3_000);
    return () => window.clearInterval(intervalId);
  }, [enabled, refresh, status?.activeJob]);

  return { error, loading, refresh, status };
};

export const WasteManagementPage = () => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  const search = normalizeWasteManagementSearchParams(rawSearch as Record<string, unknown>);
  const uiAccess = useWasteManagementUiAccess(search.tab);
  const calendarWebUrl = useWasteManagementCalendarWebUrl(uiAccess);
  const { syncRunning, statusMessage, startSync } = useWasteManagementSyncAction(pt);
  const syncStatus = useWasteManagementMainserverSyncStatus(
    uiAccess.isResolved && uiAccess.visibleTabIds.length > 0
  );

  useWasteManagementVisibleTabRedirect(navigate, search, uiAccess);

  return (
    <StudioOverviewPageTemplate
      title={pt('page.title')}
      description={
        <WasteManagementPageDescription
          description={pt('page.description')}
          calendarWebUrl={calendarWebUrl}
          webVersionLead={pt('page.webVersionLead')}
          webVersionLinkLabel={pt('page.webVersionLinkLabel')}
        />
      }
    >
      <div className="mb-6 space-y-3">
        <WasteManagementMainserverSyncStatus
          canOpenJobDetails={uiAccess.canOpenJobDetails}
          canRunMainserverSync={uiAccess.canRunMainserverSync}
          error={syncStatus.error}
          loading={syncStatus.loading}
          onOpenJob={(jobId) => void navigate({ to: '/monitoring/jobs/$jobId', params: { jobId } })}
          onStartSync={() => startSync(syncStatus.refresh)}
          pt={pt}
          starting={syncRunning}
          status={syncStatus.status}
        />
        {statusMessage ? <StatusNotice message={statusMessage} /> : null}
      </div>
      <WasteManagementPageTabs
        pt={pt}
        search={search}
        rawSearch={rawSearch as Record<string, unknown>}
        access={uiAccess}
        visibleTabIds={uiAccess.visibleTabIds}
        onTabChange={(value) => updateSearch(navigate, search, { tab: value })}
      />
    </StudioOverviewPageTemplate>
  );
};
