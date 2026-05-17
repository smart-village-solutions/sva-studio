import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';
import type { WasteManagementSearchParams } from './search-params.js';
import { WasteOverviewContent } from './waste-management.overview-content.js';
import { useWasteOverviewPanelState } from './waste-management.overview-panel.loader.js';

export const WasteOverviewPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const { loading, overview, error } = useWasteOverviewPanelState(search);

  if (loading) {
    return <StudioLoadingState>{pt('overview.messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  return (
    <WasteOverviewContent
      overview={overview}
      page={search.page}
      pageSize={search.pageSize}
      onPageChange={(page) => {
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            page,
          },
        });
      }}
      onPageSizeChange={(pageSize) => {
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            page: 1,
            pageSize,
          },
        });
      }}
    />
  );
};
