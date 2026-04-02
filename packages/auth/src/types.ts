export type SessionUser = {
  id: string;
  instanceId?: string;
  roles: string[];
};

export type SessionAuthContext = {
  instanceId?: string;
  issuer: string;
  clientId: string;
  authRealm?: string;
  postLogoutRedirectUri: string;
};

export type ForcedReauthMode = 'app_only' | 'app_and_idp';

export type Session = {
  id: string; // Session ID for storage/retrieval
  userId: string;
  user?: SessionUser;
  auth?: SessionAuthContext;
  activeOrganizationId?: string;
  accessToken?: string;
  createdAt: number; // Unix timestamp in milliseconds (Date.now())
  issuedAt?: number; // Unix timestamp in milliseconds (Date.now())
  sessionVersion?: number;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number; // Unix timestamp in milliseconds
};

export type LoginState = {
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

export type AuthConfig = {
  instanceId?: string;
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
