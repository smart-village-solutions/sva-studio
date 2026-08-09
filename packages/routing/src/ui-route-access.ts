import { redirect } from '@tanstack/react-router';
import type { PluginDefinition } from '@sva/plugin-sdk';

import type { RouteGuardContext } from './protected.routes.js';
import { buildLoginHref } from './protected-route-redirects.js';

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
    const grantedPermissions = new Set(user?.permissionActions ?? []);
    if (requirements.requiredPermissions.some((permission) => !grantedPermissions.has(permission))) {
      throw redirect({ href: '/?error=auth.insufficientRole' });
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
    throw redirect({ href: '/?error=auth.insufficientRole' });
  }
};
