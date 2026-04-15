import { studioPlugins } from './lib/plugins';
import { createRouter, type RootRoute } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import type { AppRouteFactory, RouteGuardUser } from '@sva/routing';

import { fetchWithRequestTimeout } from './lib/iam-api';
import { appRouteBindings } from './routing/app-route-bindings';
import { rootRoute } from './routes/__root';

const getRuntimeRouteFactories = createIsomorphicFn()
  .server(async () => {
    const mod = await import('@sva/routing/server');
    return mod.getServerRouteFactories({
      bindings: appRouteBindings,
      plugins: studioPlugins,
    });
  })
  .client(async () => {
    const mod = await import('@sva/routing');
    return mod.getClientRouteFactories({
      bindings: appRouteBindings,
      plugins: studioPlugins,
    });
  });

export const resolveBaseUrl = () => {
  if (typeof globalThis.window !== 'undefined') {
    return globalThis.window.location.origin;
  }
  return process.env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
};

let sdkRuntimeProfilePromise: Promise<Pick<typeof import('@sva/sdk'), 'isMockAuthRuntimeProfile' | 'parseRuntimeProfile'>> | null = null;

export const getSdkRuntimeProfileHelpers = async () => {
  sdkRuntimeProfilePromise ??= import('@sva/sdk').then((mod) => ({
    isMockAuthRuntimeProfile: mod.isMockAuthRuntimeProfile,
    parseRuntimeProfile: mod.parseRuntimeProfile,
  }));

  return sdkRuntimeProfilePromise;
};

export const isMockAuthEnabled = async () => {
  const sdk = await getSdkRuntimeProfileHelpers();
  const runtimeProfile = sdk.parseRuntimeProfile(import.meta.env.VITE_SVA_RUNTIME_PROFILE);

  return (
    import.meta.env.VITE_MOCK_AUTH === true ||
    import.meta.env.VITE_MOCK_AUTH === 'true' ||
    (runtimeProfile !== null && sdk.isMockAuthRuntimeProfile(runtimeProfile))
  );
};

export const createMockRouteGuardUser = (): RouteGuardUser => ({
  roles: [
    'system_admin',
    'iam_admin',
    'support_admin',
    'security_admin',
    'instance_registry_admin',
    'interface_manager',
    'app_manager',
    'editor',
  ],
});

export const readRouteGuardUser = (payload: unknown): RouteGuardUser => {
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

      const response = await fetchWithRequestTimeout(
        new URL('/auth/me', resolveBaseUrl()).toString(),
        undefined,
        { timeoutMs: 5_000 }
      );

      if (!response.ok) {
        return null;
      }

      return readRouteGuardUser(await response.json());
    } catch {
      return null;
    }
  });

type MaterializedRoutes<TFactories extends readonly AppRouteFactory[]> = {
  readonly [K in keyof TFactories]: ReturnType<TFactories[K]>;
};

const materializeRoutes = <TFactories extends readonly AppRouteFactory[]>(factories: TFactories) =>
  // TanStack Router: createRootRoute() liefert einen konkreten Typ, der nicht
  // direkt mit dem generischen RootRoute-Parameter der Factories kompatibel ist.
  // Workaround bis TanStack Router dies nativ unterstützt.
  factories.map((factory) => factory(rootRoute as unknown as RootRoute)) as MaterializedRoutes<TFactories>;
export const createRuntimeRouteTree = <TFactories extends readonly AppRouteFactory[]>(
  runtimeRouteFactories: TFactories
) => {
  const runtimeRoutes = materializeRoutes(runtimeRouteFactories);
  return rootRoute.addChildren([...runtimeRoutes]);
};

// Create a new router instance
export const getRouter = async () => {
  const runtimeRouteFactories = await getRuntimeRouteFactories();
  const routeTree = createRuntimeRouteTree(runtimeRouteFactories);

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
