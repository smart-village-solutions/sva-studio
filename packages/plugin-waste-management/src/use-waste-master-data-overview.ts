import { useStudioTableInvalidation, useStudioTableQuery } from '@sva/studio-ui-react';
import { useCallback, useLayoutEffect } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';
import type { WasteMasterDataState } from './use-waste-master-data-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

function getMasterDataError(error: unknown, pt: Translate) {
  if (!error) return null;
  return pt(
    resolveApiErrorCode(error) === 'forbidden'
      ? 'masterData.messages.loadForbidden'
      : 'masterData.messages.loadError'
  );
}

async function readLocationAssignmentOverview() {
  try {
    return await getWasteManagementMasterDataOverview({ scope: 'locations', fresh: true });
  } catch {
    return null;
  }
}

export const useWasteMasterDataOverview = (
  state: WasteMasterDataState,
  pt: Translate,
  tab: WasteManagementSearchParams['masterDataTab']
) => {
  const isLocations = tab === 'locations';
  const scope = tab === 'fractions' || isLocations ? tab : undefined;
  const list = useStudioTableQuery(['waste', 'master-data', scope], (signal) =>
    getWasteManagementMasterDataOverview({ scope, signal })
  );
  const fractions = useStudioTableQuery(
    ['waste', 'master-data', 'fractions'],
    (signal) => getWasteManagementMasterDataOverview({ scope: 'fractions', signal }),
    isLocations
  );
  const tours = useStudioTableQuery(
    ['waste', 'tours'],
    (signal) => getWasteManagementToursOverview(signal),
    isLocations
  );
  const invalidate = useStudioTableInvalidation();
  const {
    setAvailableTours,
    setLoading,
    setOverview,
    setOverviewError,
    setLocationCoverageFractions,
    setLocationCoverageFractionsStatus,
    setLocationCoverageToursStatus,
  } = state;

  useLayoutEffect(() => {
    setOverview(list.data ?? null);
    setLoading(list.state === 'loading');
    setOverviewError(getMasterDataError(list.error, pt));
    setAvailableTours(tours.data?.tours ?? []);
    setLocationCoverageFractions(fractions.data?.fractions ?? []);
    setLocationCoverageFractionsStatus(isLocations ? fractions.state : 'idle');
    setLocationCoverageToursStatus(isLocations ? tours.state : 'idle');
  }, [
    fractions.data,
    fractions.state,
    isLocations,
    list.data,
    list.error,
    list.state,
    pt,
    setAvailableTours,
    setLoading,
    setLocationCoverageFractions,
    setLocationCoverageFractionsStatus,
    setLocationCoverageToursStatus,
    setOverview,
    setOverviewError,
    tours.data,
    tours.state,
  ]);

  const loadOverview = useCallback(async () => {
    await invalidate(['waste'], false);
    const result = await list.refresh();
    if (isLocations) {
      await Promise.all([fractions.refetch(), tours.refetch()]);
    }
    return result ?? null;
  }, [fractions.refetch, invalidate, isLocations, list.refresh, tours.refetch]);

  return {
    loadOverview,
    overviewRefreshing: list.isFetching || fractions.isFetching || tours.isFetching,
    readLocationAssignmentOverview,
  };
};
