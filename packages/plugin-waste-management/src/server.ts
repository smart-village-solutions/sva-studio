import { wasteManagementHandlers } from '@sva/auth-runtime/waste-host';
import type { PluginServerHandlerModuleFactory } from '@sva/plugin-sdk';

import { wasteManagementServerRoutes } from './server-routes.js';

export const createPluginServerHandlers: PluginServerHandlerModuleFactory = () =>
  Object.fromEntries(
    wasteManagementServerRoutes.map(([, method, handlerName]) => [
      `waste-management.${handlerName}.${method.toLowerCase()}`,
      ({ request }: { request: Request }) => wasteManagementHandlers[handlerName](request),
    ])
  );
