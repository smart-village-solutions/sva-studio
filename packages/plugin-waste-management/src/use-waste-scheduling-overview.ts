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
  const ready = Boolean(scheduling.data);
  const tours = useStudioTableQuery(
    ['waste', 'tours'],
    (signal) => getWasteManagementToursOverview(signal),
    ready
  );
  const locations = useStudioTableQuery(
    ['waste', 'master-data', 'locations'],
    (signal) => getWasteManagementMasterDataOverview({ scope: 'locations', signal }),
    ready
  );
  const error = scheduling.error
    ? pt(
        resolveApiErrorCode(scheduling.error) === 'forbidden'
          ? 'scheduling.messages.loadForbidden'
          : 'scheduling.messages.loadError'
      )
    : null;

  useLayoutEffect(() => {
    setOverview(scheduling.data ?? null);
    setAvailableTours(tours.data?.tours ?? []);
    setLocationOverview(locations.data ?? null);
    setLoading(scheduling.state === 'loading');
    setError(error);
  }, [
    error,
    locations.data,
    scheduling.data,
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
    await scheduling.refresh(true);
    void tours.refresh(true);
    void locations.refresh(true);
  }, [invalidate, locations.refresh, scheduling.refresh, tours.refresh]);
};
