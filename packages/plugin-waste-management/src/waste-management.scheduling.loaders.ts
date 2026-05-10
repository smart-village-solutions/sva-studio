import { useCallback, useEffect, useRef } from 'react';

import {
  getWasteManagementSchedulingOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteSchedulingState } from './waste-management.scheduling.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteSchedulingDataLoading = (state: WasteSchedulingState, pt: Translate) => {
  const ptRef = useRef(pt);
  ptRef.current = pt;
  const { setAvailableTours, setError, setLoading, setOverview } = state;

  const loadOverview = useCallback(
    async (active = true) => {
      try {
        const [schedulingResponse, toursResponse] = await Promise.all([
          getWasteManagementSchedulingOverview(),
          getWasteManagementToursOverview(),
        ]);
        if (!active) return;
        setOverview(schedulingResponse);
        setAvailableTours(toursResponse.tours);
        setError(null);
      } catch (loadError) {
        if (!active) return;
        const code = resolveApiErrorCode(loadError);
        setError(
          code === 'forbidden'
            ? ptRef.current('scheduling.messages.loadForbidden')
            : ptRef.current('scheduling.messages.loadError')
        );
      } finally {
        if (active) setLoading(false);
      }
    },
    [setAvailableTours, setError, setLoading, setOverview]
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
