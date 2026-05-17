import { useCallback, useEffect, useRef } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import { loadWasteToursAssignmentContext, loadWasteToursSchedulingContext } from './waste-management.tours.loaders.parts.js';
import type { WasteToursState } from './waste-management.tours.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteToursDataLoading = (state: WasteToursState, pt: Translate) => {
  const ptRef = useRef(pt);
  const isMountedRef = useRef(false);
  ptRef.current = pt;
  const {
    setAssignmentContextLoading,
    setAvailableFractions,
    setError,
    setLoading,
    setMasterDataOverview,
    setOverview,
    setSchedulingOverview,
  } = state;

  const loadOverview = useCallback(
    async () => {
      try {
        const [toursResponse, fractionsResponse] = await Promise.all([
          getWasteManagementToursOverview(),
          getWasteManagementMasterDataOverview({ scope: 'fractions' }),
        ]);
        if (!isMountedRef.current) return;
        setOverview(toursResponse);
        setAvailableFractions(fractionsResponse.fractions);
        setMasterDataOverview(null);
        setAssignmentContextLoading(true);
        setError(null);

        void loadWasteToursAssignmentContext({
          isMounted: () => isMountedRef.current,
          setAssignmentContextLoading,
          setMasterDataOverview,
        });

        void loadWasteToursSchedulingContext({
          isMounted: () => isMountedRef.current,
          setSchedulingOverview,
        });
      } catch (loadError) {
        if (!isMountedRef.current) return;
        const code = resolveApiErrorCode(loadError);
        setMasterDataOverview(null);
        setAssignmentContextLoading(false);
        setSchedulingOverview(null);
        setError(code === 'forbidden' ? ptRef.current('tours.messages.loadForbidden') : ptRef.current('tours.messages.loadError'));
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [
      setAssignmentContextLoading,
      setAvailableFractions,
      setError,
      setLoading,
      setMasterDataOverview,
      setOverview,
      setSchedulingOverview,
    ]
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
