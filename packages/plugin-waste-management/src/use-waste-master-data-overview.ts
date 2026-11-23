import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

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

const requestMasterDataOverview = (
  tab: WasteManagementSearchParams['masterDataTab'],
  readAssignments: boolean
) =>
  getWasteManagementMasterDataOverview(
    readAssignments || tab === 'locations'
      ? { scope: 'locations', fresh: true }
      : resolveMasterDataOverviewScope(tab)
  );

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

const startCoverageSupport = ({
  tab,
  coverageState,
  coverageRequestIdRef,
  isMountedRef,
  setOverviewRefreshing,
}: {
  tab: WasteManagementSearchParams['masterDataTab'];
  coverageState: LocationCoverageSupportLoader;
  coverageRequestIdRef: MutableRefObject<number>;
  isMountedRef: MutableRefObject<boolean>;
  setOverviewRefreshing: (refreshing: boolean) => void;
}) => {
  setOverviewRefreshing(true);
  const requestId = ++coverageRequestIdRef.current;
  prepareLocationCoverageLoad(tab, coverageState);
  return tab === 'locations'
    ? loadLocationCoverageSupport(coverageState, requestId, coverageRequestIdRef, isMountedRef)
    : undefined;
};

const useOverviewRefresh = ({
  loadOverview,
  isMountedRef,
  overviewRequestIdRef,
  coverageRequestIdRef,
}: {
  loadOverview: () => Promise<unknown>;
  isMountedRef: MutableRefObject<boolean>;
  overviewRequestIdRef: MutableRefObject<number>;
  coverageRequestIdRef: MutableRefObject<number>;
}) => {
  useEffect(() => {
    isMountedRef.current = true;
    void loadOverview();
    return () => {
      isMountedRef.current = false;
      overviewRequestIdRef.current += 1;
      coverageRequestIdRef.current += 1;
    };
  }, [coverageRequestIdRef, isMountedRef, loadOverview, overviewRequestIdRef]);
};

export const useWasteMasterDataOverview = (
  state: WasteMasterDataState,
  pt: Translate,
  tab: WasteManagementSearchParams['masterDataTab']
) => {
  const [overviewRefreshing, setOverviewRefreshing] = useState(true);
  const ptRef = useRef(pt);
  const isMountedRef = useRef(false);
  const coverageRequestIdRef = useRef(0);
  const overviewRequestIdRef = useRef(0);
  ptRef.current = pt;
  const { setAvailableTours, setLoading, setOverview, setOverviewError } = state;
  const {
    setLocationCoverageFractions,
    setLocationCoverageFractionsStatus,
    setLocationCoverageToursStatus,
  } = state;

  const loadOverview = useCallback(
    async (readAssignments = false) => {
      const requestId = ++overviewRequestIdRef.current;
      const isCurrent = () => isMountedRef.current && requestId === overviewRequestIdRef.current;
      const coverageState = {
        setAvailableTours,
        setLocationCoverageFractions,
        setLocationCoverageFractionsStatus,
        setLocationCoverageToursStatus,
      };
      const overviewPromise = requestMasterDataOverview(tab, readAssignments);
      const coverageSupportPromise = readAssignments
        ? undefined
        : startCoverageSupport({
            tab,
            coverageState,
            coverageRequestIdRef,
            isMountedRef,
            setOverviewRefreshing,
          });

      try {
        const overviewResponse = await overviewPromise;
        if (!isCurrent()) return null;
        setOverview(overviewResponse);
        setOverviewError(null);
        setLoading(false);
        await coverageSupportPromise;
        return overviewResponse;
      } catch (loadError) {
        if (isCurrent() && !readAssignments) {
          setOverviewError(resolveMasterDataLoadError(ptRef.current, loadError));
          setAvailableTours([]);
        }
        return null;
      } finally {
        if (isCurrent()) {
          setOverviewRefreshing(false);
          if (!readAssignments) setLoading(false);
        }
      }
    },
    [
      setAvailableTours,
      setLoading,
      setLocationCoverageFractions,
      setLocationCoverageFractionsStatus,
      setLocationCoverageToursStatus,
      setOverview,
      setOverviewError,
      tab,
    ]
  );

  useOverviewRefresh({ loadOverview, isMountedRef, overviewRequestIdRef, coverageRequestIdRef });

  return {
    loadOverview,
    overviewRefreshing,
    readLocationAssignmentOverview: () => loadOverview(true),
  };
};
