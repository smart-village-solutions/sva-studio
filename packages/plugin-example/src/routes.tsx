import type { RouteFactory } from '@sva/sdk';
import type { AnyRoute, RootRoute } from '@tanstack/react-router';
import { createRoute } from '@tanstack/react-router';

const PluginExamplePage = () => {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Plugin Example</h2>
      <p>Diese Route kommt aus @sva/plugin-example.</p>
    </div>
  );
};

type PluginRouteFactory = RouteFactory<RootRoute, AnyRoute>;

export const pluginExampleRoutes: PluginRouteFactory[] = [
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/plugins/example',
      component: PluginExamplePage,
    }),
];
