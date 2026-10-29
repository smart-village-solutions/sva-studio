import * as graphileWorker from 'graphile-worker';

import { createSdkLogger } from '@sva/server-runtime';

import { runConfiguredPluginTenantProvisioningSchedule } from '../iam-instance-registry/repository.js';
import { createJobLifecycleOrchestrator } from './job-lifecycle-orchestrator.js';
import { loadStudioJobExecutionRepository } from './runner-repository.js';
import { guardPluginTenantExecution } from './runner-tenant-guard.js';
import type { PluginOperationExecutionResult } from './types.js';
import type {
  PluginOperationExecutionRegistry,
  StudioJobExecutionRegistry,
  StudioJobRunnerPayload,
} from './runner-internal.js';

export {
  registerStudioJobExecutionHandlers,
  registerPluginOperationExecutionHandlers,
  getRegisteredStudioJobExecutionRegistry,
  getRegisteredPluginOperationExecutionRegistry,
  pluginTenantLifecycleRetryTaskIdentifier,
  privilegedStudioJobTaskIdentifier,
  studioJobTaskIdentifier,
} from './runner-internal.js';
import {
  normalizePluginRegistration,
  pluginTenantLifecycleRetryTaskIdentifier,
  studioJobTaskIdentifier,
  toRegistryKey,
  toStudioJobTaskList,
} from './runner-internal.js';

const logger = createSdkLogger({ component: 'studio-jobs-runner', level: 'info' });

export const pluginOperationTaskIdentifier = studioJobTaskIdentifier;

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
