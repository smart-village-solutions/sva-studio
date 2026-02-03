export const mergeRouteFactories = (core, plugins = []) => [...core, ...plugins];
export const buildRouteTree = (rootRoute, factories) => {
  const routes = factories.map((factory) => factory(rootRoute));
  return rootRoute.addChildren(routes);
};
