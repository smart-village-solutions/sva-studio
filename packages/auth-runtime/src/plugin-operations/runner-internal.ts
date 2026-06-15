import type * as graphileWorker from 'graphile-worker';

import type { StudioJobSource } from '@sva/core';

import type {
  PluginOperationExecutionHandler,
  PluginOperationExecutionHandlerContext,
  StudioJobExecutionHandler,
} from './types.js';

export type StudioJobRunnerPayload = {
  readonly instanceId: string;
  readonly jobId: string;
};

export type StudioJobExecutionRegistration = {
  readonly source: StudioJobSource;
  readonly jobTypeId: string;
  readonly handler: StudioJobExecutionHandler;
  readonly queueName: string;
};

export type PluginOperationExecutionRegistration = {
  readonly handler: PluginOperationExecutionHandler;
  readonly queueName: string;
};

export type StudioJobExecutionRegistry = ReadonlyMap<string, StudioJobExecutionRegistration>;
export type PluginOperationExecutionRegistry = ReadonlyMap<string, PluginOperationExecutionRegistration>;

export type QueueStudioJobInput = {
  readonly instanceId: string;
  readonly jobId: string;
  readonly queueName: string;
  readonly maxAttempts: number;
};

export const adaptPluginOperationExecutionHandler = (
  handler: PluginOperationExecutionHandler
): StudioJobExecutionHandler => {
  return async (context) => {
    if (!context.pluginId) {
      throw new Error('plugin_job_missing_plugin_id');
    }

    return (await handler(context as PluginOperationExecutionHandlerContext)) ?? {};
  };
};

export const toRegistryKey = (source: StudioJobSource, jobTypeId: string): string => `${source}:${jobTypeId}`;

export const toStudioJobTaskList = (executeTask: graphileWorker.Task): graphileWorker.TaskList => ({
  studio_job_execute: executeTask,
});
