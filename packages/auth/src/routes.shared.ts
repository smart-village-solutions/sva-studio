// This file exists so client and server code can share auth routes type-safely.
export type AuthRoutePath =
  | '/auth/login'
  | '/auth/callback'
  | '/auth/me'
  | '/auth/logout'
  | '/iam/me/permissions'
  | '/iam/authorize'
  | '/iam/governance/workflows'
  | '/iam/governance/compliance/export'
  | '/iam/me/data-export'
  | '/iam/me/data-export/status'
  | '/iam/me/data-subject-rights/requests'
  | '/iam/me/profile'
  | '/iam/me/optional-processing/execute'
  | '/iam/admin/data-subject-rights/export'
  | '/iam/admin/data-subject-rights/export/status'
  | '/iam/admin/data-subject-rights/legal-holds/apply'
  | '/iam/admin/data-subject-rights/legal-holds/release'
  | '/iam/admin/data-subject-rights/maintenance';

export const authRoutePaths = [
  '/auth/login',
  '/auth/callback',
  '/auth/me',
  '/auth/logout',
  '/iam/me/permissions',
  '/iam/authorize',
  '/iam/governance/workflows',
  '/iam/governance/compliance/export',
  '/iam/me/data-export',
  '/iam/me/data-export/status',
  '/iam/me/data-subject-rights/requests',
  '/iam/me/profile',
  '/iam/me/optional-processing/execute',
  '/iam/admin/data-subject-rights/export',
  '/iam/admin/data-subject-rights/export/status',
  '/iam/admin/data-subject-rights/legal-holds/apply',
  '/iam/admin/data-subject-rights/legal-holds/release',
  '/iam/admin/data-subject-rights/maintenance',
] as const satisfies readonly AuthRoutePath[];
