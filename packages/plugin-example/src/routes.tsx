import type { RootRoute } from '@tanstack/react-router';
import { createRoute } from '@tanstack/react-router';

const PluginExamplePage = () => {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Plugin Example</h2>
      <p>Diese Route kommt aus @sva/plugin-example.</p>
    </div>
  );
};

export const pluginExampleRoutes = [
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/plugins/example',
      component: PluginExamplePage,
    }),
];
