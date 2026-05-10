import { useCallback, useEffect, useRef } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementSchedulingOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteToursState } from './waste-management.tours.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteToursDataLoading = (state: WasteToursState, pt: Translate) => {
  const ptRef = useRef(pt);
  ptRef.current = pt;
  const { setAvailableFractions, setError, setLoading, setMasterDataOverview, setOverview, setSchedulingOverview } = state;

  const loadOverview = useCallback(
    async (active = true) => {
      try {
        const [toursResponse, masterDataResponse, schedulingResponse] = await Promise.all([
          getWasteManagementToursOverview(),
          getWasteManagementMasterDataOverview(),
          getWasteManagementSchedulingOverview(),
        ]);
        if (!active) return;
        setOverview(toursResponse);
        setAvailableFractions(masterDataResponse.fractions);
        setMasterDataOverview(masterDataResponse);
        setSchedulingOverview(schedulingResponse);
        setError(null);
      } catch (loadError) {
        if (!active) return;
        const code = resolveApiErrorCode(loadError);
        setError(code === 'forbidden' ? ptRef.current('tours.messages.loadForbidden') : ptRef.current('tours.messages.loadError'));
      } finally {
        if (active) setLoading(false);
      }
    },
    [setAvailableFractions, setError, setLoading, setMasterDataOverview, setOverview, setSchedulingOverview]
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
