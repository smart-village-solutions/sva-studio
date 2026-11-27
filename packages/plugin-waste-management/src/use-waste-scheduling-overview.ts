import { useStudioTableInvalidation, useStudioTableQuery } from '@sva/studio-ui-react';
import { useCallback, useLayoutEffect } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementSchedulingOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteSchedulingState } from './use-waste-scheduling-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteSchedulingOverview = (state: WasteSchedulingState, pt: Translate) => {
  const { setAvailableTours, setError, setLoading, setLocationOverview, setOverview } = state;
  const invalidate = useStudioTableInvalidation();
  const scheduling = useStudioTableQuery(['waste', 'scheduling'], (signal) =>
    getWasteManagementSchedulingOverview({ signal })
  );
  const tours = useStudioTableQuery(['waste', 'tours'], (signal) =>
    getWasteManagementToursOverview(signal)
  );
  const locations = useStudioTableQuery(['waste', 'master-data', 'locations'], (signal) =>
    getWasteManagementMasterDataOverview({ scope: 'locations', signal })
  );

  useLayoutEffect(() => {
    setOverview(scheduling.data ?? null);
    setAvailableTours(scheduling.data ? (tours.data?.tours ?? []) : []);
    setLocationOverview(scheduling.data ? (locations.data ?? null) : null);
    setLoading(scheduling.state === 'loading');
    setError(
      scheduling.error
        ? pt(
            resolveApiErrorCode(scheduling.error) === 'forbidden'
              ? 'scheduling.messages.loadForbidden'
              : 'scheduling.messages.loadError'
          )
        : null
    );
  }, [
    locations.data,
    pt,
    scheduling.data,
    scheduling.error,
    scheduling.state,
    setAvailableTours,
    setError,
    setLoading,
    setLocationOverview,
    setOverview,
    tours.data,
  ]);

  return useCallback(async () => {
    await invalidate(['waste'], false);
    await scheduling.refetch();
    void tours.refetch();
    void locations.refetch();
  }, [invalidate, locations.refetch, scheduling.refetch, tours.refetch]);
};
