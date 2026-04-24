export const authRuntimeVersion = '0.0.1';

export type AuthRuntimePackageRole = 'login' | 'logout' | 'oidc' | 'session' | 'auth-middleware';

export const authRuntimePackageRoles = [
  'login',
  'logout',
  'oidc',
  'session',
  'auth-middleware',
] as const satisfies readonly AuthRuntimePackageRole[];
