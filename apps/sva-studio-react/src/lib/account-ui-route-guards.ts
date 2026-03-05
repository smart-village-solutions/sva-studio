import { redirect } from '@tanstack/react-router';

type RouteGuardUser = {
  readonly roles: readonly string[];
};

type RouteGuardContext = {
  readonly auth?: {
    readonly getUser: () => Promise<RouteGuardUser | null> | RouteGuardUser | null;
  };
};

type BeforeLoadOptions = {
  readonly context: RouteGuardContext;
  readonly location: {
    readonly href: string;
  };
};

const buildLoginHref = (returnTo: string) => {
  const url = new URL('/auth/login', 'http://local');
  url.searchParams.set('redirect', returnTo);
  return `${url.pathname}${url.search}`;
};

const buildInsufficientRoleHref = () => {
  const url = new URL('/', 'http://local');
  url.searchParams.set('error', 'auth.insufficientRole');
  return `${url.pathname}${url.search}`;
};

const hasAnyRole = (user: RouteGuardUser, requiredRoles: readonly string[]) =>
  requiredRoles.some((requiredRole) => user.roles.includes(requiredRole));

const createGuard = (requiredRoles: readonly string[]) => {
  return async ({ context, location }: BeforeLoadOptions) => {
    const user = await context.auth?.getUser();
    if (!user) {
      throw redirect({ href: buildLoginHref(location.href) });
    }

    if (requiredRoles.length > 0 && !hasAnyRole(user, requiredRoles)) {
      throw redirect({ href: buildInsufficientRoleHref() });
    }
  };
};

export const accountUiRouteGuards = {
  account: createGuard([]),
  adminUsers: createGuard(['system_admin', 'app_manager']),
  adminUserDetail: createGuard(['system_admin', 'app_manager']),
  adminRoles: createGuard(['system_admin']),
} as const;
