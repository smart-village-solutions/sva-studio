import type { PluginDefinition } from '@sva/plugin-sdk';

import { pluginWasteManagement as descriptor } from './descriptor.js';
import { WasteManagementPage } from './waste-management.page.js';

export {
  wasteManagementAuditEventDefinitions,
  wasteManagementPermissionDefinitions,
  wasteManagementActionDefinitions,
} from './descriptor.js';

const routeComponents = {
  'waste-management.home': WasteManagementPage,
} as const;

if (descriptor.routes.length !== Object.keys(routeComponents).length) {
  throw new Error('waste_management_browser_route_binding_mismatch');
}

export const pluginWasteManagement: PluginDefinition = {
  ...descriptor,
  routes: descriptor.routes.map((route) => {
    const component = routeComponents[route.id as keyof typeof routeComponents];
    if (!component) throw new Error(`waste_management_browser_route_binding_missing:${route.id}`);
    return { ...route, component };
  }),
};
