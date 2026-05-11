import { useCallback, useEffect, useRef } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteMasterDataState } from './waste-management.master-data.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteMasterDataDataLoading = (state: WasteMasterDataState, pt: Translate) => {
  const ptRef = useRef(pt);
  const isMountedRef = useRef(false);
  ptRef.current = pt;
  const { setAvailableTours, setError, setLoading, setOverview } = state;

  const loadOverview = useCallback(
    async () => {
      try {
        const response = await getWasteManagementMasterDataOverview();
        if (!isMountedRef.current) return;
        setOverview(response);
        setError(null);
      } catch (loadError) {
        if (!isMountedRef.current) return;
        const code = resolveApiErrorCode(loadError);
        setError(
          code === 'forbidden'
            ? ptRef.current('masterData.messages.loadForbidden')
            : ptRef.current('masterData.messages.loadError')
        );
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [setError, setLoading, setOverview]
  );

  useEffect(() => {
    isMountedRef.current = true;
    void loadOverview();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadOverview]);

  useEffect(() => {
    isMountedRef.current = true;
    void (async () => {
      try {
        const response = await getWasteManagementToursOverview();
        if (isMountedRef.current) setAvailableTours(response.tours);
      } catch {
        if (isMountedRef.current) setAvailableTours([]);
      }
    })();
    return () => {
      isMountedRef.current = false;
    };
  }, [setAvailableTours]);

  return loadOverview;
};
