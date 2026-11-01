import { useCallback, useEffect, useRef } from 'react';

import {
  loadWasteToursOverview,
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
    (propagateError = false) => loadWasteToursOverview({
      setAssignmentContextLoading, setAvailableFractions, setCustomRecurrencePresets, setError, setLoading,
      setMasterDataOverview, setOverview, setSchedulingOverview, setSchedulingLoadState, schedulingRequestRef,
    }, { ptRef, isMounted: isMountedRef, loadGeneration: loadGenerationRef, propagateError }),
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
