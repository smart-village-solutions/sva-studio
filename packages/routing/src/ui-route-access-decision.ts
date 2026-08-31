import { createPermissionDenialDetails, type PermissionDenialDetails } from '@sva/core';
import type { PluginDefinition } from '@sva/plugin-sdk';

import type { RouteGuardUser } from './protected.routes.js';

export type PluginRouteAccessRequirement = NonNullable<
  PluginDefinition['routes'][number]['accessRequirement']
>;

type RouteAccessDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly permissionDenial?: PermissionDenialDetails };

const satisfiesRequiredValues = (
  required: Readonly<{ mode: 'allOf' | 'anyOf'; values: readonly string[] }>,
  available: ReadonlySet<string>
): boolean =>
  required.values.length > 0 && required.mode === 'allOf'
    ? required.values.every((value) => available.has(value))
    : required.values.length > 0 && required.values.some((value) => available.has(value));

const evaluatePlatformAccess = (
  requirement: Extract<PluginRouteAccessRequirement, { kind: 'platform' }>,
  user: RouteGuardUser
): RouteAccessDecision => ({
  allowed:
    !user.instanceId && satisfiesRequiredValues(requirement.roles, new Set(user.roles ?? [])),
});

const createTenantPermissionDenial = (
  requirement: Extract<PluginRouteAccessRequirement, { kind: 'tenant' }>,
  user: RouteGuardUser,
  grantedPermissions: ReadonlySet<string>
): PermissionDenialDetails | undefined => {
  const hasUntrustedStaticCapability = 'resourceCapability' in requirement;
  const permissionRequirementSatisfied = satisfiesRequiredValues(
    requirement.actions,
    grantedPermissions
  );
  const canNamePermissionRequirement =
    requirement.actions.values.length > 0 &&
    user.permissionActions !== undefined &&
    user.permissionStatus !== 'degraded' &&
    (!requirement.moduleId || user.assignedModules?.includes(requirement.moduleId));

  if (!canNamePermissionRequirement) {
    return undefined;
  }

  return createPermissionDenialDetails({
    requiredPermissions:
      requirement.actions.mode === 'allOf' && !permissionRequirementSatisfied
        ? requirement.actions.values.filter((permission) => !grantedPermissions.has(permission))
        : requirement.actions.values,
    requirementMode: requirement.actions.mode,
    denialReason:
      permissionRequirementSatisfied && hasUntrustedStaticCapability
        ? 'abac_condition_unmet'
        : 'permission_missing',
  });
};

const evaluateTenantAccess = (
  requirement: Extract<PluginRouteAccessRequirement, { kind: 'tenant' }>,
  user: RouteGuardUser
): RouteAccessDecision => {
  const grantedPermissions = new Set(user.permissionActions ?? []);
  const hasUntrustedStaticCapability = 'resourceCapability' in requirement;
  const allowed =
    Boolean(user.instanceId) &&
    user.permissionStatus !== 'degraded' &&
    (!requirement.moduleId || user.assignedModules?.includes(requirement.moduleId)) &&
    // Route guards do not receive the resource-scoped authorization evidence needed to
    // verify a capability. Keep access closed until the capability is evaluated server-side.
    !hasUntrustedStaticCapability &&
    satisfiesRequiredValues(requirement.actions, grantedPermissions);

  return allowed
    ? { allowed: true }
    : {
        allowed: false,
        permissionDenial: createTenantPermissionDenial(requirement, user, grantedPermissions),
      };
};

export const evaluateRouteAccessRequirement = (
  requirement: Exclude<PluginRouteAccessRequirement, { kind: 'public' }>,
  user: RouteGuardUser
): RouteAccessDecision => {
  if (requirement.kind === 'authenticated') {
    return { allowed: true };
  }
  return requirement.kind === 'platform'
    ? evaluatePlatformAccess(requirement, user)
    : evaluateTenantAccess(requirement, user);
};
