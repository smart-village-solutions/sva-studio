import * as graphileWorker from 'graphile-worker';

import type { StudioJobRecord } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import { readInstanceRegistryPluginTenantLifecycleRegistry } from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
import {
  createPluginTenantLifecycleJobCorrelation,
  pluginTenantLifecycleJobInputKey,
} from '../plugin-tenant-lifecycle/job-correlation.js';
import { createJobLifecycleOrchestrator } from './job-lifecycle-orchestrator.js';
import {
  withPluginTenantLifecycleRepository,
  withStudioJobLifecycleRepositories,
  withStudioJobRepository,
} from './repository.js';
import type { PluginOperationExecutionHandler } from './types.js';
import type {
  PluginOperationExecutionRegistration,
  PluginOperationExecutionRegistry,
  StudioJobExecutionRegistration,
  StudioJobExecutionRegistry,
  StudioJobRunnerPayload,
} from './runner-internal.js';
import {
  adaptPluginOperationExecutionHandler,
  toRegistryKey,
  toStudioJobTaskList,
} from './runner-internal.js';

const logger = createSdkLogger({ component: 'studio-jobs-runner', level: 'info' });

export const studioJobTaskIdentifier = 'studio_job_execute';
export const privilegedStudioJobTaskIdentifier = 'studio_job_execute_privileged';
export const pluginOperationTaskIdentifier = studioJobTaskIdentifier;

let registeredStudioJobHandlers = new Map<string, StudioJobExecutionRegistration>();

const normalizePluginRegistration = (
  jobTypeId: string,
  value: PluginOperationExecutionHandler | PluginOperationExecutionRegistration
): StudioJobExecutionRegistration => ({
  source: 'plugin',
  jobTypeId,
  handler: adaptPluginOperationExecutionHandler(
    typeof value === 'function' ? value : value.handler
  ),
  queueName: typeof value === 'function' ? 'plugin-operations' : value.queueName,
  executionLane: typeof value === 'function' ? 'default' : value.executionLane,
  supportsCancellation: typeof value === 'function' ? false : value.supportsCancellation,
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
        },
      ])
  );

export const createStudioJobTaskList = (
  getHandlers: () => StudioJobExecutionRegistry,
  taskIdentifier = studioJobTaskIdentifier
): graphileWorker.TaskList =>
  toStudioJobTaskList(async (payload, helpers) => {
    const { instanceId, jobId } = payload as StudioJobRunnerPayload;
    const lifecycleCorrelation = createPluginTenantLifecycleJobCorrelation({
      lifecycleRegistry: readInstanceRegistryPluginTenantLifecycleRegistry(),
      withRepository: withPluginTenantLifecycleRepository,
    });
    await createJobLifecycleOrchestrator({
      logger,
      loadRepository: async (tenantInstanceId) => {
        let loadedJob: StudioJobRecord | null = null;
        return {
          getJobById: (repositoryInstanceId, repositoryJobId) =>
            withStudioJobRepository(tenantInstanceId, async (repository) => {
              loadedJob = await repository.getJobById(repositoryInstanceId, repositoryJobId);
              return loadedJob;
            }),
          updateJobState: (input) => {
            const isTerminalLifecycleUpdate =
              (input.status === 'failed' || input.status === 'cancelled') &&
              loadedJob?.inputPayload[pluginTenantLifecycleJobInputKey] !== undefined;
            if (!isTerminalLifecycleUpdate || !loadedJob) {
              return withStudioJobRepository(tenantInstanceId, (repository) =>
                repository.updateJobState(input)
              );
            }
            const lifecycleJob = loadedJob;
            return withStudioJobLifecycleRepositories(
              tenantInstanceId,
              async ({ studioJobs, tenantLifecycle }) => {
                const transactionCorrelation = createPluginTenantLifecycleJobCorrelation({
                  lifecycleRegistry: readInstanceRegistryPluginTenantLifecycleRegistry(),
                  withRepository: async (_instanceId, work) => work(tenantLifecycle),
                });
                await transactionCorrelation.fail({
                  job: lifecycleJob,
                  error: input.errorPayload ?? {
                    code: 'plugin_operation_cancelled',
                    category: 'permanent',
                  },
                  reason: input.status === 'cancelled' ? 'cancelled' : 'failed',
                });
                return studioJobs.updateJobState(input);
              }
            );
          },
          updateJobProgress: (input) =>
            withStudioJobRepository(tenantInstanceId, (repository) =>
              repository.updateJobProgress(input)
            ),
          appendJobEvent: (input) =>
            withStudioJobRepository(tenantInstanceId, (repository) =>
              repository.appendJobEvent(input)
            ),
        };
      },
      resolveHandler: (job) => getHandlers().get(toRegistryKey(job.source, job.jobTypeId))?.handler,
      onExecutionSucceeded: lifecycleCorrelation.complete,
    }).run({
      instanceId,
      jobId,
      attempts: helpers.job.attempts,
      maxAttempts: helpers.job.max_attempts,
    });
  }, taskIdentifier);

export const createPluginOperationTaskList = (
  getHandlers: () => PluginOperationExecutionRegistry
): graphileWorker.TaskList =>
  createStudioJobTaskList(
    () =>
      new Map(
        [...getHandlers().entries()].map(([jobTypeId, registration]) => [
          toRegistryKey('plugin', jobTypeId),
          normalizePluginRegistration(jobTypeId, registration),
        ])
      )
  );
