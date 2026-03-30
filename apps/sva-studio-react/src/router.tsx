import type { RouteFactory } from '@sva/sdk';
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

let sdkRuntimeProfilePromise: Promise<Pick<typeof import('@sva/sdk'), 'isMockAuthRuntimeProfile' | 'parseRuntimeProfile'>> | null = null;

const getSdkRuntimeProfileHelpers = async () => {
  sdkRuntimeProfilePromise ??= import('@sva/sdk').then((mod) => ({
    isMockAuthRuntimeProfile: mod.isMockAuthRuntimeProfile,
    parseRuntimeProfile: mod.parseRuntimeProfile,
  }));

  return sdkRuntimeProfilePromise;
};

const isMockAuthEnabled = async () => {
  const sdk = await getSdkRuntimeProfileHelpers();
  const runtimeProfile = sdk.parseRuntimeProfile(import.meta.env.VITE_SVA_RUNTIME_PROFILE);

  return (
    import.meta.env.VITE_MOCK_AUTH === true ||
    import.meta.env.VITE_MOCK_AUTH === 'true' ||
    (runtimeProfile !== null && sdk.isMockAuthRuntimeProfile(runtimeProfile))
  );
};

const createMockRouteGuardUser = (): RouteGuardUser => ({
  roles: ['system_admin', 'iam_admin', 'support_admin', 'security_admin', 'interface_manager', 'app_manager', 'editor'],
});

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
      if (await isMockAuthEnabled()) {
        return createMockRouteGuardUser();
      }

      const [{ withAuthenticatedUser }, { getRequest }] = await Promise.all([
        import('@sva/auth/server'),
        import('@tanstack/react-start/server'),
      ]);

      const request = getRequest();
      let routeGuardUser: RouteGuardUser | null = null;
      const response = await withAuthenticatedUser(request, ({ user }) => {
        routeGuardUser = { roles: user.roles };
        return new Response(null, { status: 204 });
      });

      return response.ok ? routeGuardUser : null;
    } catch {
      return null;
    }
  })
  .client(async (): Promise<RouteGuardUser | null> => {
    try {
      if (await isMockAuthEnabled()) {
        return createMockRouteGuardUser();
      }

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

type AppRouteFactory<TRoute extends AnyRoute = AnyRoute> = RouteFactory<RootRoute, TRoute>;
type MaterializedRoutes<TFactories extends readonly AppRouteFactory[]> = {
  readonly [K in keyof TFactories]: ReturnType<TFactories[K]>;
};

const areDemoRoutesEnabled = () => {
  const configuredValue = import.meta.env.VITE_ENABLE_DEMO_ROUTES;
  if (configuredValue === true || configuredValue === 'true') {
    return true;
  }
  if (configuredValue === false || configuredValue === 'false') {
    return false;
  }

  return (process.env.NODE_ENV ?? 'development') !== 'production';
};

const getRuntimeCoreRouteFactories = async (): Promise<readonly AppRouteFactory[]> => {
  if (!areDemoRoutesEnabled()) {
    return coreRouteFactoriesBase;
  }

  const mod = await import('./routes/-demo-routes');
  return [...coreRouteFactoriesBase, mod.demoRouteFactory];
};

const materializeRoutes = <TFactories extends readonly AppRouteFactory[]>(factories: TFactories) =>
  // TanStack Router: createRootRoute() liefert einen konkreten Typ, der nicht
  // direkt mit dem generischen RootRoute-Parameter der Factories kompatibel ist.
  // Workaround bis TanStack Router dies nativ unterstützt.
  factories.map((factory) => factory(rootRoute as unknown as RootRoute)) as MaterializedRoutes<TFactories>;

export const createRuntimeRouteTree = <
  TCoreRouteFactories extends readonly AppRouteFactory[],
  TAuthRouteFactories extends Awaited<ReturnType<typeof getAuthRouteFactories>> & readonly AppRouteFactory[],
>(
  runtimeAuthRouteFactories: TAuthRouteFactories,
  runtimeCoreRouteFactories: TCoreRouteFactories = coreRouteFactoriesBase as unknown as TCoreRouteFactories,
) => {
  const extensionRouteFactories = [
    ...runtimeAuthRouteFactories,
    ...pluginExampleRoutes,
  ] as const;
  const runtimeRoutes = [...materializeRoutes(runtimeCoreRouteFactories), ...materializeRoutes(extensionRouteFactories)] as const;

  return rootRoute.addChildren(runtimeRoutes);
};

// Create a new router instance
export const getRouter = async () => {
  const runtimeCoreRouteFactories = await getRuntimeCoreRouteFactories();
  const runtimeAuthRouteFactories = await getAuthRouteFactories();
  const routeTree = createRuntimeRouteTree(runtimeAuthRouteFactories, runtimeCoreRouteFactories);

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
