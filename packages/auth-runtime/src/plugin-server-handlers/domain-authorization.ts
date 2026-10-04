import { evaluateAuthorizeDecision } from '@sva/iam-core';
import { createPermissionDenialDetailsForAction } from '@sva/core';
import type { PluginServerHandlerRegistryEntry } from '@sva/plugin-sdk';
import { getWorkspaceContext } from '@sva/server-runtime';

import { createApiError } from '../api-error.js';
import { translatePluginTenantLifecycleMessage } from '../plugin-tenant-lifecycle/messages.js';
import type { TenantAuthorizationInput } from './tenant-authorization.js';

const createDomainError = (
  input: TenantAuthorizationInput,
  messageKey: 'invalidInstanceContext' | 'permissionDenied'
) =>
  createApiError(
    403,
    'forbidden',
    input.translate(input.request, messageKey),
    getWorkspaceContext().requestId
  );

export const authorizeDomainHandler = async (
  input: TenantAuthorizationInput,
  instanceId: string | undefined,
  requirement: Extract<PluginServerHandlerRegistryEntry['accessRequirement'], { kind: 'tenant' }>
): Promise<Response | null> => {
  if (!instanceId?.trim()) {
    return createApiError(
      400,
      'invalid_instance_id',
      'Instanzkontext fehlt.',
      getWorkspaceContext().requestId
    );
  }
  if (requirement.moduleId !== input.descriptor.ownerPluginId) {
    return createDomainError(input, 'invalidInstanceContext');
  }
  const tenantAccess = await input.readTenantAccess(instanceId, input.descriptor.ownerPluginId);
  if (!tenantAccess.allowed) {
    return createApiError(
      409,
      'plugin_tenant_access_blocked',
      translatePluginTenantLifecycleMessage(input.request, 'pluginAccessBlocked'),
      getWorkspaceContext().requestId,
      { reason_code: tenantAccess.reason }
    );
  }
  let resolved: Awaited<ReturnType<TenantAuthorizationInput['resolvePermissions']>>;
  try {
    resolved = await input.resolvePermissions({
      instanceId,
      keycloakSubject: input.context.user.id,
    });
  } catch {
    return createApiError(
      503,
      'database_unavailable',
      'Berechtigungen konnten nicht geprüft werden.',
      getWorkspaceContext().requestId
    );
  }
  if (!resolved.ok) {
    return createApiError(
      503,
      'database_unavailable',
      'Berechtigungen konnten nicht geprüft werden.',
      getWorkspaceContext().requestId
    );
  }
  const decisions = requirement.actions.values.map((action) => ({
    action,
    decision: evaluateAuthorizeDecision(
      {
        instanceId,
        action,
        resource: { type: input.descriptor.ownerPluginId },
        context: { requestId: getWorkspaceContext().requestId },
      },
      resolved.permissions
    ),
  }));
  const allowed =
    requirement.actions.mode === 'allOf'
      ? decisions.every(({ decision }) => decision.allowed)
      : decisions.some(({ decision }) => decision.allowed);
  if (allowed) return null;
  const denied = decisions.find(({ decision }) => !decision.allowed);
  if (!denied) return createDomainError(input, 'permissionDenied');
  return createApiError(
    403,
    'forbidden',
    'Keine Berechtigung für diese Waste-Management-Operation.',
    getWorkspaceContext().requestId,
    {
      ...createPermissionDenialDetailsForAction(denied.action, denied.decision.reason),
      action: denied.action,
      reason_code: denied.decision.reason,
    }
  );
};
