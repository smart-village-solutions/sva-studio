import { wasteManagementHttpRuntime } from '@sva/waste-management-runtime/server';
import type { PluginServerHandlerModuleFactory } from '@sva/plugin-sdk';

import {
  sharedWasteManagementDeps,
  withAuthenticatedWasteManagementHandler,
} from './server-context.js';
import {
  wasteManagementEntityLoaders,
  wasteManagementEntitySavers,
  wasteManagementOverviewLoaders,
  wasteManagementServerLoaderInternals,
} from './server-loaders.js';
import { wasteManagementServerRoutes } from './server-routes.js';

const wasteManagementHandlers = wasteManagementHttpRuntime.createWasteManagementHandlers({
  host: sharedWasteManagementDeps,
  withAuthenticatedHandler: withAuthenticatedWasteManagementHandler,
  loaders: {
    wasteManagementEntityLoaders,
    wasteManagementEntitySavers,
    wasteManagementOverviewLoaders,
    wasteManagementServerLoaderInternals,
  },
});

export const createPluginServerHandlers: PluginServerHandlerModuleFactory = () =>
  Object.fromEntries(
    wasteManagementServerRoutes.map(([, method, handlerName]) => [
      `waste-management.${handlerName}.${method.toLowerCase()}`,
      ({ request }: { request: Request }) => wasteManagementHandlers[handlerName](request),
    ])
  );
