import { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioOverviewPageTemplate } from '@sva/studio-ui-react';

import {
  normalizeWasteManagementSearchParams,
  type WasteManagementMasterDataTabId,
  type WasteManagementSearchParams,
  type WasteManagementTabId,
} from './search-params.js';
import { getWasteManagementSettings, startWasteManagementMainserverSync } from './waste-management.api.js';
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

const useWasteManagementCalendarWebUrl = (uiAccess: ReturnType<typeof useWasteManagementUiAccess>) => {
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

  const startSync = async () => {
    setStatusMessage(null);
    setSyncRunning(true);
    try {
      await startWasteManagementMainserverSync({});
      setStatusMessage({
        kind: 'success',
        text: pt('tools.sync.startSuccess'),
      });
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

const WasteManagementSyncAction = ({
  canRunMainserverSync,
  disabled,
  onClick,
  pt,
}: Readonly<{
  canRunMainserverSync: boolean;
  disabled: boolean;
  onClick: () => Promise<void>;
  pt: ReturnType<typeof usePluginTranslation>;
}>) =>
  canRunMainserverSync ? (
    <Button type="button" disabled={disabled} onClick={() => void onClick()}>
      {pt('tools.sync.actionLabel')}
    </Button>
  ) : null;

export const WasteManagementPage = () => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  const search = normalizeWasteManagementSearchParams(rawSearch as Record<string, unknown>);
  const uiAccess = useWasteManagementUiAccess(search.tab);
  const calendarWebUrl = useWasteManagementCalendarWebUrl(uiAccess);
  const { syncRunning, statusMessage, startSync } = useWasteManagementSyncAction(pt);

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
      primaryAction={
        <WasteManagementSyncAction
          canRunMainserverSync={uiAccess.canRunMainserverSync}
          disabled={syncRunning}
          onClick={startSync}
          pt={pt}
        />
      }
      toolbar={statusMessage ? <StatusNotice message={statusMessage} /> : null}
    >
      <WasteManagementPageTabs
        pt={pt}
        search={search}
        access={uiAccess}
        visibleTabIds={uiAccess.visibleTabIds}
        onTabChange={(value) => updateSearch(navigate, search, { tab: value })}
      />
    </StudioOverviewPageTemplate>
  );
};
