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
  const isMountedRef = useRef(false);
  ptRef.current = pt;
  const { setAvailableTours, setError, setLoading, setOverview } = state;

  const loadOverview = useCallback(
    async () => {
      try {
        const schedulingResponse = await getWasteManagementSchedulingOverview();
        if (!isMountedRef.current) return;
        setOverview(schedulingResponse);
        setError(null);
        void (async () => {
          try {
            const toursResponse = await getWasteManagementToursOverview();
            if (isMountedRef.current) {
              setAvailableTours(toursResponse.tours);
            }
          } catch {
            if (isMountedRef.current) {
              setAvailableTours([]);
            }
          }
        })();
      } catch (loadError) {
        if (!isMountedRef.current) return;
        const code = resolveApiErrorCode(loadError);
        setAvailableTours([]);
        setError(
          code === 'forbidden'
            ? ptRef.current('scheduling.messages.loadForbidden')
            : ptRef.current('scheduling.messages.loadError')
        );
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [setAvailableTours, setError, setLoading, setOverview]
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
