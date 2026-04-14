import { redirect } from '@tanstack/react-router';

export type RouteGuardUser = {
  readonly roles: readonly string[];
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
  } = options;

  return async ({ context, location }: BeforeLoadOptions<TContext>) => {
    const user = await context.auth?.getUser();

    if (!user) {
      throw redirect({ href: buildLoginHref(loginPath, location.href) });
    }

    if (requiredRoles.length > 0 && !hasAnyRole(user, requiredRoles)) {
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
