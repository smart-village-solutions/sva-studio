import { evaluateAuthorizeDecision, type EffectivePermission } from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';

import { emitAuthAuditEvent } from '../../audit-events.js';
import { resolveEffectivePermissions } from '../../iam-authorization/permission-store.js';
import type { AuthenticatedRequestContext } from '../../middleware.js';
import { createApiError } from '../../shared/request-helpers.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { requireActorInstanceId } from './utils.js';

export const emitWasteAuditEvent = async (input: {
  readonly deps: WasteManagementHandlerDeps;
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly actionId: string;
  readonly result: 'success' | 'failure' | 'denied';
  readonly reasonCode?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
}) => {
  const context = getWorkspaceContext();
  await (input.deps.emitAuditEvent ?? emitAuthAuditEvent)({
    eventType:
      input.result === 'success'
        ? 'plugin_action_authorized'
        : input.result === 'denied'
          ? 'plugin_action_denied'
          : 'plugin_action_failed',
    actorUserId: input.ctx.user.id,
    actorEmail: input.ctx.user.email,
    actorDisplayName: input.ctx.user.displayName,
    scope: { kind: 'instance', instanceId: input.instanceId },
    workspaceId: input.instanceId,
    outcome: input.result,
    requestId: context.requestId,
    traceId: context.traceId,
    pluginAction: {
      actionId: input.actionId,
      actionNamespace: 'waste-management',
      actionOwner: 'waste-management',
      result: input.result,
      reasonCode: input.reasonCode,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    },
  });
};

export const authorizeWasteManagementAction = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  deps: WasteManagementHandlerDeps,
  requestId: string | undefined
): Promise<Response | null> => {
  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  let permissions: readonly EffectivePermission[];
  try {
    const resolved = await (deps.resolvePermissions ?? resolveEffectivePermissions)({
      instanceId,
      keycloakSubject: ctx.user.id,
    });
    if (!resolved.ok) {
      return createApiError(503, 'database_unavailable', 'Berechtigungen konnten nicht geprüft werden.', requestId);
    }
    permissions = resolved.permissions;
  } catch {
    return createApiError(503, 'database_unavailable', 'Berechtigungen konnten nicht geprüft werden.', requestId);
  }

  const decision = evaluateAuthorizeDecision(
    {
      instanceId,
      action,
      resource: { type: 'waste-management' },
      context: requestId ? { requestId } : undefined,
    },
    permissions
  );

  if (!decision.allowed) {
    return createApiError(403, 'forbidden', 'Keine Berechtigung für diese Waste-Management-Operation.', requestId, {
      action,
      reason_code: decision.reason,
    });
  }

  return null;
};
