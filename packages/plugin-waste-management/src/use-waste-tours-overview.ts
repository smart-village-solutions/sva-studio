import { useStudioTableInvalidation, useStudioTableQuery } from '@sva/studio-ui-react';
import { useCallback, useLayoutEffect } from 'react';
import {
  getWasteManagementMasterDataOverview,
  getWasteManagementSchedulingOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteToursState } from './use-waste-tours-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

function getToursLoadError(error: unknown, pt: Translate) {
  if (!error) return null;
  return pt(
    resolveApiErrorCode(error) === 'forbidden'
      ? 'tours.messages.loadForbidden'
      : 'tours.messages.loadError'
  );
}

function useWasteTourAssignmentQueries(ready: boolean) {
  const locations = useStudioTableQuery(
    ['waste', 'master-data', 'locations'],
    (signal) => getWasteManagementMasterDataOverview({ scope: 'locations', signal }),
    ready
  );
  const scheduling = useStudioTableQuery(
    ['waste', 'scheduling'],
    (signal) => getWasteManagementSchedulingOverview({ signal }),
    ready
  );
  return { locations, scheduling };
}

export const useWasteToursOverview = (state: WasteToursState, pt: Translate) => {
  const invalidate = useStudioTableInvalidation();
  const tours = useStudioTableQuery(['waste', 'tours'], (signal) =>
    getWasteManagementToursOverview(signal)
  );
  const fractions = useStudioTableQuery(['waste', 'master-data', 'fractions'], (signal) =>
    getWasteManagementMasterDataOverview({ scope: 'fractions', signal })
  );
  const overview = fractions.data ? tours.data : undefined;
  const ready = overview !== undefined;
  const { locations, scheduling } = useWasteTourAssignmentQueries(ready);
  const {
    setAssignmentContextLoading,
    setAvailableFractions,
    setCustomRecurrencePresets,
    setError,
    setLoading,
    setMasterDataOverview,
    setOverview,
    setSchedulingOverview,
    setSchedulingLoadState,
  } = state;
  const error = tours.error ?? fractions.error;
  const errorMessage = getToursLoadError(error, pt);
  const loading = tours.state === 'loading' || fractions.state === 'loading';

  useLayoutEffect(() => {
    setOverview(overview ?? null);
    setCustomRecurrencePresets(tours.data?.customRecurrencePresets ?? []);
    setAvailableFractions(fractions.data?.fractions ?? []);
    setLoading(loading && !error);
    setError(errorMessage);
  }, [
    error,
    errorMessage,
    fractions.data,
    loading,
    overview,
    setAvailableFractions,
    setCustomRecurrencePresets,
    setError,
    setLoading,
    setOverview,
    tours.data,
  ]);

  useLayoutEffect(() => {
    setAssignmentContextLoading(ready && locations.state === 'loading');
    setMasterDataOverview(locations.data ?? null);
    setSchedulingOverview(scheduling.data ?? null);
    setSchedulingLoadState(scheduling.state);
  }, [
    locations.data,
    locations.state,
    ready,
    scheduling.data,
    scheduling.state,
    setAssignmentContextLoading,
    setMasterDataOverview,
    setSchedulingLoadState,
    setSchedulingOverview,
  ]);

  const loadOverview = useCallback(
    async (propagateError = false) => {
      await invalidate(['waste'], false);
      const outcomes = await Promise.all([tours.refresh(true), fractions.refresh(true)]);
      if (propagateError && outcomes.includes(undefined)) {
        throw new Error('waste_tours_refresh_failed');
      }
      void locations.refresh(true);
      void scheduling.refresh(true);
    },
    [fractions.refresh, invalidate, locations.refresh, scheduling.refresh, tours.refresh]
  );
  return { loadOverview, refreshScheduling: scheduling.refresh };
};
