import { redirect } from '@tanstack/react-router';
import type { RoutingDiagnosticsHook } from './diagnostics.js';
import {
  assertAllRequiredPermissions,
  assertAnyRequiredAccess,
  assertRequiredRoles,
  emitAccessDeniedDiagnostic,
  requiresPermissionSnapshot,
  throwPermissionSnapshotUnavailable,
} from './protected-route-access.js';
import { buildLoginHref } from './protected-route-redirects.js';

export type RouteGuardUser = {
  readonly instanceId?: string;
  readonly roles: readonly string[];
  readonly keycloakRoles?: readonly string[];
  readonly permissionActions?: readonly string[];
  readonly assignedModules?: readonly string[];
  readonly permissionStatus?: 'ok' | 'degraded';
};

export type RouteGuardContext = {
  readonly auth?: {
    readonly getUser: () => Promise<RouteGuardUser | null> | RouteGuardUser | null;
  };
};

type BeforeLoadOptions<TContext extends RouteGuardContext = RouteGuardContext> = {
  readonly context: TContext;
  readonly location: {
    readonly href: string;
  };
};

export type ProtectedRouteOptions = {
  readonly requiredRoles?: readonly string[];
  readonly requiredAnyRoles?: readonly string[];
  readonly loginPath?: string;
  readonly fallbackPath?: string;
  readonly insufficientRoleKey?: string;
  readonly diagnostics?: RoutingDiagnosticsHook;
  readonly route?: string;
  readonly requiredPermissions?: readonly string[];
  readonly requiredAnyPermissions?: readonly string[];
};

const DEFAULT_LOGIN_PATH = '/auth/login';
const DEFAULT_FALLBACK_PATH = '/';
const DEFAULT_INSUFFICIENT_ROLE_KEY = 'auth.insufficientRole';

export const createProtectedRoute = <TContext extends RouteGuardContext = RouteGuardContext>(
  options: ProtectedRouteOptions = {}
) => {
  const {
    requiredRoles = [],
    requiredAnyRoles = [],
    loginPath = DEFAULT_LOGIN_PATH,
    fallbackPath = DEFAULT_FALLBACK_PATH,
    insufficientRoleKey = DEFAULT_INSUFFICIENT_ROLE_KEY,
    diagnostics,
    requiredPermissions = [],
    requiredAnyPermissions = [],
  } = options;
  const diagnosticsRoute =
    'route' in options && typeof options.route === 'string' ? options.route : null;

  return async ({ context, location }: BeforeLoadOptions<TContext>) => {
    const user = await context.auth?.getUser();

    if (!user) {
      emitAccessDeniedDiagnostic({
        diagnostics,
        route: diagnosticsRoute,
        reason: 'unauthenticated',
        fallbackPath: DEFAULT_FALLBACK_PATH,
      });
      throw redirect({ href: buildLoginHref(loginPath, location.href) });
    }

    if (
      user.permissionStatus === 'degraded' &&
      requiresPermissionSnapshot({
        user,
        requiredPermissions,
        requiredAnyPermissions,
        requiredAnyRoles,
      })
    ) {
      throwPermissionSnapshotUnavailable({
        diagnostics,
        route: diagnosticsRoute,
        fallbackPath,
        insufficientRoleKey,
        requiredPermissions: [...requiredPermissions, ...requiredAnyPermissions],
      });
    }

    assertAllRequiredPermissions({
      user,
      requiredPermissions,
      diagnostics,
      route: diagnosticsRoute,
      fallbackPath,
      insufficientRoleKey,
    });
    assertAnyRequiredAccess({
      user,
      requiredPermissions: requiredAnyPermissions,
      requiredRoles: requiredAnyRoles,
      diagnostics,
      route: diagnosticsRoute,
      fallbackPath,
      insufficientRoleKey,
    });
    assertRequiredRoles({
      user,
      requiredRoles,
      diagnostics,
      route: diagnosticsRoute,
      fallbackPath,
      insufficientRoleKey,
    });
  };
};

export const createAdminRoute = <TContext extends RouteGuardContext = RouteGuardContext>(
  options: ProtectedRouteOptions = {}
) => createProtectedRoute<TContext>({ ...options });
