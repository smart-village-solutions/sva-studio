import type { PluginJobExecutionHandler } from '@sva/plugin-sdk';
import {
  wasteManagementOperationsContract,
} from '@sva/plugin-sdk';
import { createWasteRuntimeOperationHandlers } from './runtime-handler-helpers.js';
export type { WasteManagementOperationRuntime } from './runtime-types.js';

export const createWasteManagementPluginOperationExecutionHandlers = (
  runtime: import('./runtime-types.js').WasteManagementOperationRuntime
): Readonly<Record<string, PluginJobExecutionHandler>> =>
  createWasteRuntimeOperationHandlers(runtime);

export const createPluginJobExecutionHandlers = createWasteManagementPluginOperationExecutionHandlers;
