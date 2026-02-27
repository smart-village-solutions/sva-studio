export type AuthAuditEventType = 'login' | 'logout' | 'account_created';

export type AuthAuditEvent = {
  eventType: AuthAuditEventType;
  actorUserId?: string;
  actorEmail?: string;
  actorDisplayName?: string;
  workspaceId?: string;
  outcome: 'success' | 'failure';
  requestId?: string;
  traceId?: string;
};
