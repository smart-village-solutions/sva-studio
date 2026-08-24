import { mergeAdminResourceDefinitions, type AdminResourceDefinition, type PluginDefinition } from '@sva/plugin-sdk';

import type { AppRouteBindings } from './app-route-bindings.js';
import { collectAdminResourceRouteDocumentationPages } from './admin-resource-routes.js';
import { collectUiRouteDocumentationPages } from './app.routes.shared.js';
import { collectPluginRouteDocumentationPages } from './plugin.routes.js';
import {
  createDocumentationPageCatalog,
  type DocumentationPageCatalog,
} from './route-documentation.js';

export const collectDocumentationPageCatalog = (input: {
  readonly bindings: AppRouteBindings;
  readonly adminResources?: readonly AdminResourceDefinition[];
  readonly plugins?: readonly PluginDefinition[];
}): DocumentationPageCatalog => {
  const adminResources = mergeAdminResourceDefinitions(input.adminResources ?? []);
  return createDocumentationPageCatalog([
    ...collectUiRouteDocumentationPages(adminResources),
    ...collectAdminResourceRouteDocumentationPages(input.bindings, adminResources),
    ...collectPluginRouteDocumentationPages(input.plugins),
  ]);
};
