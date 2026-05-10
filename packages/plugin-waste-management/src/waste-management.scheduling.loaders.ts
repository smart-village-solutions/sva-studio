import { useCallback, useEffect } from 'react';

import {
  getWasteManagementSchedulingOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteSchedulingState } from './waste-management.scheduling.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteSchedulingDataLoading = (state: WasteSchedulingState, pt: Translate) => {
  const loadOverview = useCallback(
    async (active = true) => {
      try {
        const [schedulingResponse, toursResponse] = await Promise.all([
          getWasteManagementSchedulingOverview(),
          getWasteManagementToursOverview(),
        ]);
        if (!active) return;
        state.setOverview(schedulingResponse);
        state.setAvailableTours(toursResponse.tours);
        state.setError(null);
      } catch (loadError) {
        if (!active) return;
        const code = resolveApiErrorCode(loadError);
        state.setError(
          code === 'forbidden' ? pt('scheduling.messages.loadForbidden') : pt('scheduling.messages.loadError')
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

  return loadOverview;
};
