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
  const isMountedRef = useRef(false);
  ptRef.current = pt;
  const { setAvailableFractions, setError, setLoading, setMasterDataOverview, setOverview, setSchedulingOverview } = state;

  const loadOverview = useCallback(
    async () => {
      try {
        const [toursResponse, masterDataResponse, schedulingResponse] = await Promise.all([
          getWasteManagementToursOverview(),
          getWasteManagementMasterDataOverview(),
          getWasteManagementSchedulingOverview(),
        ]);
        if (!isMountedRef.current) return;
        setOverview(toursResponse);
        setAvailableFractions(masterDataResponse.fractions);
        setMasterDataOverview(masterDataResponse);
        setSchedulingOverview(schedulingResponse);
        setError(null);
      } catch (loadError) {
        if (!isMountedRef.current) return;
        const code = resolveApiErrorCode(loadError);
        setError(code === 'forbidden' ? ptRef.current('tours.messages.loadForbidden') : ptRef.current('tours.messages.loadError'));
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [setAvailableFractions, setError, setLoading, setMasterDataOverview, setOverview, setSchedulingOverview]
  );

  useEffect(() => {
    isMountedRef.current = true;
    void loadOverview();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadOverview]);

  return loadOverview;
};
