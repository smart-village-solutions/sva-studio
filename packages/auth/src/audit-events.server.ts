import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

export type AuthAuditEventType = 'login' | 'logout' | 'account_created';

export type AuthAuditEvent = {
  eventType: AuthAuditEventType;
  actorUserId?: string;
  workspaceId?: string;
  outcome: 'success' | 'failure';
  requestId?: string;
  traceId?: string;
};

/**
 * Child A emits audit events to OTEL and prepares a DB-write hook for Child B.
 */
export const emitAuthAuditEvent = async (event: AuthAuditEvent): Promise<void> => {
  const context = getWorkspaceContext();
  const workspaceId = event.workspaceId ?? context.workspaceId ?? 'default';
  const requestId = event.requestId ?? context.requestId;
  const traceId = event.traceId;

  // OTEL sink (implemented in Child A)
  logger.info('Auth audit event emitted', {
    operation: 'audit_event',
    event_type: event.eventType,
    outcome: event.outcome,
    actor_user_id: event.actorUserId,
    workspace_id: workspaceId,
    request_id: requestId,
    trace_id: traceId,
    sink: 'otel',
  });

  // DB sink is intentionally deferred to Child B data-layer integration.
  logger.debug('Auth audit DB sink deferred', {
    operation: 'audit_event',
    event_type: event.eventType,
    workspace_id: workspaceId,
    request_id: requestId,
    trace_id: traceId,
    sink: 'db',
    status: 'deferred_child_b',
  });
};
