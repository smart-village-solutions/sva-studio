import type { AdminResourceDefinition } from '@sva/plugin-sdk';
import { redirect } from '@tanstack/react-router';

type AdminResourceRouteKind = 'list' | 'create' | 'detail' | 'history';

type RouteGuardUser = {
  assignedModules?: readonly string[];
  permissionActions?: readonly string[];
};

type GuardBeforeLoadOptions = {
  readonly context?: {
    readonly auth?: {
      readonly getUser?: () => Promise<RouteGuardUser | null | undefined>;
    };
  };
};

export const createMemoizedUserContext = <TBeforeLoadOptions extends GuardBeforeLoadOptions>(
  beforeLoadOptions: TBeforeLoadOptions
) => {
  let cachedUserPromise: Promise<RouteGuardUser | null | undefined> | null = null;
  const getUser = async () => {
    cachedUserPromise ??= Promise.resolve().then(() => beforeLoadOptions.context?.auth?.getUser?.());
    return await cachedUserPromise;
  };

  return {
    getUser,
    options: {
      ...beforeLoadOptions,
      context: {
        ...beforeLoadOptions.context,
        auth: beforeLoadOptions.context?.auth
          ? {
              ...beforeLoadOptions.context.auth,
              getUser,
            }
          : {
              getUser,
            },
      },
    } as TBeforeLoadOptions,
  };
};

export const ensureAssignedModule = async (
  resource: AdminResourceDefinition,
  user: RouteGuardUser | null | undefined
): Promise<void> => {
  if (!resource.moduleId) {
    return;
  }

  if (!user?.assignedModules?.includes(resource.moduleId)) {
    throw redirect({ href: '/?error=auth.insufficientRole' });
  }
};

export const ensureRequiredPermissions = async (
  resource: AdminResourceDefinition,
  routeKind: AdminResourceRouteKind,
  user: RouteGuardUser | null | undefined
): Promise<void> => {
  const requiredPermissions = resource.permissions?.[routeKind];
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return;
  }

  const grantedPermissions = new Set(user?.permissionActions ?? []);
  if (requiredPermissions.some((permission) => !grantedPermissions.has(permission))) {
    throw redirect({ href: '/?error=auth.insufficientRole' });
  }
};
