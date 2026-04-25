import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { persistAuthAuditEventToDb } from './audit-db-sink.js';
import type { AuthAuditEvent } from './audit-events.types.js';
import { getRuntimeScopeRef, getWorkspaceIdForScope } from './scope.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const getAuditLogContext = (input: {
  event: AuthAuditEvent;
  scope?: ReturnType<typeof getRuntimeScopeRef>;
  workspaceId: string;
  requestId?: string;
  traceId?: string;
}) => ({
  operation: 'audit_event',
  scope_kind: input.scope?.kind,
  ...(input.scope?.kind === 'instance' ? { instance_id: input.scope.instanceId } : {}),
  event_type: input.event.eventType,
  workspace_id: input.workspaceId,
  request_id: input.requestId,
  trace_id: input.traceId,
      ...(input.event.pluginAction
    ? {
        action_id: input.event.pluginAction.actionId,
        action_namespace: input.event.pluginAction.actionNamespace,
        action_owner: input.event.pluginAction.actionOwner,
        plugin_action_result: input.event.pluginAction.result,
        reason_code: input.event.pluginAction.reasonCode,
      }
    : {}),
});

const getDbAuditReasonCode = (scope?: ReturnType<typeof getRuntimeScopeRef>) =>
  scope?.kind === 'platform' ? 'platform_audit_unavailable' : 'tenant_audit_unavailable';

/**
 * Emits auth audit events to OTEL and the scope-aware DB sink for dual-write compliance.
 */
export const emitAuthAuditEvent = async (event: AuthAuditEvent): Promise<void> => {
  const context = getWorkspaceContext();
  const scope =
    event.scope
    ?? getRuntimeScopeRef({ workspaceId: event.workspaceId ?? context.workspaceId });
  const workspaceId = getWorkspaceIdForScope(scope) ?? event.workspaceId ?? context.workspaceId ?? 'default';
  const requestId = event.requestId ?? context.requestId;
  const traceId = event.traceId ?? context.traceId;
  const logContext = getAuditLogContext({
    event,
    scope,
    workspaceId,
    requestId,
    traceId,
  });

  // OTEL sink (implemented in Child A)
  logger.info('Auth audit event emitted', {
    ...logContext,
    outcome: event.outcome,
    actor_user_id: event.actorUserId,
    sink: 'otel',
  });

  try {
    const dbResult = await persistAuthAuditEventToDb({
      ...event,
      ...(scope ? { scope } : {}),
      workspaceId,
      requestId,
      traceId,
    });

    if (!dbResult.persisted) {
      logger.debug('Auth audit event skipped for DB sink', {
        ...logContext,
        sink: 'db',
        status: 'skipped',
        reason: dbResult.reason,
      });
      return;
    }

    logger.info('Auth audit event persisted to DB sink', {
      ...logContext,
      additional_event_types: dbResult.writtenEventTypes.filter((entry) => entry !== event.eventType),
      sink: 'db',
      status: 'persisted',
    });
  } catch (error) {
    logger.error('Auth audit DB sink failed', {
      ...logContext,
      sink: 'db',
      status: 'failed',
      error_type: error instanceof Error ? error.name : typeof error,
      reason_code: getDbAuditReasonCode(scope),
    });
  }
};
