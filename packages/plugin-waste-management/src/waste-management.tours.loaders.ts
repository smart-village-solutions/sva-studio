import { useCallback, useEffect } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementSchedulingOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteToursState } from './waste-management.tours.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteToursDataLoading = (state: WasteToursState, pt: Translate) => {
  const loadOverview = useCallback(
    async (active = true) => {
      try {
        const [toursResponse, masterDataResponse, schedulingResponse] = await Promise.all([
          getWasteManagementToursOverview(),
          getWasteManagementMasterDataOverview(),
          getWasteManagementSchedulingOverview(),
        ]);
        if (!active) return;
        state.setOverview(toursResponse);
        state.setAvailableFractions(masterDataResponse.fractions);
        state.setMasterDataOverview(masterDataResponse);
        state.setSchedulingOverview(schedulingResponse);
        state.setError(null);
      } catch (loadError) {
        if (!active) return;
        const code = resolveApiErrorCode(loadError);
        state.setError(code === 'forbidden' ? pt('tours.messages.loadForbidden') : pt('tours.messages.loadError'));
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

  return loadOverview;
};
