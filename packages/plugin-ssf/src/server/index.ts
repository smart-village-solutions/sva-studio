import type {
  PluginServerExecutionHandler,
  PluginServerHandlerModuleFactory,
} from '@sva/plugin-sdk';

import {
  SSF_RUNTIME_SERVER_HANDLER_ID,
  SSF_RUNTIME_V2_SERVER_HANDLER_ID,
} from '../constants.js';
import {
  ssfSystemConfigurationInputSchema,
  ssfTenantConfigurationInputSchema,
} from '../admin-contracts.js';
import {
  readSsfSystemOverrides,
  replaceSsfSystemConfiguration,
  replaceSsfTenantConfiguration,
  SsfSystemLocaleInUseError,
  SsfTenantDefaultLocaleUnavailableError,
} from '../admin-repository.js';
import {
  createSsfSystemConfigurationView,
  createSsfTenantConfigurationView,
} from '../admin-service.js';
import { resolveSsfDatabasePool, resolveSsfRootDatabasePool } from '../database.js';
import {
  createSsfRuntimeConfigurationHandler,
  type SsfRuntimeConfigurationHandler,
} from '../handler.js';
import { readSsfConfigurationOverrides } from '../repository.js';
import type { SsfConfigurationOverrides } from '../repository.js';
import { SsfRuntimeConfigurationValidationError, type SsfMediaResolver } from '../resolver.js';
import { createDefaultSsfAdminV2Dependencies, createSsfAdminV2Handlers, type SsfAdminV2Dependencies } from './content-v2-admin.js';
import { createSsfRuntimeV2ServerHandler, defaultSsfRuntimeV2Handler, type SsfRuntimeV2Handler, readResolvedSsfInstallationContentV2 } from './content-v2.js';
import { jsonResponse, readCorrelationId, unavailableResponse } from './responses.js';

export { readResolvedSsfInstallationContentV2 };

export interface SsfPluginServerHandlerDependencies {
  readonly runtimeHandler: SsfRuntimeConfigurationHandler;
  readonly runtimeV2Handler?: SsfRuntimeV2Handler;
}

export interface SsfAdminServerHandlerDependencies extends SsfAdminV2Dependencies {
  readonly readSystem: () => Promise<
    Pick<SsfConfigurationOverrides, 'serverSettings' | 'serverLocales'>
  >;
  readonly writeSystem: (
    input: Parameters<typeof replaceSsfSystemConfiguration>[1]
  ) => Promise<void>;
  readonly readTenant: (instanceId: string) => Promise<SsfConfigurationOverrides>;
  readonly writeTenant: (
    instanceId: string,
    input: Parameters<typeof replaceSsfTenantConfiguration>[2]
  ) => Promise<void>;
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
    [SSF_RUNTIME_SERVER_HANDLER_ID]: handler,
    [SSF_RUNTIME_V2_SERVER_HANDLER_ID]: createSsfRuntimeV2ServerHandler(dependencies.runtimeV2Handler),
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

export const createSsfAdminServerHandlers = (
  dependencies: SsfAdminServerHandlerDependencies
): ReturnType<PluginServerHandlerModuleFactory> => ({
  ...createSsfAdminV2Handlers(dependencies),
  'ssf.system-configuration.read': async (context) => {
    const correlationId = readCorrelationId(context.request);
    if (context.scope !== 'platform')
      return jsonResponse(403, { error: 'forbidden' }, correlationId);
    try {
      return jsonResponse(
        200,
        createSsfSystemConfigurationView(await dependencies.readSystem()),
        correlationId
      );
    } catch {
      return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
    }
  },
  'ssf.system-configuration.write': async (context) => {
    const correlationId = readCorrelationId(context.request);
    if (context.scope !== 'platform')
      return jsonResponse(403, { error: 'forbidden' }, correlationId);
    const parsed = ssfSystemConfigurationInputSchema.safeParse(
      await context.request.json().catch(() => null)
    );
    if (!parsed.success)
      return jsonResponse(422, { error: 'invalid_configuration' }, correlationId);
    try {
      await dependencies.writeSystem(parsed.data);
      return jsonResponse(
        200,
        createSsfSystemConfigurationView(await dependencies.readSystem()),
        correlationId
      );
    } catch (error) {
      return error instanceof SsfSystemLocaleInUseError
        ? jsonResponse(409, { error: 'locale_in_use' }, correlationId)
        : jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
    }
  },
  'ssf.tenant-configuration.read': async (context) => {
    const correlationId = readCorrelationId(context.request);
    if (context.scope !== 'tenant' || !context.actor.instanceId)
      return jsonResponse(403, { error: 'forbidden' }, correlationId);
    try {
      return jsonResponse(
        200,
        createSsfTenantConfigurationView(await dependencies.readTenant(context.actor.instanceId)),
        correlationId
      );
    } catch {
      return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
    }
  },
  'ssf.tenant-configuration.write': async (context) => {
    const correlationId = readCorrelationId(context.request);
    if (context.scope !== 'tenant' || !context.actor.instanceId)
      return jsonResponse(403, { error: 'forbidden' }, correlationId);
    const parsed = ssfTenantConfigurationInputSchema.safeParse(
      await context.request.json().catch(() => null)
    );
    if (!parsed.success)
      return jsonResponse(422, { error: 'invalid_configuration' }, correlationId);
    try {
      await dependencies.writeTenant(context.actor.instanceId, parsed.data);
      return jsonResponse(
        200,
        createSsfTenantConfigurationView(await dependencies.readTenant(context.actor.instanceId)),
        correlationId
      );
    } catch (error) {
      return error instanceof SsfTenantDefaultLocaleUnavailableError
        ? jsonResponse(422, { error: 'invalid_configuration' }, correlationId)
        : jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
    }
  },
});

export const createPluginServerHandlers: PluginServerHandlerModuleFactory = () => {
  const runtimeHandlers = createSsfPluginServerHandlers({
    runtimeHandler: (input) => getDefaultRuntimeHandler()(input),
    runtimeV2Handler: defaultSsfRuntimeV2Handler,
  });
  const pool = resolveSsfDatabasePool();
  const rootPool = resolveSsfRootDatabasePool();
  const databaseUnavailable = async (): Promise<never> => {
    throw new Error('ssf_database_unavailable');
  };
  return {
    ...runtimeHandlers,
    ...createSsfAdminServerHandlers({
      readSystem: pool ? () => readSsfSystemOverrides(pool) : databaseUnavailable,
      writeSystem: rootPool
        ? (input) => replaceSsfSystemConfiguration(rootPool, input)
        : databaseUnavailable,
      readTenant: pool
        ? (instanceId) => readSsfConfigurationOverrides(pool, instanceId)
        : databaseUnavailable,
      writeTenant: pool
        ? (instanceId, input) => replaceSsfTenantConfiguration(pool, instanceId, input)
        : databaseUnavailable,
      ...createDefaultSsfAdminV2Dependencies(pool, rootPool),
    }),
  };
};
