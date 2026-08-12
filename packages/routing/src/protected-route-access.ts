import { redirect } from '@tanstack/react-router';
import { createPermissionDenialDetails, type PermissionDenialDetails } from '@sva/core';

import type { RoutingDiagnosticsHook } from './diagnostics.js';
import { emitRoutingDiagnostic } from './diagnostics.js';
import type { RouteGuardUser } from './protected.routes.js';
import {
  buildInsufficientRoleHref,
  sanitizePathForDiagnostics,
} from './protected-route-redirects.js';

const DEFAULT_FALLBACK_PATH = '/';

const sanitizeRequiredRoles = (requiredRoles: readonly string[]): readonly string[] =>
  requiredRoles
    .map((requiredRole) => {
      const segments = requiredRole.split(':').filter(Boolean);
      return segments[segments.length - 1];
    })
    .filter(
      (requiredRole): requiredRole is string =>
        typeof requiredRole === 'string' && requiredRole.length > 0
    );

const hasAnyRole = (user: RouteGuardUser, requiredRoles: readonly string[]) =>
  requiredRoles.some((requiredRole) => user.roles.includes(requiredRole));

export const requiresPermissionSnapshot = (input: {
  readonly user: RouteGuardUser;
  readonly requiredPermissions: readonly string[];
  readonly requiredAnyPermissions: readonly string[];
  readonly requiredAnyRoles: readonly string[];
}): boolean =>
  input.requiredPermissions.length > 0 ||
  (input.requiredAnyPermissions.length > 0 && !hasAnyRole(input.user, input.requiredAnyRoles));

export const emitAccessDeniedDiagnostic = (input: {
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

const throwInsufficientAccessRedirect = (
  fallbackPath: string,
  insufficientRoleKey: string,
  permissionDenial?: PermissionDenialDetails
): never => {
  throw redirect({
    href: buildInsufficientRoleHref(fallbackPath, insufficientRoleKey, permissionDenial),
  });
};

type AccessAssertionInput = {
  readonly user: RouteGuardUser;
  readonly requiredPermissions: readonly string[];
  readonly diagnostics: RoutingDiagnosticsHook | undefined;
  readonly route: string | null;
  readonly fallbackPath: string;
  readonly insufficientRoleKey: string;
};

export const assertAllRequiredPermissions = (input: AccessAssertionInput) => {
  if (input.requiredPermissions.length === 0) {
    return;
  }
  if (!input.user.permissionActions) {
    emitAccessDeniedDiagnostic({
      diagnostics: input.diagnostics,
      route: input.route,
      reason: 'insufficient-permission',
      fallbackPath: input.fallbackPath,
      requiredPermissions: input.requiredPermissions,
    });
    throwInsufficientAccessRedirect(input.fallbackPath, input.insufficientRoleKey);
  }
  const grantedPermissions = new Set(input.user.permissionActions);
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
  throwInsufficientAccessRedirect(
    input.fallbackPath,
    input.insufficientRoleKey,
    createPermissionDenialDetails({ requiredPermissions: missingPermissions })
  );
};

export const assertAnyRequiredAccess = (
  input: AccessAssertionInput & { readonly requiredRoles: readonly string[] }
) => {
  if (
    (input.requiredPermissions.length === 0 && input.requiredRoles.length === 0) ||
    hasAnyRole(input.user, input.requiredRoles)
  ) {
    return;
  }
  if (input.requiredPermissions.length > 0 && !input.user.permissionActions) {
    emitAccessDeniedDiagnostic({
      diagnostics: input.diagnostics,
      route: input.route,
      reason: 'insufficient-permission',
      fallbackPath: input.fallbackPath,
      requiredPermissions: input.requiredPermissions,
      requiredRoles: input.requiredRoles.length > 0 ? input.requiredRoles : undefined,
    });
    throwInsufficientAccessRedirect(input.fallbackPath, input.insufficientRoleKey);
  }
  const grantedPermissions = new Set(input.user.permissionActions ?? []);
  if (input.requiredPermissions.some((permission) => grantedPermissions.has(permission))) {
    return;
  }

  emitAccessDeniedDiagnostic({
    diagnostics: input.diagnostics,
    route: input.route,
    reason: input.requiredPermissions.length > 0 ? 'insufficient-permission' : 'insufficient-role',
    fallbackPath: input.fallbackPath,
    requiredPermissions:
      input.requiredPermissions.length > 0 ? input.requiredPermissions : undefined,
    requiredRoles: input.requiredRoles.length > 0 ? input.requiredRoles : undefined,
  });
  throwInsufficientAccessRedirect(
    input.fallbackPath,
    input.insufficientRoleKey,
    input.requiredPermissions.length > 0 && input.requiredRoles.length === 0
      ? createPermissionDenialDetails({
          requiredPermissions: input.requiredPermissions,
          requirementMode: 'anyOf',
        })
      : undefined
  );
};

export const assertRequiredRoles = (
  input: Omit<AccessAssertionInput, 'requiredPermissions'> & {
    readonly requiredRoles: readonly string[];
  }
) => {
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
  return throwInsufficientAccessRedirect(input.fallbackPath, input.insufficientRoleKey);
};

export const throwPermissionSnapshotUnavailable = (input: {
  readonly diagnostics: RoutingDiagnosticsHook | undefined;
  readonly route: string | null;
  readonly fallbackPath: string;
  readonly insufficientRoleKey: string;
  readonly requiredPermissions: readonly string[];
}): never => {
  emitAccessDeniedDiagnostic({
    diagnostics: input.diagnostics,
    route: input.route,
    reason: 'insufficient-permission',
    fallbackPath: input.fallbackPath,
    requiredPermissions: input.requiredPermissions,
  });
  return throwInsufficientAccessRedirect(input.fallbackPath, input.insufficientRoleKey);
};
