import { useNavigate, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioOverviewPageTemplate } from '@sva/studio-ui-react';

import {
  normalizeWasteManagementSearchParams,
  type WasteManagementSearchParams,
  type WasteManagementTabId,
} from './search-params.js';
import { WasteManagementPageTabs } from './waste-management.page.layout.js';

const updateSearch = (
  navigate: ReturnType<typeof useNavigate>,
  currentSearch: WasteManagementSearchParams,
  patch: Partial<WasteManagementSearchParams>
) => {
  const nextSearch = {
    ...currentSearch,
    ...patch,
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

  return (
    <StudioOverviewPageTemplate
      title={pt('page.title')}
      description={pt('page.description')}
      primaryAction={
        <Button type="button" variant="outline" onClick={() => updateSearch(navigate, search, { tab: 'settings' })}>
          {pt('actions.openSettings')}
        </Button>
      }
    >
      <WasteManagementPageTabs
        pt={pt}
        search={search}
        onTabChange={(value) => updateSearch(navigate, search, { tab: value })}
      />
    </StudioOverviewPageTemplate>
  );
};
