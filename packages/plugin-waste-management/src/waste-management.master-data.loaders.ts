import { useCallback, useEffect, useRef } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementOutputOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';
import type { WasteMasterDataState } from './waste-management.master-data.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const resolveMasterDataOverviewScope = (tab: WasteManagementSearchParams['masterDataTab']) => {
  if (tab === 'fractions') {
    return { scope: 'fractions' } as const;
  }

  if (tab === 'locations') {
    return { scope: 'locations' } as const;
  }

  return undefined;
};

const loadLocationOutputOverview = async (tab: WasteManagementSearchParams['masterDataTab']) => {
  if (tab !== 'locations') {
    return null;
  }

  try {
    return await getWasteManagementOutputOverview();
  } catch {
    return null;
  }
};

const resolveMasterDataLoadError = (translate: Translate, loadError: unknown) => {
  const code = resolveApiErrorCode(loadError);
  return code === 'forbidden'
    ? translate('masterData.messages.loadForbidden')
    : translate('masterData.messages.loadError');
};

const loadAvailableToursForLocations = async (
  tab: WasteManagementSearchParams['masterDataTab'],
  setAvailableTours: WasteMasterDataState['setAvailableTours'],
  isMountedRef: React.MutableRefObject<boolean>,
) => {
  if (tab !== 'locations') {
    return;
  }

  try {
    const response = await getWasteManagementToursOverview();
    if (isMountedRef.current) {
      setAvailableTours(response.tours);
    }
  } catch {
    if (isMountedRef.current) {
      setAvailableTours([]);
    }
  }
};

export const useWasteMasterDataDataLoading = (
  state: WasteMasterDataState,
  pt: Translate,
  tab: WasteManagementSearchParams['masterDataTab']
) => {
  const ptRef = useRef(pt);
  const isMountedRef = useRef(false);
  ptRef.current = pt;
  const { setAvailableTours, setError, setLoading, setOutputOverview, setOverview } = state;

  const loadOverview = useCallback(
    async () => {
      try {
        const overviewResponse = await getWasteManagementMasterDataOverview(resolveMasterDataOverviewScope(tab));
        if (!isMountedRef.current) return;
        const outputResponse = await loadLocationOutputOverview(tab);
        if (!isMountedRef.current) return;
        setOverview(overviewResponse);
        setOutputOverview(outputResponse);
        setError(null);
      } catch (loadError) {
        if (!isMountedRef.current) return;
        setError(resolveMasterDataLoadError(ptRef.current, loadError));
        setAvailableTours([]);
        setOutputOverview(null);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [setAvailableTours, setError, setLoading, setOutputOverview, setOverview, tab]
  );

  useEffect(() => {
    isMountedRef.current = true;
    void loadOverview();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadOverview]);

  useEffect(() => {
    if (!state.overview || tab !== 'locations') {
      return;
    }

    void loadAvailableToursForLocations(tab, setAvailableTours, isMountedRef);
  }, [setAvailableTours, state.overview, tab]);

  return loadOverview;
};
