import type { WasteManagementHistoryOverview } from '@sva/core';
import { useEffect, useState } from 'react';

import { getWasteManagementHistoryOverview } from './waste-management.api.js';

export const useWasteTechnicalHistory = () => {
  const [technicalHistory, setTechnicalHistory] = useState<readonly WasteManagementHistoryOverview['technical']['items'][number][]>([]);

  const refreshTechnicalHistory = async (active = true) => {
    try {
      const history = await getWasteManagementHistoryOverview({ page: 1, pageSize: 8 });
      if (active) {
        setTechnicalHistory(history.technical.items);
      }
    } catch {
      if (active) {
        setTechnicalHistory([]);
      }
    }
  };

  useEffect(() => {
    let active = true;
    void refreshTechnicalHistory(active);
    return () => {
      active = false;
    };
  }, []);

  return { technicalHistory, refreshTechnicalHistory };
};
