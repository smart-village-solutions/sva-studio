// This file exists so client and server code can share auth routes type-safely.
export type AuthRoutePath =
  | '/auth/login'
  | '/auth/callback'
  | '/auth/me'
  | '/auth/logout'
  | '/iam/governance/workflows'
  | '/iam/governance/compliance/export';

export const authRoutePaths = [
  '/auth/login',
  '/auth/callback',
  '/auth/me',
  '/auth/logout',
  '/iam/governance/workflows',
  '/iam/governance/compliance/export',
] as const satisfies readonly AuthRoutePath[];
