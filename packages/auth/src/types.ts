export type SessionUser = {
  id: string;
  name: string;
  email?: string;
  roles: string[];
};

export type Session = {
  id: string;
  user: SessionUser;
  accessToken: string;
  createdAt: number;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
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
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string;
  sessionCookieName: string;
  loginStateCookieName: string;
  sessionTtlMs: number;
};
