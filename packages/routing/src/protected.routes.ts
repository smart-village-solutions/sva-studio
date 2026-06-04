import { redirect } from '@tanstack/react-router';

import { emitRoutingDiagnostic, type RoutingDiagnosticsHook } from './diagnostics.js';

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
const INTERNAL_REDIRECT_BASE = 'https://local.invalid';

const isInternalPath = (value: string): boolean => value.startsWith('/') && value.startsWith('//') === false;

const normalizeInternalPath = (value: string, fallbackPath: string): string => {
  const candidate = isInternalPath(value) ? value : fallbackPath;
  const url = new URL(candidate, INTERNAL_REDIRECT_BASE);
  return `${url.pathname}${url.search}${url.hash}`;
};

const normalizeReturnToPath = (value: string): string => {
  if (isInternalPath(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_FALLBACK_PATH;
  }
};

const buildLoginHref = (_loginPath: string, returnTo: string) => {
  const url = new URL(DEFAULT_FALLBACK_PATH, INTERNAL_REDIRECT_BASE);
  url.searchParams.set('auth', 'login');
  url.searchParams.set('returnTo', normalizeReturnToPath(returnTo));
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

const emitAccessDeniedDiagnostic = (input: {
  readonly diagnostics: RoutingDiagnosticsHook | undefined;
  readonly route: string | null;
  readonly reason: 'unauthenticated' | 'insufficient-permission' | 'insufficient-role';
  readonly fallbackPath: string;
  readonly requiredPermissions?: readonly string[];
  readonly requiredRoles?: readonly string[];
}) => {
  if (!input.route) {
    return;
  }
  emitRoutingDiagnostic(input.diagnostics, {
    level: 'info',
    event: 'routing.guard.access_denied',
    route: input.route,
    reason: input.reason,
    redirect_target: sanitizePathForDiagnostics(input.fallbackPath, DEFAULT_FALLBACK_PATH),
    ...(input.requiredPermissions ? { required_permissions: input.requiredPermissions } : {}),
    ...(input.requiredRoles ? { required_roles: sanitizeRequiredRoles(input.requiredRoles) } : {}),
  });
};

const throwInsufficientAccessRedirect = (fallbackPath: string, insufficientRoleKey: string): never => {
  throw redirect({
    href: buildInsufficientRoleHref(fallbackPath, insufficientRoleKey),
  });
};

const assertAllRequiredPermissions = (input: {
  readonly user: RouteGuardUser;
  readonly requiredPermissions: readonly string[];
  readonly diagnostics: RoutingDiagnosticsHook | undefined;
  readonly route: string | null;
  readonly fallbackPath: string;
  readonly insufficientRoleKey: string;
}) => {
  if (input.requiredPermissions.length === 0) {
    return;
  }
  const grantedPermissions = new Set(input.user.permissionActions ?? []);
  const missingPermissions = input.requiredPermissions.filter(
    (permission) => !grantedPermissions.has(permission)
  );
  if (missingPermissions.length === 0) {
    return;
  }

  emitAccessDeniedDiagnostic({
    diagnostics: input.diagnostics,
    route: input.route,
    reason: 'insufficient-permission',
    fallbackPath: input.fallbackPath,
    requiredPermissions: input.requiredPermissions,
  });
  throwInsufficientAccessRedirect(input.fallbackPath, input.insufficientRoleKey);
};

const assertAnyRequiredAccess = (input: {
  readonly user: RouteGuardUser;
  readonly requiredPermissions: readonly string[];
  readonly requiredRoles: readonly string[];
  readonly diagnostics: RoutingDiagnosticsHook | undefined;
  readonly route: string | null;
  readonly fallbackPath: string;
  readonly insufficientRoleKey: string;
}) => {
  if (input.requiredPermissions.length === 0 && input.requiredRoles.length === 0) {
    return;
  }
  const grantedPermissions = new Set(input.user.permissionActions ?? []);
  if (
    input.requiredPermissions.some((permission) => grantedPermissions.has(permission)) ||
    hasAnyRole(input.user, input.requiredRoles)
  ) {
    return;
  }

  emitAccessDeniedDiagnostic({
    diagnostics: input.diagnostics,
    route: input.route,
    reason: input.requiredPermissions.length > 0 ? 'insufficient-permission' : 'insufficient-role',
    fallbackPath: input.fallbackPath,
    requiredPermissions: input.requiredPermissions.length > 0 ? input.requiredPermissions : undefined,
    requiredRoles: input.requiredRoles.length > 0 ? input.requiredRoles : undefined,
  });
  throwInsufficientAccessRedirect(input.fallbackPath, input.insufficientRoleKey);
};

const assertRequiredRoles = (input: {
  readonly user: RouteGuardUser;
  readonly requiredRoles: readonly string[];
  readonly diagnostics: RoutingDiagnosticsHook | undefined;
  readonly route: string | null;
  readonly fallbackPath: string;
  readonly insufficientRoleKey: string;
}) => {
  if (input.requiredRoles.length === 0 || hasAnyRole(input.user, input.requiredRoles)) {
    return;
  }

  emitAccessDeniedDiagnostic({
    diagnostics: input.diagnostics,
    route: input.route,
    reason: 'insufficient-role',
    fallbackPath: input.fallbackPath,
    requiredRoles: input.requiredRoles,
  });
  throwInsufficientAccessRedirect(input.fallbackPath, input.insufficientRoleKey);
};

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
  const diagnosticsRoute = 'route' in options && typeof options.route === 'string' ? options.route : null;

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
) =>
  createProtectedRoute<TContext>({
    ...options,
  });
