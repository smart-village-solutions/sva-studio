import type { StudioJobRecord } from '@sva/core';
import { definePluginExecutionContextCapabilities } from '@sva/plugin-sdk';

import { throwIfCancellationRequested } from './job-cancellation.js';
import type {
  PluginOperationExecutionHandlerContext,
  PluginOperationLogger,
  PluginOperationExecutionProgressContext,
} from './types.js';

type JobExecutionContextDeps = {
  readonly job: Pick<
    StudioJobRecord,
    'id' | 'pluginId' | 'instanceId' | 'requestId' | 'actorAccountId' | 'cancelRequestedAt'
  >;
  readonly logger: PluginOperationLogger;
  readonly progressReporter: PluginOperationExecutionProgressContext;
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
  };
};
