import { createRoute } from '@tanstack/react-router';
import type { RootRoute } from '@tanstack/react-router';

const PluginExamplePage = () => {
  return (
    <div>
      <h2>Plugin Example</h2>
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
