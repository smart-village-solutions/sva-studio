import type { StudioJobRecord } from '@sva/core';
import type {
  PluginExecutionLogger,
  PluginJobExecutionHandler,
  PluginJobExecutionResult,
  PluginJobHandlerContext,
  PluginJobProgressReporter,
} from '@sva/plugin-sdk';

export type PluginOperationLogger = PluginExecutionLogger;
export type PluginOperationProgressReporter = PluginJobProgressReporter;
export type PluginOperationExecutionResult = PluginJobExecutionResult;
export type PluginOperationExecutionHandlerContext = PluginJobHandlerContext & {
  readonly job: StudioJobRecord;
};
export type PluginOperationExecutionProgressContext = PluginJobProgressReporter;
export type PluginOperationExecutionHandler = PluginJobExecutionHandler;
