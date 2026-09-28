import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from './types.js';
import type { WasteAuditEvent, WasteManagementHandlerDeps } from './types.js';
import { requireActorInstanceId, requireDeps } from './utils.js';

export const emitWasteAuditEvent = async (input: {
  readonly deps: WasteManagementHandlerDeps;
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly actionId: string;
  readonly result: 'success' | 'failure' | 'denied';
  readonly reasonCode?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly requestId?: string;
  readonly batchSummary?: WasteAuditEvent['pluginAction']['batchSummary'];
}) => {
  const context = getWorkspaceContext();
  await requireDeps(input.deps.emitAuditEvent, 'emitAuditEvent')({
    eventType:
      input.result === 'success'
        ? 'plugin_action_authorized'
        : input.result === 'denied'
          ? 'plugin_action_denied'
          : 'plugin_action_failed',
    scope: { kind: 'instance', instanceId: input.instanceId },
    workspaceId: input.instanceId,
    outcome: input.result,
    requestId: input.requestId ?? context.requestId,
    traceId: context.traceId,
    pluginAction: {
      actionId: input.actionId,
      actionNamespace: 'waste-management',
      actionOwner: 'waste-management',
      result: input.result,
      reasonCode: input.reasonCode,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      batchSummary: input.batchSummary,
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

  return requireDeps(deps.authorizeAction, 'authorizeAction')({
    instanceId,
    keycloakSubject: ctx.user.id,
    action,
    requestId,
  });
};

export const getAuthorizedWasteManagementInstanceId = (ctx: AuthenticatedRequestContext): string =>
  ctx.user.instanceId as string;
