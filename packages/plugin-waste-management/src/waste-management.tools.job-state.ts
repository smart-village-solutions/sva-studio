import type { StudioJobResponse } from '@sva/plugin-sdk';
import { wasteManagementOperationsContract } from '@sva/plugin-sdk';
import { useEffect, useRef } from 'react';

import {
  getLatestWasteManagementJob,
  getWasteManagementJobDetail,
} from './waste-management.api.js';

const activePollingIntervalMs = 10_000;
const activeImportPollingIntervalMs = 3_000;
const restoreRetryDelayMs = 1_000;
const restoreMaxAttempts = 3;
const restoreRetryCycleDelayMs = 10_000;
const terminalStatuses = new Set(['succeeded', 'failed', 'cancelled']);

const waitForRestoreRetry = (signal: AbortSignal, delayMs: number) =>
  new Promise<boolean>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve(true);
    }, delayMs);
    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      resolve(false);
    };
    signal.addEventListener('abort', handleAbort, { once: true });
  });

const useRestoreWasteJob = ({
  lastJob,
  restoreJobTypeId,
  setLastJob,
}: {
  readonly lastJob: StudioJobResponse['data'] | null;
  readonly restoreJobTypeId?: string;
  readonly setLastJob: (job: StudioJobResponse['data'] | null) => void;
}) => {
  useEffect(() => {
    if (lastJob || !restoreJobTypeId) return;
    const controller = new AbortController();
    const restore = async () => {
      for (let attempt = 1; !controller.signal.aborted; attempt += 1) {
        try {
          const job = await getLatestWasteManagementJob(restoreJobTypeId, {
            signal: controller.signal,
          });
          if (job && !controller.signal.aborted) setLastJob(job);
          return;
        } catch {
          if (controller.signal.aborted) return;
          const attemptInCycle = ((attempt - 1) % restoreMaxAttempts) + 1;
          const shouldRetry = await waitForRestoreRetry(
            controller.signal,
            attemptInCycle === restoreMaxAttempts
              ? restoreRetryCycleDelayMs
              : restoreRetryDelayMs * 2 ** (attemptInCycle - 1)
          );
          if (!shouldRetry) return;
        }
      }
    };
    void restore();
    return () => controller.abort();
  }, [lastJob, restoreJobTypeId, setLastJob]);
};

export const useWasteTrackedJob = ({
  lastJob,
  refreshTechnicalHistory,
  onTerminalJob,
  restoreJobTypeId,
  setLastJob,
}: {
  readonly lastJob: StudioJobResponse['data'] | null;
  readonly refreshTechnicalHistory: () => Promise<void>;
  readonly onTerminalJob?: (job: StudioJobResponse['data']) => void | Promise<void>;
  readonly restoreJobTypeId?: string;
  readonly setLastJob: (job: StudioJobResponse['data'] | null) => void;
}) => {
  const latestRequestIdRef = useRef(0);
  const latestOnTerminalJobRef = useRef(onTerminalJob);
  useRestoreWasteJob({ lastJob, restoreJobTypeId, setLastJob });

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
        const detail = await getWasteManagementJobDetail(lastJob.id, {
          signal: controller.signal,
        });
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
