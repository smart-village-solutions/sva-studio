import { redirect } from '@tanstack/react-router';

import {
  emitRoutingDiagnostic,
  type RoutingDiagnosticsHook,
} from './diagnostics.js';

export type RouteGuardUser = {
  readonly roles: readonly string[];
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
  readonly loginPath?: string;
  readonly fallbackPath?: string;
  readonly insufficientRoleKey?: string;
  readonly diagnostics?: RoutingDiagnosticsHook;
  readonly route?: string;
  readonly requiredPermissions?: readonly string[];
};

const DEFAULT_LOGIN_PATH = '/auth/login';
const DEFAULT_FALLBACK_PATH = '/';
const DEFAULT_INSUFFICIENT_ROLE_KEY = 'auth.insufficientRole';
const ADMIN_ROLES = ['system_admin', 'app_manager'] as const;
const INTERNAL_REDIRECT_BASE = 'https://local.invalid';

const isInternalPath = (value: string): boolean => value.startsWith('/') && value.startsWith('//') === false;

const normalizeInternalPath = (value: string, fallbackPath: string): string => {
  const candidate = isInternalPath(value) ? value : fallbackPath;
  const url = new URL(candidate, INTERNAL_REDIRECT_BASE);
  return `${url.pathname}${url.search}${url.hash}`;
};

const buildLoginHref = (loginPath: string, returnTo: string) => {
  const url = new URL(normalizeInternalPath(loginPath, DEFAULT_LOGIN_PATH), INTERNAL_REDIRECT_BASE);
  url.searchParams.set('returnTo', normalizeInternalPath(returnTo, DEFAULT_FALLBACK_PATH));
  return `${url.pathname}${url.search}`;
};

const buildInsufficientRoleHref = (path: string, reasonKey: string) => {
  const url = new URL(normalizeInternalPath(path, DEFAULT_FALLBACK_PATH), INTERNAL_REDIRECT_BASE);
  url.searchParams.set('error', reasonKey);
  return `${url.pathname}${url.search}`;
};

const sanitizePathForDiagnostics = (value: string, fallbackPath: string): string => {
  const url = new URL(normalizeInternalPath(value, fallbackPath), INTERNAL_REDIRECT_BASE);
  return url.pathname;
};

const sanitizeRequiredRoles = (requiredRoles: readonly string[]): readonly string[] =>
  requiredRoles
    .map((requiredRole) => {
      const segments = requiredRole.split(':').filter(Boolean);
      return segments[segments.length - 1];
    })
    .filter((requiredRole): requiredRole is string => typeof requiredRole === 'string' && requiredRole.length > 0);

const hasAnyRole = (user: RouteGuardUser, requiredRoles: readonly string[]) =>
  requiredRoles.some((requiredRole) => user.roles.includes(requiredRole));

export const createProtectedRoute = <TContext extends RouteGuardContext = RouteGuardContext>(
  options: ProtectedRouteOptions = {}
) => {
  const {
    requiredRoles = [],
    loginPath = DEFAULT_LOGIN_PATH,
    fallbackPath = DEFAULT_FALLBACK_PATH,
    insufficientRoleKey = DEFAULT_INSUFFICIENT_ROLE_KEY,
    diagnostics,
    requiredPermissions = [],
  } = options;
  const diagnosticsRoute = 'route' in options && typeof options.route === 'string' ? options.route : null;

  return async ({ context, location }: BeforeLoadOptions<TContext>) => {
    const user = await context.auth?.getUser();

    if (!user) {
      if (diagnosticsRoute) {
        emitRoutingDiagnostic(diagnostics, {
          level: 'info',
          event: 'routing.guard.access_denied',
          route: diagnosticsRoute,
          reason: 'unauthenticated',
          redirect_target: sanitizePathForDiagnostics(loginPath, DEFAULT_LOGIN_PATH),
        });
      }
      throw redirect({ href: buildLoginHref(loginPath, location.href) });
    }

    if (requiredPermissions.length > 0) {
      const grantedPermissions = new Set(user.permissionActions ?? []);
      const missingPermissions = requiredPermissions.filter((permission) => !grantedPermissions.has(permission));
      if (missingPermissions.length > 0) {
        if (diagnosticsRoute) {
          emitRoutingDiagnostic(diagnostics, {
            level: 'info',
            event: 'routing.guard.access_denied',
            route: diagnosticsRoute,
            reason: 'insufficient-permission',
            redirect_target: sanitizePathForDiagnostics(fallbackPath, DEFAULT_FALLBACK_PATH),
            required_permissions: requiredPermissions,
          });
        }
        throw redirect({
          href: buildInsufficientRoleHref(fallbackPath, insufficientRoleKey),
        });
      }
    }
    if (requiredRoles.length > 0 && !hasAnyRole(user, requiredRoles)) {
      if (diagnosticsRoute) {
        emitRoutingDiagnostic(diagnostics, {
          level: 'info',
          event: 'routing.guard.access_denied',
          route: diagnosticsRoute,
          reason: 'insufficient-role',
          redirect_target: sanitizePathForDiagnostics(fallbackPath, DEFAULT_FALLBACK_PATH),
          required_roles: sanitizeRequiredRoles(requiredRoles),
        });
      }
      throw redirect({ href: buildInsufficientRoleHref(fallbackPath, insufficientRoleKey) });
    }
  };
};

export const createAdminRoute = <TContext extends RouteGuardContext = RouteGuardContext>(
  options: Omit<ProtectedRouteOptions, 'requiredRoles'> = {}
) =>
  createProtectedRoute<TContext>({
    ...options,
    requiredRoles: ADMIN_ROLES,
  });
