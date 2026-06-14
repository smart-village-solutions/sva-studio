import { useCallback, useEffect, useRef } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import { loadWasteToursAssignmentOverview, loadWasteToursSchedulingOverview } from './waste-management.tours-overview.parts.js';
import type { WasteToursState } from './use-waste-tours-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteToursOverview = (state: WasteToursState, pt: Translate) => {
  const ptRef = useRef(pt);
  const isMountedRef = useRef(false);
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
  } = state;

  const loadOverview = useCallback(
    async () => {
      try {
        const [toursResponse, fractionsResponse] = await Promise.all([
          getWasteManagementToursOverview(),
          getWasteManagementMasterDataOverview({ scope: 'fractions' }),
        ]);
        if (!isMountedRef.current) return;
        setOverview(toursResponse);
        setCustomRecurrencePresets(toursResponse.customRecurrencePresets ?? []);
        setAvailableFractions(fractionsResponse.fractions);
        setMasterDataOverview(null);
        setAssignmentContextLoading(true);
        setError(null);

        void loadWasteToursAssignmentOverview({
          isMounted: () => isMountedRef.current,
          setAssignmentContextLoading,
          setMasterDataOverview,
        });

        void loadWasteToursSchedulingOverview({
          isMounted: () => isMountedRef.current,
          setSchedulingOverview,
        });
      } catch (loadError) {
        if (!isMountedRef.current) return;
        const code = resolveApiErrorCode(loadError);
        setMasterDataOverview(null);
        setCustomRecurrencePresets([]);
        setAssignmentContextLoading(false);
        setSchedulingOverview(null);
        setError(code === 'forbidden' ? ptRef.current('tours.messages.loadForbidden') : ptRef.current('tours.messages.loadError'));
      } finally {
        if (isMountedRef.current) setLoading(false);
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
    ]
  );

  useEffect(() => {
    isMountedRef.current = true;
    void loadOverview();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadOverview]);

  return loadOverview;
};
