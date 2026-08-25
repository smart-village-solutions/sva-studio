import type { WasteManagementHistoryOverview } from '@sva/plugin-sdk';
import { useEffect, useRef, useState } from 'react';

import { getWasteManagementHistoryOverview } from './waste-management.api.js';

export const useWasteTechnicalHistory = () => {
  const [technicalHistory, setTechnicalHistory] = useState<
    readonly WasteManagementHistoryOverview['technical']['items'][number][]
  >([]);
  const isMountedRef = useRef(false);

  const refreshTechnicalHistory = async (propagateFailure = false) => {
    try {
      const history = await getWasteManagementHistoryOverview({ page: 1, pageSize: 8 });
      if (isMountedRef.current) {
        setTechnicalHistory(history.technical.items);
      }
    } catch (error) {
      if (propagateFailure) throw error;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    void refreshTechnicalHistory();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return { technicalHistory, refreshTechnicalHistory };
};
