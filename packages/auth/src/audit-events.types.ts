export type AuthAuditEventType =
  | 'login'
  | 'logout'
  | 'account_created'
  | 'session_created'
  | 'session_deleted'
  | 'login_state_created'
  | 'login_state_consumed'
  | 'login_state_expired'
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
