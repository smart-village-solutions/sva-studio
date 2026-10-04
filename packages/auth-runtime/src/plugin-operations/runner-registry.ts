import * as graphileWorker from 'graphile-worker';

import { createSdkLogger } from '@sva/server-runtime';

import { runConfiguredPluginTenantProvisioningSchedule } from '../iam-instance-registry/repository.js';
import { createJobLifecycleOrchestrator } from './job-lifecycle-orchestrator.js';
import { loadStudioJobExecutionRepository } from './runner-repository.js';
import { guardPluginTenantExecution } from './runner-tenant-guard.js';
import type { PluginOperationExecutionHandler, PluginOperationExecutionResult } from './types.js';
import type {
  PluginOperationExecutionRegistration,
  PluginOperationExecutionRegistry,
  StudioJobExecutionRegistration,
  StudioJobExecutionRegistry,
  StudioJobRunnerPayload,
} from './runner-internal.js';
import { isConfiguredLifecycleJob } from './runner-lifecycle.js';

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

export const pluginOperationTaskIdentifier = studioJobTaskIdentifier;

let registeredStudioJobHandlers = new Map<string, StudioJobExecutionRegistration>();

const normalizePluginRegistration = (
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
): graphileWorker.TaskList => ({
  ...toStudioJobTaskList(async (payload, helpers) => {
    const { instanceId, jobId } = payload as StudioJobRunnerPayload;
    let successfulResult: PluginOperationExecutionResult | void;
    await createJobLifecycleOrchestrator({
      logger,
      loadRepository: (tenantInstanceId) =>
        loadStudioJobExecutionRepository(tenantInstanceId, () => successfulResult),
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
