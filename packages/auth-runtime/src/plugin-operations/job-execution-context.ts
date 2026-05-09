import type { StudioJobRecord } from '@sva/core';

import { throwIfCancellationRequested } from './job-cancellation.js';
import type {
  PluginOperationExecutionHandlerContext,
  PluginOperationLogger,
  PluginOperationProgressReporter,
} from './types.js';

type JobExecutionContextDeps = {
  readonly job: Pick<StudioJobRecord, 'id' | 'requestId' | 'actorAccountId' | 'cancelRequestedAt'>;
  readonly logger: PluginOperationLogger;
  readonly progressReporter: PluginOperationProgressReporter;
  readonly isCancellationRequested: () => Promise<boolean>;
};

export const createJobExecutionContext = (
  deps: JobExecutionContextDeps
): Omit<PluginOperationExecutionHandlerContext, 'job'> => {
  const abortController = new AbortController();
  if (deps.job.cancelRequestedAt) {
    abortController.abort();
  }

  return {
    logger: deps.logger,
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
  };
};
