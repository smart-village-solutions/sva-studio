import type { PluginDefinition } from '@sva/plugin-sdk';

import {
  SsfSystemConfigurationPage,
  SsfSystemDefaultsPage,
  SsfSystemContentPage,
  SsfTenantConfigurationPage,
  SsfTenantAppearancePage,
  SsfTenantLanguagesPage,
  SsfTenantRecordingsPage,
  SsfTenantFeedbackPage,
} from './admin.page.js';
import { ssfPlugin as descriptor } from './descriptor.js';

export { SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID } from './descriptor.js';

const routeComponents = {
  'ssf-system-overview': SsfSystemConfigurationPage,
  'ssf-system-default-configuration': SsfSystemDefaultsPage,
  'ssf-system-default-content': SsfSystemContentPage,
  'ssf-tenant-overview': SsfTenantConfigurationPage,
  'ssf-tenant-appearance': SsfTenantAppearancePage,
  'ssf-tenant-languages': SsfTenantLanguagesPage,
  'ssf-tenant-recordings': SsfTenantRecordingsPage,
  'ssf-tenant-feedback': SsfTenantFeedbackPage,
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
