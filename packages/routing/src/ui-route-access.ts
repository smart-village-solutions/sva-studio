import { redirect } from '@tanstack/react-router';

import type { RouteGuardContext } from './protected.routes.js';

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
