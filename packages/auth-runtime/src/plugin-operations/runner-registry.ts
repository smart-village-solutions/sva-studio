import * as graphileWorker from 'graphile-worker';

import type { StudioJobRecord } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import { readInstanceRegistryPluginTenantLifecycleRegistry } from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
import { scheduleConfiguredPluginTenantProvisioning } from '../iam-instance-registry/repository.js';
import {
  createPluginTenantLifecycleJobCorrelation,
  pluginTenantLifecycleJobInputKey,
  readPluginTenantLifecycleJobMetadata,
} from '../plugin-tenant-lifecycle/job-correlation.js';
import {
  isConfiguredPluginTenantEffectivelyActive,
  isConfiguredPluginTenantLifecycleJobType,
  readConfiguredPluginTenantAccess,
} from '../plugin-tenant-lifecycle/access.js';
import { createJobLifecycleOrchestrator } from './job-lifecycle-orchestrator.js';
import {
  withPluginTenantLifecycleRepository,
  withStudioJobLifecycleRepositories,
  withStudioJobRepository,
} from './repository.js';
import type { PluginOperationExecutionHandler, PluginOperationExecutionResult } from './types.js';
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

const guardPluginTenantExecution = (
  job: StudioJobRecord,
  handler: StudioJobExecutionRegistration['handler']
): StudioJobExecutionRegistration['handler'] => {
  const pluginId = job.pluginId;
  if (job.source !== 'plugin' || !pluginId) {
    return handler;
  }
  const lifecycleJob = isConfiguredPluginTenantLifecycleJobType(pluginId, job.jobTypeId);
  return async (context) => {
    if (lifecycleJob) {
      const effectivelyActive = await isConfiguredPluginTenantEffectivelyActive(
        job.instanceId,
        pluginId
      );
      if (!effectivelyActive) {
        throw Object.assign(new Error(`plugin_tenant_lifecycle_inactive:${pluginId}`), {
          cause: {
            category: 'permanent',
            code: 'plugin_tenant_lifecycle_inactive',
          },
        });
      }
      const metadata = readPluginTenantLifecycleJobMetadata(job);
      const lifecycle = await withPluginTenantLifecycleRepository(job.instanceId, (repository) =>
        repository.getLifecycle(job.instanceId, pluginId)
      );
      if (
        !metadata ||
        lifecycle?.activeJobId !== job.id ||
        lifecycle.claimedGeneration !== metadata.generation ||
        lifecycle.desiredOperation !== metadata.operation
      ) {
        throw Object.assign(
          new Error(`plugin_tenant_lifecycle_claim_stale:${pluginId}:${job.id}`),
          {
            cause: {
              category: 'permanent',
              code: 'plugin_tenant_lifecycle_claim_stale',
            },
          }
        );
      }
      return handler(context);
    }
    const access = await readConfiguredPluginTenantAccess(job.instanceId, pluginId);
    if (!access.allowed) {
      throw Object.assign(new Error(`plugin_tenant_access_blocked:${pluginId}:${access.reason}`), {
        cause: {
          category: 'permanent',
          code: 'plugin_tenant_access_blocked',
          reason: access.reason,
        },
      });
    }
    return handler(context);
  };
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
    let successfulResult: PluginOperationExecutionResult | void;
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
          updateJobState: async (input) => {
            const isLifecycleCompletion =
              (input.status === 'succeeded' ||
                input.status === 'failed' ||
                input.status === 'cancelled') &&
              loadedJob?.inputPayload[pluginTenantLifecycleJobInputKey] !== undefined;
            if (!isLifecycleCompletion || !loadedJob) {
              return withStudioJobRepository(tenantInstanceId, (repository) =>
                repository.updateJobState(input)
              );
            }
            const lifecycleJob = loadedJob;
            const updatedJob = await withStudioJobLifecycleRepositories(
              tenantInstanceId,
              async ({ studioJobs, tenantLifecycle }) => {
                const transactionCorrelation = createPluginTenantLifecycleJobCorrelation({
                  lifecycleRegistry: readInstanceRegistryPluginTenantLifecycleRegistry(),
                  withRepository: async (_instanceId, work) => work(tenantLifecycle),
                });
                if (input.status === 'succeeded') {
                  await transactionCorrelation.complete({
                    job: lifecycleJob,
                    result: successfulResult,
                  });
                } else {
                  await transactionCorrelation.fail({
                    job: lifecycleJob,
                    error: input.errorPayload ?? {
                      code: 'plugin_operation_cancelled',
                      category: 'permanent',
                    },
                    reason: input.status === 'cancelled' ? 'cancelled' : 'failed',
                  });
                }
                return studioJobs.updateJobState(input);
              }
            );
            if (input.status !== 'succeeded') {
              scheduleConfiguredPluginTenantProvisioning(tenantInstanceId);
            }
            return updatedJob;
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
      resolveHandler: (job) => {
        const handler = getHandlers().get(toRegistryKey(job.source, job.jobTypeId))?.handler;
        return handler ? guardPluginTenantExecution(job, handler) : undefined;
      },
      onExecutionSucceeded: async ({ result }) => {
        successfulResult = result;
      },
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
