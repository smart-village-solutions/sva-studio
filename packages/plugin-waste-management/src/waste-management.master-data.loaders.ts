import { useCallback, useEffect } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteMasterDataState } from './waste-management.master-data.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteMasterDataDataLoading = (state: WasteMasterDataState, pt: Translate) => {
  const loadOverview = useCallback(
    async (active = true) => {
      try {
        const response = await getWasteManagementMasterDataOverview();
        if (!active) return;
        state.setOverview(response);
        state.setError(null);
      } catch (loadError) {
        if (!active) return;
        const code = resolveApiErrorCode(loadError);
        state.setError(
          code === 'forbidden' ? pt('masterData.messages.loadForbidden') : pt('masterData.messages.loadError')
        );
      } finally {
        if (active) state.setLoading(false);
      }
    },
    [pt, state]
  );

  useEffect(() => {
    let active = true;
    void loadOverview(active);
    return () => {
      active = false;
    };
  }, [loadOverview]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await getWasteManagementToursOverview();
        if (active) state.setAvailableTours(response.tours);
      } catch {
        if (active) state.setAvailableTours([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [state]);

  return loadOverview;
};
