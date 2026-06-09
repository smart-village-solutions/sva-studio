import type { StudioJobResponse } from '@sva/plugin-sdk';
import { wasteManagementOperationsContract } from '@sva/plugin-sdk';
import { useEffect, useRef } from 'react';

import { getWasteManagementJobDetail } from './waste-management.api.js';

const activePollingIntervalMs = 10_000;
const activeImportPollingIntervalMs = 3_000;
const terminalStatuses = new Set(['succeeded', 'failed', 'cancelled']);

export const useWasteTrackedJob = ({
  lastJob,
  refreshTechnicalHistory,
  onTerminalJob,
  setLastJob,
}: {
  readonly lastJob: StudioJobResponse['data'] | null;
  readonly refreshTechnicalHistory: () => Promise<void>;
  readonly onTerminalJob?: (job: StudioJobResponse['data']) => void | Promise<void>;
  readonly setLastJob: (job: StudioJobResponse['data'] | null) => void;
}) => {
  const latestRequestIdRef = useRef(0);
  const latestOnTerminalJobRef = useRef(onTerminalJob);

  useEffect(() => {
    latestOnTerminalJobRef.current = onTerminalJob;
  }, [onTerminalJob]);

  useEffect(() => {
    if (!lastJob?.id || terminalStatuses.has(lastJob.status)) {
      return;
    }

    const pollingIntervalMs =
      lastJob.jobTypeId === wasteManagementOperationsContract.jobTypeIds.importData
        ? activeImportPollingIntervalMs
        : activePollingIntervalMs;

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
        if (terminalStatuses.has(detail.status)) {
          await latestOnTerminalJobRef.current?.(detail);
        }
      } catch {
        if (controller.signal.aborted || isDisposed || requestId !== latestRequestIdRef.current) {
          return;
        }
      }
    };

    void refreshJob();
    const intervalId = window.setInterval(() => {
      void refreshJob();
    }, pollingIntervalMs);

    return () => {
      isDisposed = true;
      activeController?.abort();
      window.clearInterval(intervalId);
    };
  }, [lastJob?.id, lastJob?.status, refreshTechnicalHistory, setLastJob]);
};
