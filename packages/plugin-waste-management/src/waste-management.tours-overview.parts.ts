import type { RefObject } from 'react';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import {
  getWasteManagementMasterDataOverview,
  getWasteManagementToursOverview,
  getWasteManagementSchedulingOverview,
} from './waste-management.api.js';
import type { WasteToursState } from './use-waste-tours-state.js';

export const loadWasteToursAssignmentOverview = async ({
  isMounted,
  setAssignmentContextLoading,
  setMasterDataOverview,
}: {
  readonly isMounted: () => boolean;
  readonly setAssignmentContextLoading: WasteToursState['setAssignmentContextLoading'];
  readonly setMasterDataOverview: WasteToursState['setMasterDataOverview'];
}) => {
  try {
    const masterDataResponse = await getWasteManagementMasterDataOverview({ scope: 'locations' });
    if (isMounted()) {
      setMasterDataOverview(masterDataResponse);
    }
  } catch {
    if (isMounted()) {
      setMasterDataOverview(null);
    }
  } finally {
    if (isMounted()) {
      setAssignmentContextLoading(false);
    }
  }
};

export const loadWasteToursSchedulingOverview = async ({
  isMounted,
  setSchedulingOverview,
  setSchedulingLoadState,
}: {
  readonly isMounted: () => boolean;
  readonly setSchedulingOverview: WasteToursState['setSchedulingOverview'];
  readonly setSchedulingLoadState: WasteToursState['setSchedulingLoadState'];
}) => {
  try {
    const schedulingResponse = await getWasteManagementSchedulingOverview();
    if (isMounted()) {
      setSchedulingOverview(schedulingResponse);
      setSchedulingLoadState('ready');
    }
  } catch {
    if (isMounted()) {
      setSchedulingOverview(null);
      setSchedulingLoadState('error');
    }
  }
};

export const loadWasteToursOverview = async (state: Pick<WasteToursState,
  'setAssignmentContextLoading' | 'setAvailableFractions' | 'setCustomRecurrencePresets' | 'setError' | 'setLoading' | 'setMasterDataOverview' | 'setOverview' | 'setSchedulingOverview' | 'setSchedulingLoadState' | 'schedulingRequestRef'
>, { ptRef, isMounted, loadGeneration, propagateError }: Readonly<{
  ptRef: RefObject<(key: string) => string>;
  isMounted: RefObject<boolean>;
  loadGeneration: RefObject<number>;
  propagateError: boolean;
}>) => {
  const { setAssignmentContextLoading, setAvailableFractions, setCustomRecurrencePresets, setError, setLoading, setMasterDataOverview, setOverview, setSchedulingOverview, setSchedulingLoadState, schedulingRequestRef } = state;
      const generation = ++loadGeneration.current;
      const schedulingRequest = ++schedulingRequestRef.current;
      const isCurrentSchedulingRequest = () =>
        isCurrent() && schedulingRequestRef.current === schedulingRequest;
      const isCurrent = () => isMounted.current && generation === loadGeneration.current;
      setSchedulingOverview(null);
      setSchedulingLoadState('loading');
      try {
        const [toursResponse, fractionsResponse] = await Promise.all([
          getWasteManagementToursOverview(),
          getWasteManagementMasterDataOverview({ scope: 'fractions' }),
        ]);
        if (!isCurrent()) return;
        setOverview(toursResponse);
        setCustomRecurrencePresets(toursResponse.customRecurrencePresets ?? []);
        setAvailableFractions(fractionsResponse.fractions);
        setMasterDataOverview(null);
        setAssignmentContextLoading(true);
        setError(null);

        void loadWasteToursAssignmentOverview({
          isMounted: isCurrent,
          setAssignmentContextLoading,
          setMasterDataOverview,
        });

        void loadWasteToursSchedulingOverview({
          isMounted: isCurrentSchedulingRequest,
          setSchedulingOverview,
          setSchedulingLoadState,
        });
      } catch (loadError) {
        if (!isCurrent()) {
          if (propagateError) throw loadError;
          return;
        }
        if (isCurrentSchedulingRequest()) setSchedulingLoadState('error');
        if (propagateError) throw loadError;
        const code = resolveApiErrorCode(loadError);
        setMasterDataOverview(null);
        setCustomRecurrencePresets([]);
        setAssignmentContextLoading(false);
        if (isCurrentSchedulingRequest()) setSchedulingOverview(null);
        setError(
          code === 'forbidden'
            ? ptRef.current('tours.messages.loadForbidden')
            : ptRef.current('tours.messages.loadError')
        );
      } finally {
        if (isCurrent()) setLoading(false);
      }
  };
