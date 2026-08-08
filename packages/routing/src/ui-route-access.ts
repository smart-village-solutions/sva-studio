import { redirect } from '@tanstack/react-router';
import type { PluginDefinition } from '@sva/plugin-sdk';

import type { RouteGuardContext } from './protected.routes.js';

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
  required.mode === 'allOf'
    ? required.values.every((value) => available.has(value))
    : required.values.some((value) => available.has(value));

export const enforcePluginRouteAccessRequirement = async (
  requirement: PluginRouteAccessRequirement | undefined,
  beforeLoadOptions: { readonly context: RouteGuardContext }
): Promise<void> => {
  if (!requirement || requirement.kind === 'public') {
    return;
  }

  const user = await beforeLoadOptions.context.auth?.getUser();
  if (!user) {
    throw redirect({ href: '/?error=auth.insufficientRole' });
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
        !requirement.resourceCapability &&
        satisfiesRequiredValues(requirement.actions, new Set(user.permissionActions ?? []));

  if (!allowed) {
    throw redirect({ href: '/?error=auth.insufficientRole' });
  }
};
