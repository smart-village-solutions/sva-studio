import { redirect } from '@tanstack/react-router';
import { createPermissionDenialDetails } from '@sva/core';
import type { PluginDefinition } from '@sva/plugin-sdk';

import type { RouteGuardContext } from './protected.routes.js';
import { buildInsufficientRoleHref, buildLoginHref } from './protected-route-redirects.js';

type PluginRouteAccessRequirement = NonNullable<
  PluginDefinition['routes'][number]['accessRequirement']
>;

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

  if (requirements.requiredModuleId && !user?.assignedModules?.includes(requirements.requiredModuleId)) {
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

const satisfiesRequiredValues = (
  required: Readonly<{ mode: 'allOf' | 'anyOf'; values: readonly string[] }>,
  available: ReadonlySet<string>
): boolean =>
  required.values.length > 0 && required.mode === 'allOf'
    ? required.values.every((value) => available.has(value))
    : required.values.length > 0 && required.values.some((value) => available.has(value));

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
  if (requirement.kind === 'authenticated') {
    return;
  }

  const allowed =
    requirement.kind === 'platform'
      ? !user.instanceId && satisfiesRequiredValues(requirement.roles, new Set(user.roles ?? []))
      : Boolean(user.instanceId) &&
        user.permissionStatus !== 'degraded' &&
        (!requirement.moduleId || user.assignedModules?.includes(requirement.moduleId)) &&
        // Route guards do not receive the resource-scoped authorization evidence needed to
        // verify a capability. Keep access closed until the capability is evaluated server-side.
        !requirement.resourceCapability &&
        satisfiesRequiredValues(requirement.actions, new Set(user.permissionActions ?? []));

  if (!allowed) {
    const grantedPermissions = new Set(user.permissionActions ?? []);
    const permissionRequirementSatisfied =
      requirement.kind === 'tenant'
        ? satisfiesRequiredValues(requirement.actions, grantedPermissions)
        : false;
    const tenantPermissionDenial =
      requirement.kind === 'tenant' &&
      requirement.actions.values.length > 0 &&
      user.permissionActions !== undefined &&
      user.permissionStatus !== 'degraded' &&
      (!requirement.moduleId || user.assignedModules?.includes(requirement.moduleId))
        ? createPermissionDenialDetails({
            requiredPermissions:
              requirement.actions.mode === 'allOf' && !permissionRequirementSatisfied
                ? requirement.actions.values.filter(
                    (permission) => !grantedPermissions.has(permission)
                  )
                : requirement.actions.values,
            requirementMode: requirement.actions.mode,
            denialReason:
              permissionRequirementSatisfied && requirement.resourceCapability
                ? 'abac_condition_unmet'
                : 'permission_missing',
          })
        : undefined;
    throw redirect({
      href: buildInsufficientRoleHref('/', 'auth.insufficientRole', tenantPermissionDenial),
    });
  }
};
