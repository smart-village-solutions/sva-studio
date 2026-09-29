import { pluginServerHost as host } from '@sva/auth-runtime/plugin-server-host';
import { wasteManagementHttpRuntime } from '@sva/waste-management-runtime/server';

const startPluginOperationJobFromFacade = wasteManagementHttpRuntime.createWasteJobStarter(host);

export const { withAuthenticatedWasteManagementHandler, sharedWasteManagementDeps } =
  wasteManagementHttpRuntime.createWasteServerContext({
    ...host,
    resolveIamActorInfo: host.resolveActorInfo,
    startPluginOperationJobFromFacade,
  });
