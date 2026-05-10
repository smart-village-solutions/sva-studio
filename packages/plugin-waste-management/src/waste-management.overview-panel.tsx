import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useEffect, useState } from 'react';

import type { WasteManagementHistoryOverview } from './waste-management.api.js';
import { getWasteManagementHistoryOverview } from './waste-management.api.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { WasteOverviewContent } from './waste-management.overview-content.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

export const WasteOverviewPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementHistoryOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      try {
        const response = await getWasteManagementHistoryOverview({
          q: search.q,
          page: search.page,
          pageSize: search.pageSize,
        });
        if (!active) {
          return;
        }
        setOverview(response);
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        const code = resolveApiErrorCode(loadError);
        setError(code === 'forbidden' ? pt('overview.messages.loadForbidden') : pt('overview.messages.loadError'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [pt, search.page, search.pageSize, search.q]);

  if (loading) {
    return <StudioLoadingState>{pt('overview.messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  return <WasteOverviewContent overview={overview} />;
};
