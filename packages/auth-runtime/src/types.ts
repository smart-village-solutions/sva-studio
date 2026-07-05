import type { IamUserGroupAssignment } from '@sva/core';

export type ScopeKind = 'platform' | 'instance';

export type PlatformScopeRef = {
  kind: 'platform';
};

export type InstanceScopeRef = {
  kind: 'instance';
  instanceId: string;
};

export type RuntimeScopeRef = PlatformScopeRef | InstanceScopeRef;

export const ACCOUNT_ACTION_INTENTS = ['update-password', 'update-email'] as const;

export type AccountActionIntent = (typeof ACCOUNT_ACTION_INTENTS)[number];

export type SessionUser = {
  id: string;
  instanceId?: string;
  roles: string[];
  keycloakRoles?: string[];
  permissionStatus?: 'ok' | 'degraded';
  groups?: readonly IamUserGroupAssignment[];
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
};

export type SessionAuthContext = RuntimeScopeRef & {
  issuer: string;
  clientId: string;
  authRealm?: string;
  redirectUri?: string;
  postLogoutRedirectUri: string;
};

export type ForcedReauthMode = 'app_only' | 'app_and_idp';

export type Session = {
  id: string;
  userId: string;
  user?: SessionUser;
  auth?: SessionAuthContext;
  activeOrganizationId?: string;
  accessToken?: string;
  createdAt: number;
  issuedAt?: number;
  sessionVersion?: number;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
  freshReauthAt?: number;
};

export type LoginState = RuntimeScopeRef & {
  codeVerifier: string;
  nonce: string;
  createdAt: number;
  returnTo?: string;
  silent?: boolean;
  freshReauthRequested?: boolean;
  accountActionIntent?: AccountActionIntent;
};

export type SessionControlState = {
  minimumSessionVersion: number;
  forcedReauthAt?: number;
  loginBlocked?: boolean;
  loginBlockedReason?:
    | 'account_lifecycle_blocked'
    | 'dsr_deletion_requested'
    | 'user_bulk_deactivated'
    | 'user_deactivated'
    | 'user_deleted'
    | 'user_status_inactivated';
};

export type ForceReauthInput = {
  userId: string;
  mode: ForcedReauthMode;
  reason: string;
  instanceId?: string;
};

export type AuthConfig = RuntimeScopeRef & {
  authRealm?: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  loginStateSecret: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string;
  sessionCookieName: string;
  loginStateCookieName: string;
  silentSsoSuppressCookieName: string;
  sessionTtlMs: number;
  sessionRedisTtlBufferMs: number;
  freshReauthWindowMs: number;
  silentSsoSuppressAfterLogoutMs: number;
};
