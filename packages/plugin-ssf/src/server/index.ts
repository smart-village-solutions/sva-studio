import { SSF_RECORDING_DIRECTORY_SERVER_HANDLER_ID } from '../descriptor.js';
import type {
  PluginServerExecutionHandler,
  PluginServerHandlerModuleFactory,
} from '@sva/plugin-sdk';

import { SSF_RUNTIME_SERVER_HANDLER_ID, SSF_RUNTIME_V2_SERVER_HANDLER_ID } from '../constants.js';

import { resolveSsfDatabasePool, resolveSsfRootDatabasePool } from '../database.js';
import {
  createSsfRuntimeConfigurationHandler,
  type SsfRuntimeConfigurationHandler,
} from '../handler.js';
import { readSsfConfigurationOverrides } from '../repository.js';
import { SsfRuntimeConfigurationValidationError, type SsfMediaResolver } from '../resolver.js';
import {
  createDefaultSsfAdminV2Dependencies,
  createSsfAdminV2Handlers,
} from './content-v2-admin.js';
import {
  createSsfRuntimeV2ServerHandler,
  defaultSsfRuntimeV2Handler,
  type SsfRuntimeV2Handler,
  readResolvedSsfInstallationContentV2,
} from './content-v2.js';
import { jsonResponse, readCorrelationId, unavailableResponse } from './responses.js';

import { createSsfRecordingDirectoryHandler } from './recording-directory.js';
import type { SsfPluginServerCapabilities } from '../recording-directory.js';
export type { SsfPluginServerCapabilities } from '../recording-directory.js';

export { readResolvedSsfInstallationContentV2 };

export interface SsfPluginServerHandlerDependencies {
  readonly capabilities?: SsfPluginServerCapabilities;
  readonly runtimeHandler: SsfRuntimeConfigurationHandler;
  readonly runtimeV2Handler?: SsfRuntimeV2Handler;
}

export const createSsfPluginServerHandlers = (
  dependencies: SsfPluginServerHandlerDependencies
): ReturnType<PluginServerHandlerModuleFactory> => {
  const handler: PluginServerExecutionHandler = async (context) => {
    const correlationId = readCorrelationId(context.request);
    if (context.scope !== 'service') {
      return unavailableResponse(correlationId);
    }

    try {
      const configuration = await dependencies.runtimeHandler({
        tenant: {
          id: context.tenant.instanceId,
          displayName: context.tenant.displayName,
          timeZone: context.tenant.timeZone,
        },
        authorizationRevision: context.tenant.authorizationRevision,
      });
      return jsonResponse(200, configuration, correlationId);
    } catch {
      return unavailableResponse(correlationId);
    }
  };

  return {
    [SSF_RECORDING_DIRECTORY_SERVER_HANDLER_ID]: createSsfRecordingDirectoryHandler(
      dependencies.capabilities
    ),
    [SSF_RUNTIME_SERVER_HANDLER_ID]: handler,
    [SSF_RUNTIME_V2_SERVER_HANDLER_ID]: createSsfRuntimeV2ServerHandler(
      dependencies.runtimeV2Handler
    ),
  };
};

let defaultHandler: SsfRuntimeConfigurationHandler | undefined;

const unavailableMediaResolver: SsfMediaResolver = {
  resolve: async () => {
    throw new SsfRuntimeConfigurationValidationError(
      'The SSF host media capability is not configured.'
    );
  },
};

const getDefaultRuntimeHandler = (): SsfRuntimeConfigurationHandler => {
  if (defaultHandler) return defaultHandler;
  const pool = resolveSsfDatabasePool();
  if (!pool) {
    return async () => {
      throw new SsfRuntimeConfigurationValidationError('The SSF database is not configured.');
    };
  }
  defaultHandler = createSsfRuntimeConfigurationHandler({
    readOverrides: (instanceId) => readSsfConfigurationOverrides(pool, instanceId),
    mediaResolver: unavailableMediaResolver,
  });
  return defaultHandler;
};

export const createPluginServerHandlers = (
  capabilities?: SsfPluginServerCapabilities
): ReturnType<PluginServerHandlerModuleFactory> => {
  const runtimeHandlers = createSsfPluginServerHandlers({
    capabilities,
    runtimeHandler: (input) => getDefaultRuntimeHandler()(input),
    runtimeV2Handler: defaultSsfRuntimeV2Handler,
  });
  const pool = resolveSsfDatabasePool();
  const rootPool = resolveSsfRootDatabasePool();
  return {
    ...runtimeHandlers,
    ...createSsfAdminV2Handlers(createDefaultSsfAdminV2Dependencies(pool, rootPool)),
  };
};
