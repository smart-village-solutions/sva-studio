export type ScopeKind = 'platform' | 'instance';

export type PlatformScopeRef = {
  kind: 'platform';
};

export type InstanceScopeRef = {
  kind: 'instance';
  instanceId: string;
};

export type RuntimeScopeRef = PlatformScopeRef | InstanceScopeRef;

export type SessionUser = {
  id: string;
  instanceId?: string;
  roles: string[];
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
};

export type LoginState = RuntimeScopeRef & {
  codeVerifier: string;
  nonce: string;
  createdAt: number;
  returnTo?: string;
  silent?: boolean;
};

export type SessionControlState = {
  minimumSessionVersion: number;
  forcedReauthAt?: number;
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
  silentSsoSuppressAfterLogoutMs: number;
};
