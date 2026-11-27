import type { StudioJobDetail, StudioJobListItem, StudioJobListQuery } from '@sva/core';
import React from 'react';
import { useStudioTableInvalidation, useStudioTableQuery } from '@sva/studio-ui-react';

import {
  asIamError,
  cancelPluginOperationJob,
  getPluginOperationJob,
  listPluginOperationJobs,
  type IamHttpError,
} from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationAbort,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';

const jobsLogger = createOperationLogger('plugin-operation-jobs-hook', 'debug');
const activePollingIntervalMs = 10_000;

const EMPTY_JOBS: readonly StudioJobListItem[] = [];

type JobDetailState = Readonly<{
  detail: StudioJobDetail | null;
  error: IamHttpError | null;
  isLoading: boolean;
}>;

const useAbortControllerSet = () => {
  const abortControllersRef = React.useRef<Set<AbortController>>(new Set());

  React.useEffect(
    () => () => {
      for (const controller of abortControllersRef.current) {
        controller.abort();
      }
      abortControllersRef.current.clear();
    },
    []
  );

  return abortControllersRef;
};

const abortInFlightRequests = (controllers: Set<AbortController>): void => {
  for (const controller of controllers) {
    controller.abort();
  }
  controllers.clear();
};

export const usePluginOperationJobs = (query: StudioJobListQuery) => {
  const list = useStudioTableQuery(['plugin-operation-jobs', query], async (signal) => {
    const meta = { operation: 'list_plugin_operation_jobs', view: query.view };
    logBrowserOperationStart(jobsLogger, 'studio_plugin_operation_jobs_list_started', meta);
    try {
      const response = await listPluginOperationJobs(query, { signal });
      logBrowserOperationSuccess(jobsLogger, 'studio_plugin_operation_jobs_list_succeeded', {
        ...meta,
        total: response.pagination.total,
      });
      return response;
    } catch (cause) {
      if (signal.aborted) {
        logBrowserOperationAbort(jobsLogger, 'studio_plugin_operation_jobs_list_aborted', meta);
        throw cause;
      }
      const error = asIamError(cause);
      logBrowserOperationFailure(
        jobsLogger,
        'studio_plugin_operation_jobs_list_failed',
        error,
        meta
      );
      throw error;
    }
  });
  const refetch = React.useCallback(async () => {
    await list.refetch();
  }, [list.refetch]);

  React.useEffect(() => {
    if (query.view !== 'active') {
      return;
    }

    const interval = window.setInterval(() => {
      void refetch();
    }, activePollingIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [query.view, refetch]);

  return {
    error: list.error as IamHttpError | null,
    isLoading: list.state === 'loading',
    items: list.data?.data ?? EMPTY_JOBS,
    total: list.data?.pagination.total ?? 0,
    refetch,
  };
};

export const usePluginOperationJobDetail = (jobId: string) => {
  const invalidate = useStudioTableInvalidation();
  const abortControllersRef = useAbortControllerSet();
  const activeJobIdRef = React.useRef(jobId);
  activeJobIdRef.current = jobId;
  const cancellationInFlightJobIdsRef = React.useRef<Set<string>>(new Set());
  const latestRequestIdRef = React.useRef(0);
  const [state, setState] = React.useState<JobDetailState>({
    detail: null,
    error: null,
    isLoading: true,
  });
  const [actionError, setActionError] = React.useState<IamHttpError | null>(null);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const refetch = React.useCallback(async () => {
    if (!jobId) {
      setState({
        detail: null,
        error: null,
        isLoading: false,
      });
      return;
    }

    abortInFlightRequests(abortControllersRef.current);
    const controller = new AbortController();
    abortControllersRef.current.add(controller);
    const requestId = ++latestRequestIdRef.current;

    logBrowserOperationStart(jobsLogger, 'studio_plugin_operation_job_detail_started', {
      operation: 'get_plugin_operation_job',
      job_id: jobId,
    });

    setState((current) => ({
      ...current,
      isLoading: true,
    }));

    try {
      const detail = await getPluginOperationJob(jobId, { signal: controller.signal });
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setState({
        detail,
        error: null,
        isLoading: false,
      });
      logBrowserOperationSuccess(jobsLogger, 'studio_plugin_operation_job_detail_succeeded', {
        operation: 'get_plugin_operation_job',
        job_id: jobId,
        status: detail.status,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        logBrowserOperationAbort(jobsLogger, 'studio_plugin_operation_job_detail_aborted', {
          operation: 'get_plugin_operation_job',
          job_id: jobId,
        });
        return;
      }

      const resolvedError = asIamError(error);
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setState((current) => ({
        ...current,
        error: resolvedError,
        isLoading: false,
      }));
      logBrowserOperationFailure(
        jobsLogger,
        'studio_plugin_operation_job_detail_failed',
        resolvedError,
        {
          operation: 'get_plugin_operation_job',
          job_id: jobId,
        }
      );
    } finally {
      abortControllersRef.current.delete(controller);
    }
  }, [abortControllersRef, jobId]);

  React.useEffect(() => {
    setActionError(null);
    setIsCancelling(false);
    void refetch();
  }, [jobId, refetch]);

  React.useEffect(() => {
    if (
      state.detail?.id !== jobId ||
      ['succeeded', 'failed', 'cancelled'].includes(state.detail.status)
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void refetch();
    }, activePollingIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [jobId, refetch, state.detail]);

  const cancel = React.useCallback(async () => {
    if (
      state.detail?.id !== jobId ||
      !state.detail?.availableActions?.includes('cancel') ||
      cancellationInFlightJobIdsRef.current.has(jobId)
    ) {
      return false;
    }
    cancellationInFlightJobIdsRef.current.add(jobId);
    setIsCancelling(true);
    setActionError(null);
    try {
      const acceptedJob = await cancelPluginOperationJob(jobId);
      void invalidate(['plugin-operation-jobs']);
      if (activeJobIdRef.current !== jobId) {
        return true;
      }
      setState((current) =>
        current.detail
          ? {
              ...current,
              detail: {
                ...current.detail,
                availableActions: [],
                cancelRequestedAt: acceptedJob.cancelRequestedAt,
              },
            }
          : current
      );
      await refetch();
      return true;
    } catch (error) {
      if (activeJobIdRef.current === jobId) {
        setActionError(asIamError(error));
      }
      return false;
    } finally {
      cancellationInFlightJobIdsRef.current.delete(jobId);
      if (activeJobIdRef.current === jobId) {
        setIsCancelling(false);
      }
    }
  }, [invalidate, jobId, refetch, state.detail?.availableActions, state.detail?.id]);

  return {
    actionError,
    cancel,
    detail: state.detail?.id === jobId ? state.detail : null,
    error: state.error,
    isLoading: state.isLoading,
    isCancelling: isCancelling && cancellationInFlightJobIdsRef.current.has(jobId),
    refetch,
  };
};
