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
export type StudioJobExecutionResult = PluginJobExecutionResult;
export type StudioJobExecutionHandlerContext = Omit<PluginJobHandlerContext, 'pluginId'> & {
  readonly pluginId?: string;
  readonly job: StudioJobRecord;
};
export type StudioJobExecutionProgressContext = PluginJobProgressReporter;
export type StudioJobExecutionHandler = (
  context: StudioJobExecutionHandlerContext
) => Promise<StudioJobExecutionResult> | StudioJobExecutionResult;

export type PluginOperationExecutionResult = PluginJobExecutionResult;
export type PluginOperationExecutionHandlerContext = PluginJobHandlerContext & {
  readonly job: StudioJobRecord & { readonly pluginId: string };
};
export type PluginOperationExecutionProgressContext = PluginJobProgressReporter;
export type PluginOperationExecutionHandler = PluginJobExecutionHandler;
