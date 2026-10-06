import type { PluginDefinition } from '@sva/plugin-sdk';

import { SsfSystemConfigurationPage, SsfTenantConfigurationPage } from './admin.page.js';
import { ssfPlugin as descriptor } from './descriptor.js';

export { SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID } from './descriptor.js';

const routeComponents = {
  'ssf-system-configuration': SsfSystemConfigurationPage,
  'ssf-tenant-configuration': SsfTenantConfigurationPage,
} as const;

if (descriptor.routes.length !== Object.keys(routeComponents).length) {
  throw new Error('ssf_browser_route_binding_mismatch');
}

export const ssfPlugin: PluginDefinition = {
  ...descriptor,
  routes: descriptor.routes.map((route) => {
    const component = routeComponents[route.id];
    if (!component) throw new Error(`ssf_browser_route_binding_missing:${route.id}`);
    return { ...route, component };
  }),
};
