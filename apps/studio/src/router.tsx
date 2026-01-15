import { createRouter } from '@tanstack/react-router'
import { buildRouteTree, mergeRouteFactories } from '@sva/core'
import { pluginExampleRoutes } from '@sva/plugin-example'

import { rootRoute } from './routes/__root'
import { coreRouteFactories } from './routes/-core-routes'

// Create a new router instance
export const getRouter = () => {
  const routeTree = buildRouteTree(
    rootRoute,
    mergeRouteFactories(coreRouteFactories, pluginExampleRoutes),
  )

  const router = createRouter({
    routeTree,
    context: {},

    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  })

  return router
}
