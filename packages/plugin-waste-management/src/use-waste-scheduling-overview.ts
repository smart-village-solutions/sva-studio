import { useCallback, useEffect, useRef } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementSchedulingOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteSchedulingState } from './use-waste-scheduling-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteSchedulingOverview = (state: WasteSchedulingState, pt: Translate) => {
  const ptRef = useRef(pt);
  const isMountedRef = useRef(false);
  ptRef.current = pt;
  const { setAvailableTours, setError, setLoading, setLocationOverview, setOverview } = state;

  const loadOverview = useCallback(
    async () => {
      try {
        const schedulingResponse = await getWasteManagementSchedulingOverview();
        if (!isMountedRef.current) return;
        setOverview(schedulingResponse);
        setError(null);
        void (async () => {
          try {
            const [toursResponse, locationsResponse] = await Promise.allSettled([
              getWasteManagementToursOverview(),
              getWasteManagementMasterDataOverview({ scope: 'locations' }),
            ]);
            if (isMountedRef.current) {
              setAvailableTours(
                toursResponse.status === 'fulfilled' ? toursResponse.value.tours : []
              );
              setLocationOverview(
                locationsResponse.status === 'fulfilled' ? locationsResponse.value : null
              );
            }
          } catch {
            if (isMountedRef.current) {
              setAvailableTours([]);
              setLocationOverview(null);
            }
          }
        })();
      } catch (loadError) {
        if (!isMountedRef.current) return;
        const code = resolveApiErrorCode(loadError);
        setAvailableTours([]);
        setLocationOverview(null);
        setError(
          code === 'forbidden'
            ? ptRef.current('scheduling.messages.loadForbidden')
            : ptRef.current('scheduling.messages.loadError')
        );
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [setAvailableTours, setError, setLoading, setLocationOverview, setOverview]
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
