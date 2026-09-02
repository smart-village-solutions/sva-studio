import type {
  PluginServerExecutionHandler,
  PluginServerHandlerModuleFactory,
} from '@sva/plugin-sdk';

import {
  SSF_RUNTIME_CONTRACT_VERSION,
  SSF_RUNTIME_SERVER_HANDLER_ID,
  type SsfRuntimeErrorCode,
} from './constants.js';
import { createSsfDatabasePool, readSsfDatabaseConfig } from './database.js';
import {
  createSsfRuntimeConfigurationHandler,
  type SsfRuntimeConfigurationHandler,
} from './handler.js';
import { readSsfConfigurationOverrides } from './repository.js';
import { SsfRuntimeConfigurationValidationError, type SsfMediaResolver } from './resolver.js';

const CORRELATION_HEADER = 'X-Correlation-Id';

export interface SsfPluginServerHandlerDependencies {
  readonly runtimeHandler: SsfRuntimeConfigurationHandler;
}

const jsonResponse = (status: number, body: unknown, correlationId: string): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      [CORRELATION_HEADER]: correlationId,
    },
  });

const unavailableResponse = (correlationId: string): Response => {
  const code: SsfRuntimeErrorCode = 'runtime_configuration_unavailable';
  return jsonResponse(
    503,
    {
      contractVersion: SSF_RUNTIME_CONTRACT_VERSION,
      error: {
        code,
        message: 'Runtime configuration is unavailable.',
        retryable: true,
        correlationId,
      },
    },
    correlationId
  );
};

export const createSsfPluginServerHandlers = (
  dependencies: SsfPluginServerHandlerDependencies
): ReturnType<PluginServerHandlerModuleFactory> => {
  const handler: PluginServerExecutionHandler = async (context) => {
    const correlationId = context.request.headers.get(CORRELATION_HEADER) ?? 'unavailable';
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

  return { [SSF_RUNTIME_SERVER_HANDLER_ID]: handler };
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
  const databaseConfig = readSsfDatabaseConfig();
  if (!databaseConfig) {
    return async () => {
      throw new SsfRuntimeConfigurationValidationError('The SSF database is not configured.');
    };
  }
  const pool = createSsfDatabasePool(databaseConfig);
  defaultHandler = createSsfRuntimeConfigurationHandler({
    readOverrides: (instanceId) => readSsfConfigurationOverrides(pool, instanceId),
    mediaResolver: unavailableMediaResolver,
  });
  return defaultHandler;
};

export const createPluginServerHandlers: PluginServerHandlerModuleFactory = () =>
  createSsfPluginServerHandlers({
    runtimeHandler: (input) => getDefaultRuntimeHandler()(input),
  });
