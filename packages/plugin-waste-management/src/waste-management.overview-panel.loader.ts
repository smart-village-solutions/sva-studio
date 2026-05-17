import { useEffect, useRef, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';

import type { WasteManagementHistoryOverview } from './waste-management.api.js';
import { getWasteManagementHistoryOverview } from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const useWasteOverviewPanelState = (search: WasteManagementSearchParams) => {
  const pt = usePluginTranslation('wasteManagement');
  const ptRef = useRef(pt);
  ptRef.current = pt;
  const isMountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementHistoryOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;

    void (async () => {
      setLoading(true);
      try {
        const response = await getWasteManagementHistoryOverview({
          q: search.q,
          page: search.page,
          pageSize: search.pageSize,
        });
        if (!isMountedRef.current || requestSequenceRef.current !== requestSequence) {
          return;
        }
        setOverview(response);
        setError(null);
      } catch (loadError) {
        if (!isMountedRef.current || requestSequenceRef.current !== requestSequence) {
          return;
        }
        const code = resolveApiErrorCode(loadError);
        setError(
          code === 'forbidden'
            ? ptRef.current('overview.messages.loadForbidden')
            : ptRef.current('overview.messages.loadError')
        );
      } finally {
        if (isMountedRef.current && requestSequenceRef.current === requestSequence) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMountedRef.current = false;
    };
  }, [search.page, search.pageSize, search.q]);

  return {
    loading,
    overview,
    error,
  };
};
