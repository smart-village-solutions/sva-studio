// This file exists so client and server code can share auth routes type-safely.
export type AuthRoutePath = '/auth/login' | '/auth/callback' | '/auth/me' | '/auth/logout';

export const authRoutePaths = [
  '/auth/login',
  '/auth/callback',
  '/auth/me',
  '/auth/logout',
] as const satisfies readonly AuthRoutePath[];
