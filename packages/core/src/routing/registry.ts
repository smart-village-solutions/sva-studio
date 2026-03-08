export type RouteFactory<TRoot, TRoute> = (rootRoute: TRoot) => TRoute;

export const mergeRouteFactories = <TRoot, TRoute>(
  core: RouteFactory<TRoot, TRoute>[],
  plugins: RouteFactory<TRoot, TRoute>[] = [],
) => [...core, ...plugins];

export const buildRouteTree = <
  TRoot extends { addChildren: (routes: TRoute[]) => unknown },
  TRoute,
>(
  rootRoute: TRoot,
  factories: RouteFactory<TRoot, TRoute>[],
) => {
  const routes = factories.map((factory) => factory(rootRoute));
  return rootRoute.addChildren(routes);
};
