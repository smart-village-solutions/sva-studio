import { wasteManagementHttpRuntime } from '@sva/waste-management-runtime/server';
import type {
  WasteJobHost,
  WasteServerContextHost,
  WasteServerLoaderHost,
} from '@sva/waste-management-runtime/server';

export type WastePluginServerCapabilities = Omit<WasteServerContextHost, 'startPluginOperationJobFromFacade'> & WasteServerLoaderHost & WasteJobHost;

export const createWastePluginServerDependencies = (
  capabilities: WastePluginServerCapabilities
) => {
  if (!capabilities) throw new Error('waste_plugin_server_capabilities_required');
  const startPluginOperationJobFromFacade = wasteManagementHttpRuntime.createWasteJobStarter(capabilities);
  const context = wasteManagementHttpRuntime.createWasteServerContext({
    ...capabilities,
    resolveIamActorInfo: capabilities.resolveIamActorInfo,
    startPluginOperationJobFromFacade,
  });
  const loaders = wasteManagementHttpRuntime.createWasteServerLoaders(capabilities);
  return { ...context, loaders };
};
