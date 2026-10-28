import type * as graphileWorker from 'graphile-worker';

import type { StudioJobSource } from '@sva/core';

import type {
  PluginOperationExecutionHandler,
  PluginOperationExecutionHandlerContext,
  StudioJobExecutionHandler,
} from './types.js';
import { readPluginTenantLifecycleJobMetadata } from '../plugin-tenant-lifecycle/job-correlation.js';
import { isConfiguredLifecycleJob } from './runner-lifecycle.js';

export type StudioJobRunnerPayload = {
  readonly instanceId: string;
  readonly jobId: string;
};

export const pluginTenantLifecycleRetryTaskIdentifier = 'plugin_tenant_lifecycle_retry';
export const studioJobTaskIdentifier = 'studio_job_execute';
export const privilegedStudioJobTaskIdentifier = 'studio_job_execute_privileged';

export type StudioJobExecutionRegistration = {
  readonly source: StudioJobSource;
  readonly jobTypeId: string;
  readonly handler: StudioJobExecutionHandler;
  readonly queueName: string;
  readonly executionLane?: 'default' | 'privileged';
  readonly supportsCancellation?: boolean;
  readonly startPolicy?: 'standard' | 'dedicated';
  readonly artifactPermissionId?: string;
};

export type PluginOperationExecutionRegistration = {
  readonly handler: PluginOperationExecutionHandler;
  readonly queueName: string;
  readonly executionLane?: 'default' | 'privileged';
  readonly supportsCancellation?: boolean;
  readonly startPolicy?: 'standard' | 'dedicated';
  readonly artifactPermissionId?: string;
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
  handler: PluginOperationExecutionHandler,
  isLifecycleJob: (job: Parameters<StudioJobExecutionHandler>[0]['job']) => boolean = () => false
): StudioJobExecutionHandler => {
  return async (context) => {
    if (!context.pluginId) {
      throw new Error('plugin_job_missing_plugin_id');
    }

    const tenantLifecycle = isLifecycleJob(context.job)
      ? readPluginTenantLifecycleJobMetadata(context.job)
      : null;
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

let registeredStudioJobHandlers = new Map<string, StudioJobExecutionRegistration>();

export const normalizePluginRegistration = (
  jobTypeId: string,
  value: PluginOperationExecutionHandler | PluginOperationExecutionRegistration
): StudioJobExecutionRegistration => ({
  source: 'plugin',
  jobTypeId,
  handler: adaptPluginOperationExecutionHandler(
    typeof value === 'function' ? value : value.handler,
    isConfiguredLifecycleJob
  ),
  queueName: typeof value === 'function' ? 'plugin-operations' : value.queueName,
  executionLane: typeof value === 'function' ? 'default' : value.executionLane,
  supportsCancellation: typeof value === 'function' ? false : value.supportsCancellation,
  startPolicy: typeof value === 'function' ? 'standard' : value.startPolicy,
  artifactPermissionId: typeof value === 'function' ? undefined : value.artifactPermissionId,
});

const replaceRegistrationsBySource = (
  nextSource: StudioJobExecutionRegistration['source'],
  nextRegistrations: readonly StudioJobExecutionRegistration[]
): void => {
  const preservedEntries = [...registeredStudioJobHandlers.values()].filter(
    (entry) => entry.source !== nextSource
  );
  registeredStudioJobHandlers = new Map(
    [...preservedEntries, ...nextRegistrations].map((entry) => [
      toRegistryKey(entry.source, entry.jobTypeId),
      entry,
    ])
  );
};

export const registerStudioJobExecutionHandlers = (
  handlers: readonly StudioJobExecutionRegistration[]
): void => {
  replaceRegistrationsBySource(
    'host',
    handlers.filter((entry) => entry.source === 'host')
  );
};

export const registerPluginOperationExecutionHandlers = (
  handlers: Readonly<
    Record<string, PluginOperationExecutionHandler | PluginOperationExecutionRegistration>
  >
): void => {
  replaceRegistrationsBySource(
    'plugin',
    Object.entries(handlers).map(([jobTypeId, value]) =>
      normalizePluginRegistration(jobTypeId, value)
    )
  );
};

export const getRegisteredStudioJobExecutionRegistry = (): StudioJobExecutionRegistry =>
  registeredStudioJobHandlers;

export const getRegisteredPluginOperationExecutionRegistry = (): PluginOperationExecutionRegistry =>
  new Map(
    [...registeredStudioJobHandlers.values()]
      .filter(
        (entry): entry is StudioJobExecutionRegistration & { source: 'plugin' } =>
          entry.source === 'plugin'
      )
      .map((entry) => [
        entry.jobTypeId,
        {
          handler: entry.handler as PluginOperationExecutionHandler,
          queueName: entry.queueName,
          executionLane: entry.executionLane,
          supportsCancellation: entry.supportsCancellation,
          startPolicy: entry.startPolicy,
          artifactPermissionId: entry.artifactPermissionId,
        },
      ])
  );
