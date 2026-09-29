import type { PluginJobExecutionHandler } from '@sva/plugin-sdk';
import { createWasteManagementHandlers } from './server-handlers.js';
import { createWasteServerContext } from './server-context.js';
import { createWasteJobStarter } from './server-job-start.js';
import { createWasteServerLoaders } from './server-loaders.js';
import { createWasteRuntimeOperationHandlers } from './runtime-handler-helpers.js';
export {
  wasteManagementMasterDataSchemas,
  wasteManagementSettingsSchemas,
  wasteManagementTourSchemas,
} from './http-schemas.js';
export { wasteManagementOperationSchemas } from './http-operation-schemas.js';
export { wasteManagementCoreHandlers } from './handlers.js';
export const wasteManagementHttpRuntime = {
  createWasteManagementHandlers,
  createWasteServerContext,
  createWasteJobStarter,
  createWasteServerLoaders,
} as const;
export type { SaveWasteCustomRecurrencePresetsInput } from './handlers/custom-recurrence-deps.js';
export type { WasteManagementOperationRuntime } from './runtime-types.js';

export const createWasteManagementPluginOperationExecutionHandlers = (
  runtime: import('./runtime-types.js').WasteManagementOperationRuntime
): Readonly<Record<string, PluginJobExecutionHandler>> =>
  createWasteRuntimeOperationHandlers(runtime);

export const createPluginJobExecutionHandlers =
  createWasteManagementPluginOperationExecutionHandlers;
