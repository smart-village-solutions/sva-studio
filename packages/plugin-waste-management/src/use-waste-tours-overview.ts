import { useCallback, useEffect, useRef } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import {
  loadWasteToursAssignmentOverview,
  loadWasteToursSchedulingOverview,
} from './waste-management.tours-overview.parts.js';
import type { WasteToursState } from './use-waste-tours-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteToursOverview = (state: WasteToursState, pt: Translate) => {
  const ptRef = useRef(pt);
  const isMountedRef = useRef(false);
  const loadGenerationRef = useRef(0);
  ptRef.current = pt;
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
    schedulingRequestRef,
  } = state;

  const loadOverview = useCallback(
    async (propagateError = false) => {
      const generation = ++loadGenerationRef.current;
      const schedulingRequest = ++schedulingRequestRef.current;
      const isCurrentSchedulingRequest = () =>
        isCurrent() && schedulingRequestRef.current === schedulingRequest;
      const isCurrent = () => isMountedRef.current && generation === loadGenerationRef.current;
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
    },
    [
      setAssignmentContextLoading,
      setAvailableFractions,
      setCustomRecurrencePresets,
      setError,
      setLoading,
      setMasterDataOverview,
      setOverview,
      setSchedulingOverview,
      setSchedulingLoadState,
      schedulingRequestRef,
    ]
  );

  useEffect(() => {
    isMountedRef.current = true;
    void loadOverview();
    return () => {
      isMountedRef.current = false;
      schedulingRequestRef.current += 1;
    };
  }, [loadOverview, schedulingRequestRef]);

  return loadOverview;
};
