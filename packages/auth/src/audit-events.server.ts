import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';
import { persistAuthAuditEventToDb } from './audit-db-sink.server';
import type { AuthAuditEvent } from './audit-events.types';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

/**
 * Emits auth audit events to OTEL and DB sink (`iam.activity_logs`) for dual-write compliance.
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

  try {
    const dbResult = await persistAuthAuditEventToDb({
      ...event,
      workspaceId,
      requestId,
      traceId,
    });

    if (!dbResult.persisted) {
      logger.debug('Auth audit event skipped for DB sink', {
        operation: 'audit_event',
        event_type: event.eventType,
        workspace_id: workspaceId,
        request_id: requestId,
        trace_id: traceId,
        sink: 'db',
        status: 'skipped',
        reason: dbResult.reason,
      });
      return;
    }

    logger.info('Auth audit event persisted to DB sink', {
      operation: 'audit_event',
      event_type: event.eventType,
      additional_event_types: dbResult.writtenEventTypes.filter((entry) => entry !== event.eventType),
      workspace_id: workspaceId,
      request_id: requestId,
      trace_id: traceId,
      sink: 'db',
      status: 'persisted',
    });
  } catch (error) {
    logger.error('Auth audit DB sink failed', {
      operation: 'audit_event',
      event_type: event.eventType,
      workspace_id: workspaceId,
      request_id: requestId,
      trace_id: traceId,
      sink: 'db',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
