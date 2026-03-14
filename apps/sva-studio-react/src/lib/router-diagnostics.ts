export interface RouteSnapshot {
  id: string | null;
  path: string | null;
  fullPath: string | null;
  childCount: number;
  children: RouteSnapshot[];
}

export interface RouterRegistrySnapshot {
  routeIds: string[];
  routePaths: string[];
  flatRouteIds: string[];
  flatRoutePaths: string[];
}

export interface RouterDiagnosticsSnapshot {
  timestamp: string;
  nodeEnv: string | null;
  publicBaseUrl: string | null;
  routeTree: RouteSnapshot;
  routeTreeNodeCount: number;
  routerRegistry: RouterRegistrySnapshot;
  routeFlags: {
    hasRootRoute: boolean;
    hasDemoRoute: boolean;
  };
}

interface RouteLike {
  id?: unknown;
  path?: unknown;
  fullPath?: unknown;
  children?: unknown;
}

interface RouterLike {
  routesById?: unknown;
  routesByPath?: unknown;
  flatRoutes?: unknown;
}

const asStringOrNull = (value: unknown): string | null => {
  return typeof value === 'string' ? value : null;
};

const asRouteArray = (value: unknown): RouteLike[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is RouteLike => Boolean(entry) && typeof entry === 'object');
  }

  if (value && typeof value === 'object') {
    return Object.values(value).filter((entry): entry is RouteLike => Boolean(entry) && typeof entry === 'object');
  }

  return [];
};

export const collectRouteSnapshot = (route: unknown): RouteSnapshot => {
  const routeLike = (route ?? {}) as RouteLike;
  const children = asRouteArray(routeLike.children).map((child) => collectRouteSnapshot(child));

  return {
    id: asStringOrNull(routeLike.id),
    path: asStringOrNull(routeLike.path),
    fullPath: asStringOrNull(routeLike.fullPath),
    childCount: children.length,
    children,
  };
};

export const countRouteNodes = (route: RouteSnapshot): number => {
  return 1 + route.children.reduce((total, child) => total + countRouteNodes(child), 0);
};

const collectUniqueStrings = (routes: RouteLike[], key: 'id' | 'fullPath'): string[] => {
  return [...new Set(routes.map((route) => asStringOrNull(route[key])).filter((value): value is string => value !== null))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
};

export const createRouterDiagnosticsSnapshot = ({
  routeTree,
  router,
  publicBaseUrl,
}: {
  routeTree: unknown;
  router: unknown;
  publicBaseUrl?: string | null;
}): RouterDiagnosticsSnapshot => {
  const routeTreeSnapshot = collectRouteSnapshot(routeTree);
  const routerLike = (router ?? {}) as RouterLike;
  const routesById = asRouteArray(routerLike.routesById);
  const routesByPath = asRouteArray(routerLike.routesByPath);
  const flatRoutes = asRouteArray(routerLike.flatRoutes);

  const routeIds = collectUniqueStrings(routesById, 'id');
  const routePaths = collectUniqueStrings(routesByPath, 'fullPath');
  const flatRouteIds = collectUniqueStrings(flatRoutes, 'id');
  const flatRoutePaths = collectUniqueStrings(flatRoutes, 'fullPath');

  const knownPaths = new Set(
    [
      ...routePaths,
      ...flatRoutePaths,
      routeTreeSnapshot.fullPath,
      ...routeTreeSnapshot.children.map((child) => child.fullPath),
    ].filter(Boolean),
  );

  return {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV ?? null,
    publicBaseUrl: publicBaseUrl ?? null,
    routeTree: routeTreeSnapshot,
    routeTreeNodeCount: countRouteNodes(routeTreeSnapshot),
    routerRegistry: {
      routeIds,
      routePaths,
      flatRouteIds,
      flatRoutePaths,
    },
    routeFlags: {
      hasRootRoute: knownPaths.has('/'),
      hasDemoRoute: knownPaths.has('/demo'),
    },
  };
};
