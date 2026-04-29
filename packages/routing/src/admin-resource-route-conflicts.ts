import type { AdminResourceDefinition } from '@sva/plugin-sdk';

import { getAdminDetailRoutePath } from './admin-resource-route-paths.js';

export const collectAdminResourceRoutePaths = (
  resources: readonly AdminResourceDefinition[]
): ReadonlyMap<string, string> => {
  const paths = new Map<string, string>();

  for (const resource of resources) {
    const basePath = `/admin/${resource.basePath}`;
    const detailPath = getAdminDetailRoutePath(basePath, resource.views.detail.bindingKey);
    paths.set(basePath, resource.resourceId);
    paths.set(`${basePath}/new`, resource.resourceId);
    paths.set(detailPath, resource.resourceId);
    if (resource.views.history) {
      paths.set(`${detailPath}/history`, resource.resourceId);
    }
  }

  return paths;
};

export const assertNoStaticAdminRouteShadowing = (
  routePaths: ReadonlyMap<string, string>,
  staticPaths: readonly string[]
): void => {
  for (const staticPath of staticPaths) {
    const resourceId = routePaths.get(staticPath);
    if (resourceId && staticPath.startsWith('/admin/')) {
      throw new Error(`admin_resource_static_route_conflict:${resourceId}:${staticPath}`);
    }
  }
};
