import { createRouter, type AnyRoute, type RootRoute } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import { pluginExampleRoutes } from '@sva/plugin-example';
import type { RouteGuardUser } from '@sva/routing';

import { coreRouteFactoriesBase } from './routes/-core-routes';
import { rootRoute } from './routes/__root';

const getAuthRouteFactories = createIsomorphicFn()
  .server(async () => {
    const mod = await import('@sva/routing/server');
    return mod.authServerRouteFactories;
  })
  .client(async () => {
    const mod = await import('@sva/routing');
    return mod.authRouteFactories;
  });

const resolveBaseUrl = () => {
  if (typeof globalThis.window !== 'undefined') {
    return globalThis.window.location.origin;
  }
  return process.env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
};

const readRouteGuardUser = (payload: unknown): RouteGuardUser => {
  const parsedPayload = payload as {
    user?: {
      roles?: unknown;
    };
  };

  const roles = Array.isArray(parsedPayload.user?.roles)
    ? parsedPayload.user.roles.filter((entry): entry is string => typeof entry === 'string')
    : [];

  return { roles };
};

const getRouteGuardUser = createIsomorphicFn()
  .server(async (): Promise<RouteGuardUser | null> => {
    try {
      const { getRequest, getRequestHeader } = await import('@tanstack/react-start/server');

      const request = getRequest();
      const cookieHeader = getRequestHeader('cookie');
      if (!cookieHeader) {
        return null;
      }

      const response = await fetch(new URL('/auth/me', request.url).toString(), {
        headers: {
          cookie: cookieHeader,
        },
      });

      if (!response.ok) {
        return null;
      }

      return readRouteGuardUser(await response.json());
    } catch {
      return null;
    }
  })
  .client(async (): Promise<RouteGuardUser | null> => {
    try {
      const response = await fetch(new URL('/auth/me', resolveBaseUrl()).toString(), {
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      return readRouteGuardUser(await response.json());
    } catch {
      return null;
    }
  });

type AppRouteFactory<TRoute extends AnyRoute = AnyRoute> = (rootRoute: RootRoute) => TRoute;
type MaterializedRoutes<TFactories extends readonly AppRouteFactory[]> = {
  readonly [K in keyof TFactories]: ReturnType<TFactories[K]>;
};

const materializeRoutes = <TFactories extends readonly AppRouteFactory[]>(factories: TFactories) =>
  // TanStack Router: createRootRoute() liefert einen konkreten Typ, der nicht
  // direkt mit dem generischen RootRoute-Parameter der Factories kompatibel ist.
  // Workaround bis TanStack Router dies nativ unterstützt.
  factories.map((factory) => factory(rootRoute as unknown as RootRoute)) as MaterializedRoutes<TFactories>;

export const createRuntimeRouteTree = <
  TAuthRouteFactories extends Awaited<ReturnType<typeof getAuthRouteFactories>> & readonly AppRouteFactory[],
>(
  runtimeAuthRouteFactories: TAuthRouteFactories,
) => {
  const extensionRouteFactories = [...runtimeAuthRouteFactories, ...pluginExampleRoutes] as const;
  const runtimeRoutes = [...materializeRoutes(coreRouteFactoriesBase), ...materializeRoutes(extensionRouteFactories)] as const;

  return rootRoute.addChildren(runtimeRoutes);
};

// Create a new router instance
export const getRouter = async () => {
  const runtimeAuthRouteFactories = await getAuthRouteFactories();
  const routeTree = createRuntimeRouteTree(runtimeAuthRouteFactories);

  const router = createRouter({
    routeTree,
    context: {
      auth: {
        getUser: getRouteGuardUser,
      },
    },

    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
