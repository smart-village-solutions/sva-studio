export type SessionUser = {
  id: string;
  name: string;
  email?: string;
  roles: string[];
};

export type Session = {
  userId: string;
  user?: SessionUser;
  accessToken?: string;
  createdAt: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: string;
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
