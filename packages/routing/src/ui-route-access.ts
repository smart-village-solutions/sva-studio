import { redirect } from '@tanstack/react-router';
import { createPermissionDenialDetails } from '@sva/core';
import type { RouteGuardContext } from './protected.routes.js';
import { buildInsufficientRoleHref, buildLoginHref } from './protected-route-redirects.js';
import {
  evaluateRouteAccessRequirement,
  type PluginRouteAccessRequirement,
} from './ui-route-access-decision.js';

export type UiRouteAccessRequirements = {
  readonly requiredModuleId?: string;
  readonly requiredPermissions?: readonly string[];
};

export const enforceUiRouteAccessRequirements = async (
  requirements: UiRouteAccessRequirements,
  beforeLoadOptions: { readonly context: RouteGuardContext }
): Promise<void> => {
  if (!requirements.requiredModuleId && !requirements.requiredPermissions?.length) {
    return;
  }

  const user = await beforeLoadOptions.context.auth?.getUser();

  if (user?.permissionStatus === 'degraded') {
    throw redirect({ href: '/?error=auth.insufficientRole' });
  }

  if (
    requirements.requiredModuleId &&
    !user?.assignedModules?.includes(requirements.requiredModuleId)
  ) {
    throw redirect({ href: '/?error=auth.insufficientRole' });
  }

  if (requirements.requiredPermissions?.length) {
    if (!user?.permissionActions) {
      throw redirect({ href: '/?error=auth.insufficientRole' });
    }
    const grantedPermissions = new Set(user?.permissionActions ?? []);
    const missingPermissions = requirements.requiredPermissions.filter(
      (permission) => !grantedPermissions.has(permission)
    );
    if (missingPermissions.length > 0) {
      throw redirect({
        href: buildInsufficientRoleHref(
          '/',
          'auth.insufficientRole',
          createPermissionDenialDetails({ requiredPermissions: missingPermissions })
        ),
      });
    }
  }
};

export const enforceRouteAccessRequirement = async (
  requirement: PluginRouteAccessRequirement | undefined,
  beforeLoadOptions: {
    readonly context: RouteGuardContext;
    readonly location: { readonly href: string };
  }
): Promise<void> => {
  if (!requirement || requirement.kind === 'public') {
    return;
  }

  const user = await beforeLoadOptions.context.auth?.getUser();
  if (!user) {
    throw redirect({ href: buildLoginHref('/auth/login', beforeLoadOptions.location.href) });
  }
  const decision = evaluateRouteAccessRequirement(requirement, user);
  if (!decision.allowed) {
    throw redirect({
      href: buildInsufficientRoleHref('/', 'auth.insufficientRole', decision.permissionDenial),
    });
  }
};
