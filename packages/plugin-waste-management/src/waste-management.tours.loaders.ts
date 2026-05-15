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

        void (async () => {
          try {
            const masterDataResponse = await getWasteManagementMasterDataOverview({ scope: 'locations' });
            if (isMountedRef.current) {
              setMasterDataOverview(masterDataResponse);
            }
          } catch {
            if (isMountedRef.current) {
              setMasterDataOverview(null);
            }
          } finally {
            if (isMountedRef.current) {
              setAssignmentContextLoading(false);
            }
          }
        })();

        void (async () => {
          try {
            const schedulingResponse = await getWasteManagementSchedulingOverview();
            if (isMountedRef.current) {
              setSchedulingOverview(schedulingResponse);
            }
          } catch {
            if (isMountedRef.current) {
              setSchedulingOverview(null);
            }
          }
        })();
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
