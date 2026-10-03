import { evaluateUiAccess, type EffectivePermission } from '@sva/iam-core';
import type { PluginServerHandlerRegistryEntry } from '@sva/plugin-sdk';
import { getWorkspaceContext } from '@sva/server-runtime';

import { createApiError } from '../api-error.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { readConfiguredPluginTenantAccess } from '../plugin-tenant-lifecycle/access.js';
import type { PluginServerHandlerDispatcherDependencies } from './dispatcher.js';
import type { PluginServerHandlerMessageKey } from './messages.js';
import { isDomainHandler } from './routes.js';
import { authorizeDomainHandler } from './domain-authorization.js';

const createError = (
  request: Request,
  translate: NonNullable<PluginServerHandlerDispatcherDependencies['translate']>,
  status: number,
  code: 'forbidden' | 'database_unavailable',
  messageKey: PluginServerHandlerMessageKey
) => createApiError(status, code, translate(request, messageKey), getWorkspaceContext().requestId);

const isCollectionCapablePermission = (permission: EffectivePermission): boolean =>
  permission.accessScope !== 'own' &&
  permission.resourceId === undefined &&
  permission.geoScope === undefined &&
  (permission.scope === undefined || Object.keys(permission.scope).length === 0);

export type TenantAuthorizationInput = {
  readonly context: AuthenticatedRequestContext;
  readonly descriptor: PluginServerHandlerRegistryEntry;
  readonly readTenantAccess: typeof readConfiguredPluginTenantAccess;
  readonly resolvePermissions: NonNullable<
    PluginServerHandlerDispatcherDependencies['resolvePermissions']
  >;
  readonly request: Request;
  readonly resolveResourceCapability:
    PluginServerHandlerDispatcherDependencies['resolveResourceCapability'] | undefined;
  readonly translate: NonNullable<PluginServerHandlerDispatcherDependencies['translate']>;
};

export const authorizeTenantHandler = async (
  input: TenantAuthorizationInput
): Promise<Response | null> => {
  const requirement = input.descriptor.accessRequirement;
  if (requirement.kind !== 'tenant') {
    return createError(
      input.request,
      input.translate,
      403,
      'forbidden',
      'instanceScopeUnavailable'
    );
  }
  const instanceId = input.context.user.instanceId;
  if (isDomainHandler(input.descriptor))
    return authorizeDomainHandler(input, instanceId, requirement);
  if (!instanceId || requirement.moduleId !== input.descriptor.ownerPluginId) {
    return createError(input.request, input.translate, 403, 'forbidden', 'invalidInstanceContext');
  }
  const tenantAccess = await input.readTenantAccess(instanceId, input.descriptor.ownerPluginId);
  if (!tenantAccess.allowed) {
    return createError(input.request, input.translate, 403, 'forbidden', 'pluginUnavailable');
  }
  if (requirement.resourceContext === 'collection' && !input.context.activeOrganizationId) {
    return createError(input.request, input.translate, 403, 'forbidden', 'invalidInstanceContext');
  }
  const resolved = await input.resolvePermissions({
    instanceId,
    keycloakSubject: input.context.user.id,
    organizationId: input.context.activeOrganizationId,
  });
  if (!resolved.ok) {
    return createError(
      input.request,
      input.translate,
      503,
      'database_unavailable',
      'permissionCheckUnavailable'
    );
  }
  const effectivePermissions =
    requirement.resourceContext === 'collection'
      ? resolved.permissions.filter(isCollectionCapablePermission)
      : resolved.permissions;
  const resourceCapability = input.resolveResourceCapability
    ? await input.resolveResourceCapability({
        request: input.request,
        descriptor: input.descriptor,
        instanceId,
        ...(input.context.activeOrganizationId
          ? { organizationId: input.context.activeOrganizationId }
          : {}),
        actorAccountId: input.context.user.id,
      })
    : undefined;
  const decision = evaluateUiAccess({
    isAuthenticated: true,
    requirement,
    ...(resourceCapability ? { resourceCapability } : {}),
    snapshot: {
      status: 'ready',
      generation: 0,
      scope: {
        kind: 'tenant',
        authGeneration: 0,
        instanceId,
        organizationId: input.context.activeOrganizationId ?? null,
        moduleAssignmentGeneration: 0,
      },
      assignedModules: [input.descriptor.ownerPluginId],
      permissions: effectivePermissions as readonly EffectivePermission[],
    },
  });
  return decision.status === 'allowed'
    ? null
    : createError(input.request, input.translate, 403, 'forbidden', 'permissionDenied');
};
