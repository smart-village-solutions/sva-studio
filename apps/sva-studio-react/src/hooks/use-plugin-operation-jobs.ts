import type { StudioJobDetail, StudioJobListItem, StudioJobListQuery } from '@sva/core';
import React from 'react';

import { asIamError, getPluginOperationJob, listPluginOperationJobs, type IamHttpError } from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationAbort,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';

const jobsLogger = createOperationLogger('plugin-operation-jobs-hook', 'debug');
const activePollingIntervalMs = 10_000;

type JobListState = Readonly<{
  error: IamHttpError | null;
  isLoading: boolean;
  items: readonly StudioJobListItem[];
  total: number;
}>;

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
  const abortControllersRef = useAbortControllerSet();
  const latestRequestIdRef = React.useRef(0);
  const [state, setState] = React.useState<JobListState>({
    error: null,
    isLoading: true,
    items: [],
    total: 0,
  });

  const normalizedQuery = React.useMemo(
    () => ({ ...query }),
    [query.jobTypeId, query.page, query.pageSize, query.pluginId, query.q, query.status, query.view]
  );
  const queryKey = React.useMemo(() => JSON.stringify(normalizedQuery), [normalizedQuery]);

  const refetch = React.useCallback(async () => {
    abortInFlightRequests(abortControllersRef.current);
    const controller = new AbortController();
    abortControllersRef.current.add(controller);
    const requestId = ++latestRequestIdRef.current;

    logBrowserOperationStart(jobsLogger, 'studio_plugin_operation_jobs_list_started', {
      operation: 'list_plugin_operation_jobs',
      view: normalizedQuery.view,
    });

    setState((current) => ({
      ...current,
      isLoading: true,
    }));

    try {
      const response = await listPluginOperationJobs(normalizedQuery, { signal: controller.signal });
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setState({
        error: null,
        isLoading: false,
        items: response.data,
        total: response.pagination.total,
      });
      logBrowserOperationSuccess(jobsLogger, 'studio_plugin_operation_jobs_list_succeeded', {
        operation: 'list_plugin_operation_jobs',
        total: response.pagination.total,
        view: normalizedQuery.view,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        logBrowserOperationAbort(jobsLogger, 'studio_plugin_operation_jobs_list_aborted', {
          operation: 'list_plugin_operation_jobs',
          view: normalizedQuery.view,
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
      logBrowserOperationFailure(jobsLogger, 'studio_plugin_operation_jobs_list_failed', resolvedError, {
        operation: 'list_plugin_operation_jobs',
        view: normalizedQuery.view,
      });
    } finally {
      abortControllersRef.current.delete(controller);
    }
  }, [abortControllersRef, normalizedQuery]);

  React.useEffect(() => {
    void refetch();
  }, [queryKey, refetch]);

  React.useEffect(() => {
    if (normalizedQuery.view !== 'active') {
      return;
    }

    const interval = window.setInterval(() => {
      void refetch();
    }, activePollingIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [normalizedQuery.view, refetch]);

  return {
    error: state.error,
    isLoading: state.isLoading,
    items: state.items,
    total: state.total,
    refetch,
  };
};

export const usePluginOperationJobDetail = (jobId: string) => {
  const abortControllersRef = useAbortControllerSet();
  const latestRequestIdRef = React.useRef(0);
  const [state, setState] = React.useState<JobDetailState>({
    detail: null,
    error: null,
    isLoading: true,
  });

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
      logBrowserOperationFailure(jobsLogger, 'studio_plugin_operation_job_detail_failed', resolvedError, {
        operation: 'get_plugin_operation_job',
        job_id: jobId,
      });
    } finally {
      abortControllersRef.current.delete(controller);
    }
  }, [abortControllersRef, jobId]);

  React.useEffect(() => {
    void refetch();
  }, [jobId, refetch]);

  React.useEffect(() => {
    if (!state.detail || ['succeeded', 'failed', 'cancelled'].includes(state.detail.status)) {
      return;
    }

    const interval = window.setInterval(() => {
      void refetch();
    }, activePollingIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [refetch, state.detail]);

  return {
    detail: state.detail,
    error: state.error,
    isLoading: state.isLoading,
    refetch,
  };
};
