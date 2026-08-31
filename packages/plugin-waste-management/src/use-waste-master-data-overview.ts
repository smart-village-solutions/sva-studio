import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';

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

type LocationCoverageSupportLoader = Pick<
  WasteMasterDataState,
  | 'setAvailableTours'
  | 'setLocationCoverageFractions'
  | 'setLocationCoverageFractionsStatus'
  | 'setLocationCoverageToursStatus'
>;

const prepareLocationCoverageLoad = (
  tab: WasteManagementSearchParams['masterDataTab'],
  state: LocationCoverageSupportLoader
) => {
  const status = tab === 'locations' ? 'loading' : 'idle';
  state.setLocationCoverageFractions([]);
  state.setLocationCoverageFractionsStatus(status);
  state.setAvailableTours([]);
  state.setLocationCoverageToursStatus(status);
};

const isCurrentCoverageRequest = (
  requestId: number,
  requestIdRef: MutableRefObject<number>,
  isMountedRef: MutableRefObject<boolean>
) => isMountedRef.current && requestIdRef.current === requestId;

const loadLocationCoverageSupport = async (
  state: LocationCoverageSupportLoader,
  requestId: number,
  requestIdRef: MutableRefObject<number>,
  isMountedRef: MutableRefObject<boolean>
) => {
  const loadFractions = async () => {
    try {
      const response = await getWasteManagementMasterDataOverview({ scope: 'fractions' });
      if (!isCurrentCoverageRequest(requestId, requestIdRef, isMountedRef)) return;
      state.setLocationCoverageFractions(response.fractions);
      state.setLocationCoverageFractionsStatus('ready');
    } catch {
      if (!isCurrentCoverageRequest(requestId, requestIdRef, isMountedRef)) return;
      state.setLocationCoverageFractions([]);
      state.setLocationCoverageFractionsStatus('error');
    }
  };
  const loadTours = async () => {
    try {
      const response = await getWasteManagementToursOverview();
      if (!isCurrentCoverageRequest(requestId, requestIdRef, isMountedRef)) return;
      state.setAvailableTours(response.tours);
      state.setLocationCoverageToursStatus('ready');
    } catch {
      if (!isCurrentCoverageRequest(requestId, requestIdRef, isMountedRef)) return;
      state.setAvailableTours([]);
      state.setLocationCoverageToursStatus('error');
    }
  };

  await Promise.all([loadFractions(), loadTours()]);
};

export const useWasteMasterDataOverview = (
  state: WasteMasterDataState,
  pt: Translate,
  tab: WasteManagementSearchParams['masterDataTab']
) => {
  const ptRef = useRef(pt);
  const isMountedRef = useRef(false);
  const coverageRequestIdRef = useRef(0);
  ptRef.current = pt;
  const { setAvailableTours, setLoading, setOverview, setOverviewError } = state;
  const {
    setLocationCoverageFractions,
    setLocationCoverageFractionsStatus,
    setLocationCoverageToursStatus,
  } = state;

  const loadOverview = useCallback(async () => {
    const coverageRequestId = ++coverageRequestIdRef.current;
    prepareLocationCoverageLoad(tab, {
      setAvailableTours,
      setLocationCoverageFractions,
      setLocationCoverageFractionsStatus,
      setLocationCoverageToursStatus,
    });

    const overviewPromise = getWasteManagementMasterDataOverview(
      resolveMasterDataOverviewScope(tab)
    );
    const coverageSupportPromise =
      tab === 'locations'
        ? loadLocationCoverageSupport(
            {
              setAvailableTours,
              setLocationCoverageFractions,
              setLocationCoverageFractionsStatus,
              setLocationCoverageToursStatus,
            },
            coverageRequestId,
            coverageRequestIdRef,
            isMountedRef
          )
        : undefined;

    try {
      const overviewResponse = await overviewPromise;
      if (!isMountedRef.current) return;
      setOverview(overviewResponse);
      setOverviewError(null);
      await coverageSupportPromise;
    } catch (loadError) {
      if (!isMountedRef.current) return;
      setOverviewError(resolveMasterDataLoadError(ptRef.current, loadError));
      setAvailableTours([]);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [
    setAvailableTours,
    setLoading,
    setLocationCoverageFractions,
    setLocationCoverageFractionsStatus,
    setLocationCoverageToursStatus,
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

  return loadOverview;
};
