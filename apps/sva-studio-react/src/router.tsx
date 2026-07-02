import { studioAdminResources, studioPlugins } from './lib/plugins';
import { createRouter, type RootRoute } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import { isMockAuthRuntimeProfile, parseRuntimeProfile } from '@sva/core';
import type { AppRouteFactory, RouteGuardUser } from '@sva/routing';

import { hasActiveDevAuthSession, hasActiveDevAuthSessionCookie, isDevAuthAvailable } from './lib/dev-auth';
import { fetchWithRequestTimeout } from './lib/iam-api';
import { fetchAuthMeSingleFlight } from './lib/auth-me-singleflight';
import { appRouteBindings } from './routing/app-route-bindings';
import { rootRoute } from './routes/__root';

const getRuntimeRouteFactories = createIsomorphicFn()
  .server(async () => {
    const mod = await import('@sva/routing/server');
    return mod.getServerRouteFactories({
      bindings: appRouteBindings,
      adminResources: studioAdminResources,
      plugins: studioPlugins,
    });
  })
  .client(async () => {
    const mod = await import('@sva/routing');
    return mod.getClientRouteFactories({
      bindings: appRouteBindings,
      adminResources: studioAdminResources,
      plugins: studioPlugins,
    });
  });

export const resolveBaseUrl = () => {
  if (typeof globalThis.window !== 'undefined') {
    return globalThis.window.location.origin;
  }
  return process.env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
};

export const isMockAuthEnabled = async () => {
  const runtimeProfile = parseRuntimeProfile(import.meta.env.VITE_SVA_RUNTIME_PROFILE);

  return (
    isDevAuthAvailable() ||
    (runtimeProfile !== null && isMockAuthRuntimeProfile(runtimeProfile))
  );
};

export const createMockRouteGuardUser = (): RouteGuardUser => ({
  instanceId: 'de-musterhausen',
  assignedModules: ['categories', 'events', 'media', 'news', 'poi', 'waste-management'],
  roles: ['system_admin'],
  permissionActions: [
    'iam.user.read',
    'iam.user.write',
    'iam.role.read',
    'iam.role.write',
    'iam.org.read',
    'iam.org.write',
    'iam.legalText.read',
    'iam.legalText.write',
    'iam.governance.read',
    'iam.governance.write',
    'iam.governance.export',
    'iam.dsr.read',
    'iam.dsr.write',
    'iam.dsr.export',
    'iam.deletionRules.read',
    'iam.deletionRules.write',
    'iam.monitoring.read',
    'iam.monitoring.write',
    'experimental.read',
    'app.read',
    'cockpit.read',
    'content.read',
    'content.create',
    'content.updateMetadata',
    'content.updatePayload',
    'content.changeStatus',
    'content.publish',
    'content.archive',
    'content.restore',
    'content.readHistory',
    'content.manageRevisions',
    'content.delete',
    'media.read',
    'media.create',
    'media.update',
    'media.reference.manage',
    'media.delete',
    'media.deliver.protected',
    'categories.read',
    'categories.create',
    'categories.update',
    'categories.delete',
    'news.read',
    'events.read',
    'poi.read',
    'waste-management.read',
    'waste-management.master-data.manage',
    'waste-management.tours.manage',
    'waste-management.scheduling.manage',
    'waste-management.import.execute',
    'waste-management.seed.execute',
    'waste-management.reset.execute',
    'waste-management.settings.manage',
    'integration.manage',
    'feature.toggle',
  ],
});

type RouteGuardUserPayload = {
  user?: {
    id?: unknown;
    instanceId?: unknown;
    roles?: unknown;
    permissionActions?: unknown;
    permissionStatus?: unknown;
    assignedModules?: unknown;
  };
};

const readRouteGuardPayloadUser = (payload: unknown): RouteGuardUserPayload['user'] => {
  if (typeof payload !== 'object' || payload === null || !('user' in payload)) {
    return undefined;
  }

  const { user } = payload as RouteGuardUserPayload;
  if (typeof user !== 'object' || user === null || Array.isArray(user)) {
    return undefined;
  }

  return user;
};

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry: unknown): entry is string => typeof entry === 'string') : [];

export const readRouteGuardUser = (payload: unknown): RouteGuardUser => {
  const user = readRouteGuardPayloadUser(payload);

  const instanceId = typeof user?.instanceId === 'string' ? user.instanceId : undefined;
  const roles = readStringArray(user?.roles);
  const permissionActions = readStringArray(user?.permissionActions);
  const assignedModules = readStringArray(user?.assignedModules);

  const rawStatus = user?.permissionStatus;
  const permissionStatus: 'ok' | 'degraded' = rawStatus === 'degraded' ? 'degraded' : 'ok';

  return { instanceId, roles, permissionActions, permissionStatus, assignedModules };
};

export const parseRouteGuardUser = (payload: unknown): RouteGuardUser | null => {
  const user = readRouteGuardPayloadUser(payload);

  if (!user) {
    return null;
  }

  const hasRecognizedUserShape =
    typeof user.id === 'string' ||
    typeof user.instanceId === 'string' ||
    Array.isArray(user.roles) ||
    Array.isArray(user.permissionActions) ||
    Array.isArray(user.assignedModules) ||
    typeof user.permissionStatus === 'string';

  return hasRecognizedUserShape ? readRouteGuardUser(payload) : null;
};

const loadRouteGuardUserFromAuthMe = async (url: string, init?: RequestInit): Promise<RouteGuardUser | null> => {
  const response = await fetchWithRequestTimeout(url, init, { timeoutMs: 5_000 });

  if (!response.ok) {
    return null;
  }

  return parseRouteGuardUser(await response.json());
};

const getRouteGuardUser = createIsomorphicFn()
  .server(async (): Promise<RouteGuardUser | null> => {
    try {
      const { getRequest } = await import('@tanstack/react-start/server');

      const request = getRequest();
      const cookie = request.headers.get('cookie');
      if (isDevAuthAvailable() && hasActiveDevAuthSessionCookie(cookie)) {
        return createMockRouteGuardUser();
      }
      const authMeUrl = new URL('/auth/me', request.url).toString();

      return await loadRouteGuardUserFromAuthMe(
        authMeUrl,
        cookie
          ? {
              headers: { cookie },
            }
          : undefined
      );
    } catch {
      return null;
    }
  })
  .client(async (): Promise<RouteGuardUser | null> => {
    if (isDevAuthAvailable() && hasActiveDevAuthSession()) {
      return createMockRouteGuardUser();
    }
    try {
      const result = await fetchAuthMeSingleFlight(() =>
        fetchWithRequestTimeout(new URL('/auth/me', resolveBaseUrl()).toString(), undefined, { timeoutMs: 5_000 })
      );
      if (!result.ok) return null;
      return parseRouteGuardUser(result.payload);
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

  if (typeof globalThis.window !== 'undefined') {
    (
      globalThis.window as typeof globalThis.window & {
        __SVA_PLAYWRIGHT_ROUTER__?: typeof router;
      }
    ).__SVA_PLAYWRIGHT_ROUTER__ = router;
  }

  return router;
};
