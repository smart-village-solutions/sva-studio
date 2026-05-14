import type { StudioJobResponse } from '@sva/plugin-sdk';
import { useEffect, useRef } from 'react';

import { getWasteManagementJobDetail } from './waste-management.api.js';

const activePollingIntervalMs = 10_000;
const terminalStatuses = new Set(['succeeded', 'failed', 'cancelled']);

export const useWasteTrackedJob = ({
  lastJob,
  refreshTechnicalHistory,
  setLastJob,
}: {
  readonly lastJob: StudioJobResponse['data'] | null;
  readonly refreshTechnicalHistory: () => Promise<void>;
  readonly setLastJob: (job: StudioJobResponse['data'] | null) => void;
}) => {
  const latestRequestIdRef = useRef(0);

  useEffect(() => {
    if (!lastJob?.id || terminalStatuses.has(lastJob.status)) {
      return;
    }

    let isDisposed = false;
    let activeController: AbortController | null = null;

    const refreshJob = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const requestId = ++latestRequestIdRef.current;

      try {
        const detail = await getWasteManagementJobDetail(lastJob.id, { signal: controller.signal });
        if (isDisposed || requestId !== latestRequestIdRef.current) {
          return;
        }
        setLastJob(detail);
        await refreshTechnicalHistory();
      } catch {
        if (controller.signal.aborted || isDisposed || requestId !== latestRequestIdRef.current) {
          return;
        }
      }
    };

    void refreshJob();
    const intervalId = window.setInterval(() => {
      void refreshJob();
    }, activePollingIntervalMs);

    return () => {
      isDisposed = true;
      activeController?.abort();
      window.clearInterval(intervalId);
    };
  }, [lastJob?.id, lastJob?.status, refreshTechnicalHistory, setLastJob]);
};
