import {
  dsrExportStudioJobRegistration,
  mediaContentSaveRecoveryStudioJobRegistration,
  registerPluginOperationExecutionHandlers,
  registerStudioJobExecutionHandlers,
  type PluginOperationExecutionRegistration,
} from '@sva/auth-runtime/server';
import { createPluginJobExecutionHandlers } from '../../../../packages/plugin-ssf/src/server.js';

import { createStudioSsfAuthorizationProjectionRuntime } from './ssf-authorization-projection-runtime.server.js';
import { studioServerPluginSnapshot } from './plugin-catalog.server.js';

export const registerStudioPluginOperationHandlers = async (): Promise<
  Readonly<Record<string, PluginOperationExecutionRegistration>>
> => {
  const declaredJobTypeIds = new Set(
    studioServerPluginSnapshot.registry.jobTypes.map(({ jobTypeId }) => jobTypeId)
  );
  const handlers = Object.fromEntries(
    Object.entries(
      createPluginJobExecutionHandlers(createStudioSsfAuthorizationProjectionRuntime())
    )
      .filter(([jobTypeId]) => declaredJobTypeIds.has(jobTypeId))
      .map(([jobTypeId, handler]) => [
        jobTypeId,
        {
          handler,
          queueName: 'plugin-operations',
          executionLane: 'default',
          supportsCancellation: false,
        },
      ])
  ) satisfies Readonly<Record<string, PluginOperationExecutionRegistration>>;
  registerStudioJobExecutionHandlers([
    dsrExportStudioJobRegistration,
    mediaContentSaveRecoveryStudioJobRegistration,
  ]);
  registerPluginOperationExecutionHandlers(handlers);
  return handlers;
};
