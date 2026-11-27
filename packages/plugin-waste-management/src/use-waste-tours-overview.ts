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

export const useWasteToursOverview = (state: WasteToursState, pt: Translate) => {
  const invalidate = useStudioTableInvalidation();
  const tours = useStudioTableQuery(['waste', 'tours'], (signal) =>
    getWasteManagementToursOverview(signal)
  );
  const fractions = useStudioTableQuery(['waste', 'master-data', 'fractions'], (signal) =>
    getWasteManagementMasterDataOverview({ scope: 'fractions', signal })
  );
  const ready = Boolean(tours.data && fractions.data);
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
  const loading = tours.state === 'loading' || fractions.state === 'loading';

  useLayoutEffect(() => {
    setOverview(ready ? (tours.data ?? null) : null);
    setCustomRecurrencePresets(tours.data?.customRecurrencePresets ?? []);
    setAvailableFractions(fractions.data?.fractions ?? []);
    setLoading(loading && !error);
    setError(
      error
        ? pt(
            resolveApiErrorCode(error) === 'forbidden'
              ? 'tours.messages.loadForbidden'
              : 'tours.messages.loadError'
          )
        : null
    );
  }, [
    error,
    fractions.data,
    loading,
    pt,
    ready,
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

  return useCallback(
    async (propagateError = false) => {
      await invalidate(['waste'], false);
      const outcomes = await Promise.all([tours.refetch(), fractions.refetch()]);
      if (propagateError && outcomes.includes(false)) {
        throw new Error('waste_tours_refresh_failed');
      }
      void locations.refetch();
      void scheduling.refetch();
    },
    [fractions.refetch, invalidate, locations.refetch, scheduling.refetch, tours.refetch]
  );
};
