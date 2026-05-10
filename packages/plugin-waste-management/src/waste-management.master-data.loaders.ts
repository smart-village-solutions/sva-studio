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
  ptRef.current = pt;
  const { setAvailableTours, setError, setLoading, setOverview } = state;

  const loadOverview = useCallback(
    async (active = true) => {
      try {
        const response = await getWasteManagementMasterDataOverview();
        if (!active) return;
        setOverview(response);
        setError(null);
      } catch (loadError) {
        if (!active) return;
        const code = resolveApiErrorCode(loadError);
        setError(
          code === 'forbidden'
            ? ptRef.current('masterData.messages.loadForbidden')
            : ptRef.current('masterData.messages.loadError')
        );
      } finally {
        if (active) setLoading(false);
      }
    },
    [setError, setLoading, setOverview]
  );

  useEffect(() => {
    let active = true;
    void loadOverview(active);
    return () => {
      active = false;
    };
  }, [loadOverview]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await getWasteManagementToursOverview();
        if (active) setAvailableTours(response.tours);
      } catch {
        if (active) setAvailableTours([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [setAvailableTours]);

  return loadOverview;
};
