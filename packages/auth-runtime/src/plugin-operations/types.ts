import type { StudioJobProgress, StudioJobRecord, StudioJobResult } from '@sva/core';

export type PluginOperationLogger = ReturnType<(typeof import('@sva/server-runtime'))['createSdkLogger']>;

export type PluginOperationProgressReporter = {
  reportProgress(input: {
    jobId: string;
    instanceId: string;
    progress: StudioJobProgress;
  }): Promise<void>;
};

export type PluginOperationExecutionResult = {
  readonly progress?: StudioJobProgress;
  readonly resultPayload?: StudioJobResult;
};

export type PluginOperationExecutionHandlerContext = {
  readonly job: StudioJobRecord;
  readonly logger: PluginOperationLogger;
  readonly progressReporter: PluginOperationProgressReporter;
  readonly abortSignal: AbortSignal;
  readonly isCancellationRequested: () => Promise<boolean>;
  readonly throwIfCancellationRequested: () => Promise<void>;
  readonly requestId?: string;
  readonly actorAccountId?: string;
};

export type PluginOperationExecutionHandler = (
  context: PluginOperationExecutionHandlerContext
) => Promise<PluginOperationExecutionResult | void>;
