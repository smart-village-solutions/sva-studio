import { registerPluginOperationExecutionHandlers } from '@sva/auth-runtime/server';
import { pluginEvents } from '@sva/plugin-events';
import { pluginNews } from '@sva/plugin-news';
import { pluginPoi } from '@sva/plugin-poi';
import { createBuildTimeRegistry, type PluginJobTypeDefinition } from '@sva/plugin-sdk';

const studioPluginOperationRegistry = createBuildTimeRegistry({
  plugins: [pluginNews, pluginEvents, pluginPoi],
});

type PluginOperationExecutionHandler = import('@sva/auth-runtime/server').PluginOperationExecutionHandler;

export const createStudioPluginOperationExecutionHandlers = (): Readonly<
  Record<string, PluginOperationExecutionHandler>
> => ({});

const collectDeclaredJobTypeIds = (
  jobTypes: readonly PluginJobTypeDefinition[]
): readonly string[] => jobTypes.map((jobType) => jobType.jobTypeId).sort();

const collectRegisteredHandlerIds = (
  handlers: Readonly<Record<string, PluginOperationExecutionHandler>>
): readonly string[] => Object.keys(handlers).sort();

export const assertPluginOperationExecutionHandlerCoverage = (input: {
  readonly declaredJobTypeIds: readonly string[];
  readonly handlers: Readonly<Record<string, PluginOperationExecutionHandler>>;
}): void => {
  const declaredJobTypeIds = [...input.declaredJobTypeIds].sort();
  const registeredHandlerIds = collectRegisteredHandlerIds(input.handlers);

  const missingHandlerIds = declaredJobTypeIds.filter((jobTypeId) => !registeredHandlerIds.includes(jobTypeId));
  if (missingHandlerIds.length > 0) {
    throw new Error(`missing_plugin_operation_handlers:${missingHandlerIds.join(',')}`);
  }

  const unknownHandlerIds = registeredHandlerIds.filter((jobTypeId) => !declaredJobTypeIds.includes(jobTypeId));
  if (unknownHandlerIds.length > 0) {
    throw new Error(`unknown_plugin_operation_handlers:${unknownHandlerIds.join(',')}`);
  }
};

export const assertStudioPluginOperationHandlerCoverage = (
  handlers: Readonly<Record<string, PluginOperationExecutionHandler>>
): void => {
  assertPluginOperationExecutionHandlerCoverage({
    declaredJobTypeIds: collectDeclaredJobTypeIds(studioPluginOperationRegistry.jobTypes),
    handlers,
  });
};

export const registerStudioPluginOperationHandlers = (): Readonly<
  Record<string, PluginOperationExecutionHandler>
> => {
  const handlers = createStudioPluginOperationExecutionHandlers();
  assertStudioPluginOperationHandlerCoverage(handlers);
  registerPluginOperationExecutionHandlers(handlers);
  return handlers;
};
