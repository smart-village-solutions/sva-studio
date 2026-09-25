import {
  dsrExportStudioJobRegistration,
  mediaContentSaveRecoveryStudioJobRegistration,
  registerPluginOperationExecutionHandlers,
  registerStudioJobExecutionHandlers,
  type PluginOperationExecutionRegistration,
} from '@sva/auth-runtime/server';
import { createPluginJobExecutionHandlers } from '../../../../packages/plugin-ssf/src/server.js';

import { createStudioSsfAuthorizationProjectionRuntime } from './ssf-authorization-projection-runtime.server.js';

export const registerStudioPluginOperationHandlers = async (): Promise<
  Readonly<Record<string, PluginOperationExecutionRegistration>>
> => {
  const handlers = Object.fromEntries(
    Object.entries(
      createPluginJobExecutionHandlers(createStudioSsfAuthorizationProjectionRuntime())
    ).map(([jobTypeId, handler]) => [
      jobTypeId,
      { handler, queueName: 'plugin-operations', executionLane: 'default', supportsCancellation: false },
    ])
  ) satisfies Readonly<Record<string, PluginOperationExecutionRegistration>>;
  registerStudioJobExecutionHandlers([
    dsrExportStudioJobRegistration,
    mediaContentSaveRecoveryStudioJobRegistration,
  ]);
  registerPluginOperationExecutionHandlers(handlers);
  return handlers;
};
