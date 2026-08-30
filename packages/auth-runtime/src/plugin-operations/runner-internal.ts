import type * as graphileWorker from 'graphile-worker';

import type { StudioJobSource } from '@sva/core';

import type {
  PluginOperationExecutionHandler,
  PluginOperationExecutionHandlerContext,
  StudioJobExecutionHandler,
} from './types.js';
import { readPluginTenantLifecycleJobMetadata } from '../plugin-tenant-lifecycle/job-correlation.js';

export type StudioJobRunnerPayload = {
  readonly instanceId: string;
  readonly jobId: string;
};

export const pluginTenantLifecycleRetryTaskIdentifier = 'plugin_tenant_lifecycle_retry';

export type StudioJobExecutionRegistration = {
  readonly source: StudioJobSource;
  readonly jobTypeId: string;
  readonly handler: StudioJobExecutionHandler;
  readonly queueName: string;
  readonly executionLane?: 'default' | 'privileged';
  readonly supportsCancellation?: boolean;
};

export type PluginOperationExecutionRegistration = {
  readonly handler: PluginOperationExecutionHandler;
  readonly queueName: string;
  readonly executionLane?: 'default' | 'privileged';
  readonly supportsCancellation?: boolean;
};

export type StudioJobExecutionRegistry = ReadonlyMap<string, StudioJobExecutionRegistration>;
export type PluginOperationExecutionRegistry = ReadonlyMap<
  string,
  PluginOperationExecutionRegistration
>;

export type QueueStudioJobInput = {
  readonly instanceId: string;
  readonly jobId: string;
  readonly queueName: string;
  readonly maxAttempts: number;
  readonly executionLane?: 'default' | 'privileged';
  readonly runAt?: Date;
};

export const adaptPluginOperationExecutionHandler = (
  handler: PluginOperationExecutionHandler
): StudioJobExecutionHandler => {
  return async (context) => {
    if (!context.pluginId) {
      throw new Error('plugin_job_missing_plugin_id');
    }

    const tenantLifecycle = readPluginTenantLifecycleJobMetadata(context.job);
    return (
      (await handler({
        ...context,
        ...(tenantLifecycle ? { tenantLifecycle } : {}),
      } as PluginOperationExecutionHandlerContext)) ?? {}
    );
  };
};

export const toRegistryKey = (source: StudioJobSource, jobTypeId: string): string =>
  `${source}:${jobTypeId}`;

export const toStudioJobTaskList = (
  executeTask: graphileWorker.Task,
  taskIdentifier = 'studio_job_execute'
): graphileWorker.TaskList => ({ [taskIdentifier]: executeTask });
