import type { RuntimeScopeRef } from './types.js';

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
  | 'silent_reauth_failed'
  | 'plugin_action_authorized'
  | 'plugin_action_denied'
  | 'plugin_action_failed';

export type PluginActionAuditPayload = {
  actionId: string;
  actionNamespace: string;
  actionOwner: string;
  result: 'success' | 'failure' | 'denied';
  reasonCode?: string;
  resourceType?: string;
  resourceId?: string;
};

export type AuthAuditEvent = {
  eventType: AuthAuditEventType;
  actorUserId?: string;
  actorEmail?: string;
  actorDisplayName?: string;
  scope?: RuntimeScopeRef;
  workspaceId?: string;
  outcome: 'success' | 'failure' | 'denied';
  requestId?: string;
  traceId?: string;
  pluginAction?: PluginActionAuditPayload;
};
