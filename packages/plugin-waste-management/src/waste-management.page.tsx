import { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioOverviewPageTemplate } from '@sva/studio-ui-react';

import {
  normalizeWasteManagementSearchParams,
  type WasteManagementMasterDataTabId,
  type WasteManagementSearchParams,
  type WasteManagementTabId,
} from './search-params.js';
import { getWasteManagementSettings } from './waste-management.api.js';
import { useWasteManagementUiAccess } from './waste-management.ui-access.js';
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

export const WasteManagementPage = () => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  const search = normalizeWasteManagementSearchParams(rawSearch as Record<string, unknown>);
  const uiAccess = useWasteManagementUiAccess(search.tab);
  const [calendarWebUrl, setCalendarWebUrl] = useState<string | null>(null);

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

  useEffect(() => {
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
  }, []);

  return (
    <StudioOverviewPageTemplate
      title={pt('page.title')}
      description={
        <>
          {pt('page.description')}
          {calendarWebUrl ? (
            <>
              {' '}
              {pt('page.webVersionLead')}{' '}
              <a
                href={calendarWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                {pt('page.webVersionLinkLabel')}
              </a>
            </>
          ) : null}
        </>
      }
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
