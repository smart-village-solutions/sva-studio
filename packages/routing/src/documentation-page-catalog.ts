import {
  mergeAdminResourceDefinitions,
  mergePluginAdminResourceDefinitions,
  type AdminResourceDefinition,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import type { AppRouteBindings } from './app-route-bindings.js';
import { collectAdminResourceRouteDocumentationPages } from './admin-resource-routes.js';
import { collectUiRouteDocumentationPages } from './app.routes.shared.js';
import { collectPluginRouteDocumentationPages } from './plugin.routes.js';
import {
  createDocumentationPageCatalog,
  type DocumentationPageCatalog,
  type DocumentationPageCatalogOwner,
} from './route-documentation.js';

export const collectDocumentationPageCatalog = (input: {
  readonly bindings: AppRouteBindings;
  readonly adminResources?: readonly AdminResourceDefinition[];
  readonly plugins?: readonly PluginDefinition[];
}): DocumentationPageCatalog => {
  const plugins = input.plugins ?? [];
  const hostAdminResources = mergeAdminResourceDefinitions(input.adminResources ?? []);
  const pluginAdminResources = mergePluginAdminResourceDefinitions(plugins);
  const adminResources = mergeAdminResourceDefinitions([
    ...hostAdminResources,
    ...pluginAdminResources,
  ]);
  const ownerByResourceId = new Map<string, DocumentationPageCatalogOwner>([
    ...hostAdminResources.map(
      (resource) => [resource.resourceId, { kind: 'host' as const }] as const
    ),
    ...plugins.flatMap((plugin) =>
      (plugin.adminResources ?? []).map(
        (resource) =>
          [resource.resourceId, { kind: 'plugin' as const, pluginId: plugin.id }] as const
      )
    ),
  ]);
  return createDocumentationPageCatalog([
    ...collectUiRouteDocumentationPages(adminResources),
    ...collectAdminResourceRouteDocumentationPages(
      input.bindings,
      adminResources,
      ownerByResourceId
    ),
    ...collectPluginRouteDocumentationPages(plugins),
  ]);
};
