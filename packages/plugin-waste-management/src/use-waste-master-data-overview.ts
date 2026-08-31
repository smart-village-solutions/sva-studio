import { useCallback, useEffect, useRef } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';
import type { WasteMasterDataState } from './use-waste-master-data-state.js';

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

const resolveMasterDataLoadError = (translate: Translate, loadError: unknown) => {
  const code = resolveApiErrorCode(loadError);
  return code === 'forbidden'
    ? translate('masterData.messages.loadForbidden')
    : translate('masterData.messages.loadError');
};

const loadAvailableToursForLocations = async (
  tab: WasteManagementSearchParams['masterDataTab'],
  setAvailableTours: WasteMasterDataState['setAvailableTours'],
  isMountedRef: React.MutableRefObject<boolean>
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

export const useWasteMasterDataOverview = (
  state: WasteMasterDataState,
  pt: Translate,
  tab: WasteManagementSearchParams['masterDataTab']
) => {
  const ptRef = useRef(pt);
  const isMountedRef = useRef(false);
  ptRef.current = pt;
  const { setAvailableTours, setLoading, setOverview, setOverviewError } = state;
  const { setLocationCoverageFractions, setLocationCoverageFractionsStatus } = state;

  const loadLocationCoverageFractions = useCallback(async () => {
    try {
      const response = await getWasteManagementMasterDataOverview({ scope: 'fractions' });
      if (!isMountedRef.current) return;
      setLocationCoverageFractions(response.fractions);
      setLocationCoverageFractionsStatus('ready');
    } catch {
      if (!isMountedRef.current) return;
      setLocationCoverageFractions([]);
      setLocationCoverageFractionsStatus('error');
    }
  }, [setLocationCoverageFractions, setLocationCoverageFractionsStatus]);

  const loadOverview = useCallback(async () => {
    if (tab === 'locations') {
      setLocationCoverageFractions([]);
      setLocationCoverageFractionsStatus('loading');
    } else {
      setLocationCoverageFractions([]);
      setLocationCoverageFractionsStatus('idle');
    }

    try {
      const overviewResponse = await getWasteManagementMasterDataOverview(
        resolveMasterDataOverviewScope(tab)
      );
      if (!isMountedRef.current) return;
      setOverview(overviewResponse);
      setOverviewError(null);
      if (tab === 'locations') void loadLocationCoverageFractions();
    } catch (loadError) {
      if (!isMountedRef.current) return;
      setOverviewError(resolveMasterDataLoadError(ptRef.current, loadError));
      setAvailableTours([]);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [
    loadLocationCoverageFractions,
    setAvailableTours,
    setLoading,
    setLocationCoverageFractions,
    setLocationCoverageFractionsStatus,
    setOverview,
    setOverviewError,
    tab,
  ]);

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
