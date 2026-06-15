import * as graphileWorker from 'graphile-worker';

import { createSdkLogger } from '@sva/server-runtime';

import { createJobLifecycleOrchestrator } from './job-lifecycle-orchestrator.js';
import { withStudioJobRepository } from './repository.js';
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
});

const replaceRegistrationsBySource = (
  nextSource: StudioJobExecutionRegistration['source'],
  nextRegistrations: readonly StudioJobExecutionRegistration[]
): void => {
  const preservedEntries = [...registeredStudioJobHandlers.values()].filter((entry) => entry.source !== nextSource);
  registeredStudioJobHandlers = new Map(
    [...preservedEntries, ...nextRegistrations].map((entry) => [toRegistryKey(entry.source, entry.jobTypeId), entry])
  );
};

export const registerStudioJobExecutionHandlers = (handlers: readonly StudioJobExecutionRegistration[]): void => {
  replaceRegistrationsBySource(
    'host',
    handlers.filter((entry) => entry.source === 'host')
  );
};

export const registerPluginOperationExecutionHandlers = (
  handlers: Readonly<Record<string, PluginOperationExecutionHandler | PluginOperationExecutionRegistration>>
): void => {
  replaceRegistrationsBySource(
    'plugin',
    Object.entries(handlers).map(([jobTypeId, value]) => normalizePluginRegistration(jobTypeId, value))
  );
};

export const getRegisteredStudioJobExecutionRegistry = (): StudioJobExecutionRegistry => registeredStudioJobHandlers;

export const getRegisteredPluginOperationExecutionRegistry = (): PluginOperationExecutionRegistry =>
  new Map(
    [...registeredStudioJobHandlers.values()]
      .filter((entry): entry is StudioJobExecutionRegistration & { source: 'plugin' } => entry.source === 'plugin')
      .map((entry) => [
        entry.jobTypeId,
        {
          handler: entry.handler as PluginOperationExecutionHandler,
          queueName: entry.queueName,
        },
      ])
  );

export const createStudioJobTaskList = (
  getHandlers: () => StudioJobExecutionRegistry
): graphileWorker.TaskList =>
  toStudioJobTaskList(async (payload, helpers) => {
    const { instanceId, jobId } = payload as StudioJobRunnerPayload;
    await createJobLifecycleOrchestrator({
      logger,
      loadRepository: async (tenantInstanceId) => ({
        getJobById: (repositoryInstanceId, repositoryJobId) =>
          withStudioJobRepository(tenantInstanceId, (repository) =>
            repository.getJobById(repositoryInstanceId, repositoryJobId)
          ),
        updateJobState: (input) =>
          withStudioJobRepository(tenantInstanceId, (repository) => repository.updateJobState(input)),
        updateJobProgress: (input) =>
          withStudioJobRepository(tenantInstanceId, (repository) => repository.updateJobProgress(input)),
        appendJobEvent: (input) =>
          withStudioJobRepository(tenantInstanceId, (repository) => repository.appendJobEvent(input)),
      }),
      resolveHandler: (job) => getHandlers().get(toRegistryKey(job.source, job.jobTypeId))?.handler,
    }).run({
      instanceId,
      jobId,
      attempts: helpers.job.attempts,
      maxAttempts: helpers.job.max_attempts,
    });
  });

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
