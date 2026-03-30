export type AuthAuditEventType =
  | 'login'
  | 'logout'
  | 'account_created'
  | 'forced_reauth'
  | 'silent_reauth_success'
  | 'silent_reauth_failed';

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
