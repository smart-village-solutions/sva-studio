import * as graphileWorker from 'graphile-worker';

import type { StudioJobRecord } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import { readInstanceRegistryPluginTenantLifecycleRegistry } from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
import {
  runConfiguredPluginTenantProvisioningSchedule,
  scheduleConfiguredPluginTenantProvisioning,
} from '../iam-instance-registry/repository.js';
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

export {
  pluginTenantLifecycleRetryTaskIdentifier,
  privilegedStudioJobTaskIdentifier,
  studioJobTaskIdentifier,
} from './runner-internal.js';
import {
  adaptPluginOperationExecutionHandler,
  pluginTenantLifecycleRetryTaskIdentifier,
  studioJobTaskIdentifier,
  toRegistryKey,
  toStudioJobTaskList,
} from './runner-internal.js';

const logger = createSdkLogger({ component: 'studio-jobs-runner', level: 'info' });

const enqueueFutureLifecycleRetry = async (input: {
  readonly instanceId: string;
  readonly lifecycle?: { readonly retryKind?: string; readonly retryAfter?: string } | null;
  readonly enqueue: (input: {
    readonly instanceId: string;
    readonly runAt: Date;
  }) => Promise<unknown>;
}): Promise<boolean> => {
  const retryAfter =
    input.lifecycle?.retryKind === 'retryable' ? input.lifecycle.retryAfter : undefined;
  if (!retryAfter || Date.parse(retryAfter) <= Date.now()) return false;
  await input.enqueue({ instanceId: input.instanceId, runAt: new Date(retryAfter) });
  return true;
};

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
  const lifecycleMetadata = readPluginTenantLifecycleJobMetadata(job);
  const lifecycleJob =
    lifecycleMetadata !== null && isConfiguredPluginTenantLifecycleJobType(pluginId, job.jobTypeId);
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
      const lifecycle = await withPluginTenantLifecycleRepository(job.instanceId, (repository) =>
        repository.getLifecycle(job.instanceId, pluginId)
      );
      if (
        lifecycle?.activeJobId !== job.id ||
        lifecycle.claimedGeneration !== lifecycleMetadata.generation ||
        lifecycle.desiredOperation !== lifecycleMetadata.operation
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
): graphileWorker.TaskList => ({
  ...toStudioJobTaskList(async (payload, helpers) => {
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
            let lifecycleRetryEnqueued = false;
            const updatedJob = await withStudioJobLifecycleRepositories(
              tenantInstanceId,
              async ({ studioJobs, tenantLifecycle, enqueuePluginTenantLifecycleRetry }) => {
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
                  const failedLifecycle = await transactionCorrelation.fail({
                    job: lifecycleJob,
                    error: input.errorPayload ?? {
                      code: 'plugin_operation_cancelled',
                      category: 'permanent',
                    },
                    reason: input.status === 'cancelled' ? 'cancelled' : 'failed',
                  });
                  lifecycleRetryEnqueued = await enqueueFutureLifecycleRetry({
                    instanceId: tenantInstanceId,
                    lifecycle: failedLifecycle,
                    enqueue: enqueuePluginTenantLifecycleRetry,
                  });
                }
                return studioJobs.updateJobState(input);
              }
            );
            if (input.status !== 'succeeded' && !lifecycleRetryEnqueued) {
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
  }, taskIdentifier),
  [pluginTenantLifecycleRetryTaskIdentifier]: async (payload) => {
    const instanceId = (payload as { readonly instanceId?: unknown }).instanceId;
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      throw new Error('plugin_tenant_lifecycle_retry_payload_invalid');
    }
    await runConfiguredPluginTenantProvisioningSchedule(instanceId);
  },
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
