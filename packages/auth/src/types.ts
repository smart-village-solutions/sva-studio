export type SessionUser = {
  id: string;
  name: string;
  email?: string;
  roles: string[];
};

export type Session = {
  id: string; // Session ID for storage/retrieval
  userId: string;
  user?: SessionUser;
  accessToken?: string;
  createdAt: number; // Unix timestamp in milliseconds (Date.now())
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number; // Unix timestamp in milliseconds
};

export type LoginState = {
  codeVerifier: string;
  nonce: string;
  createdAt: number;
};

export type AuthConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  loginStateSecret: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string;
  sessionCookieName: string;
  loginStateCookieName: string;
  sessionTtlMs: number;
};
