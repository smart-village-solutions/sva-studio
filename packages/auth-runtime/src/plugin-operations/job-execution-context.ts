import type { StudioJobRecord } from '@sva/core';
import { definePluginExecutionContextCapabilities } from '@sva/plugin-sdk';

import { throwIfCancellationRequested } from './job-cancellation.js';
import type {
  PluginOperationLogger,
  PluginOperationExecutionProgressContext,
  StudioJobExecutionHandlerContext,
} from './types.js';

type JobExecutionContextDeps = {
  readonly job: Pick<
    StudioJobRecord,
    'id' | 'pluginId' | 'instanceId' | 'requestId' | 'actorAccountId' | 'cancelRequestedAt'
  >;
  readonly logger: PluginOperationLogger;
  readonly progressReporter: PluginOperationExecutionProgressContext;
  readonly isCancellationRequested: () => Promise<boolean>;
  readonly cancellationPollIntervalMs?: number;
};

type ManagedJobExecutionContext = {
  readonly context: Omit<StudioJobExecutionHandlerContext, 'job'>;
  readonly dispose: () => void;
};

export const createJobExecutionContext = (
  deps: JobExecutionContextDeps
): ManagedJobExecutionContext => {
  const abortController = new AbortController();
  if (deps.job.cancelRequestedAt) {
    abortController.abort();
  }

  let disposed = false;
  let cancellationPollFailureObserved = false;
  let cancellationPollRecoveryLogged = false;
  const pollInterval = setInterval(() => {
    void deps
      .isCancellationRequested()
      .then((cancellationRequested) => {
        if (cancellationPollFailureObserved && !cancellationPollRecoveryLogged && !disposed) {
          cancellationPollRecoveryLogged = true;
          deps.logger.debug('plugin_operation_cancellation_poll_recovered', {
            operation: 'plugin_operation_cancellation_poll',
            error_code: 'cancellation_poll_failed',
            result: 'recovered',
            job_id: deps.job.id,
            execution_id: deps.job.id,
            instance_id: deps.job.instanceId,
          });
        }
        if (disposed || cancellationRequested === false || abortController.signal.aborted) {
          return;
        }

        abortController.abort();
      })
      .catch((error: unknown) => {
        if (disposed || cancellationPollFailureObserved) {
          return;
        }

        cancellationPollFailureObserved = true;
        deps.logger.warn('plugin_operation_cancellation_poll_failed', {
          operation: 'plugin_operation_cancellation_poll',
          error_code: 'cancellation_poll_failed',
          error_type: error instanceof Error ? error.name : typeof error,
          retry_class: 'next_poll',
          result: 'degraded',
          job_id: deps.job.id,
          execution_id: deps.job.id,
          instance_id: deps.job.instanceId,
        });
      });
  }, deps.cancellationPollIntervalMs ?? 1_000);
  pollInterval.unref?.();

  return {
    context: {
      kind: 'job',
      pluginId: deps.job.pluginId,
      jobId: deps.job.id,
      instanceId: deps.job.instanceId,
      logger: deps.logger,
      capabilities: definePluginExecutionContextCapabilities({
        requestContext: true,
        auditReporter: false,
        progressReporter: true,
        secretAccess: false,
      }),
      progressReporter: deps.progressReporter,
      abortSignal: abortController.signal,
      isCancellationRequested: deps.isCancellationRequested,
      throwIfCancellationRequested: () =>
        throwIfCancellationRequested({
          isCancellationRequested: deps.isCancellationRequested,
          cancelRequestedAt: deps.job.cancelRequestedAt,
        }),
      requestId: deps.job.requestId,
      actorAccountId: deps.job.actorAccountId,
    },
    dispose: () => {
      disposed = true;
      clearInterval(pollInterval);
    },
  };
};
