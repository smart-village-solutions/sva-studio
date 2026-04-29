// This file exists so client and server code can share auth routes type-safely.
export type AuthRoutePath =
  | '/auth/login'
  | '/auth/callback'
  | '/auth/me'
  | '/auth/logout'
  | '/api/v1/iam/health/ready'
  | '/api/v1/iam/health/live'
  | '/health/ready'
  | '/health/live'
  | '/iam/me/permissions'
  | '/iam/authorize'
  | '/api/v1/iam/users'
  | '/api/v1/iam/users/sync-keycloak'
  | '/api/v1/iam/users/$userId'
  | '/api/v1/iam/users/$userId/timeline'
  | '/api/v1/iam/users/bulk-deactivate'
  | '/api/v1/iam/users/me/profile'
  | '/api/v1/iam/organizations'
  | '/api/v1/iam/organizations/$organizationId'
  | '/api/v1/iam/organizations/$organizationId/memberships'
  | '/api/v1/iam/organizations/$organizationId/memberships/$accountId'
  | '/api/v1/iam/me/context'
  | '/api/v1/iam/permissions'
  | '/api/v1/iam/roles'
  | '/api/v1/iam/roles/$roleId'
  | '/api/v1/iam/groups'
  | '/api/v1/iam/groups/$groupId'
  | '/api/v1/iam/groups/$groupId/roles'
  | '/api/v1/iam/groups/$groupId/roles/$roleId'
  | '/api/v1/iam/groups/$groupId/memberships'
  | '/api/v1/iam/instances'
  | '/api/v1/iam/instances/$instanceId'
  | '/api/v1/iam/instances/$instanceId/keycloak/status'
  | '/api/v1/iam/instances/$instanceId/keycloak/preflight'
  | '/api/v1/iam/instances/$instanceId/keycloak/plan'
  | '/api/v1/iam/instances/$instanceId/keycloak/execute'
  | '/api/v1/iam/instances/$instanceId/keycloak/runs/$runId'
  | '/api/v1/iam/instances/$instanceId/keycloak/reconcile'
  | '/api/v1/iam/instances/$instanceId/tenant-iam/access-probe'
  | '/api/v1/iam/instances/$instanceId/activate'
  | '/api/v1/iam/instances/$instanceId/suspend'
  | '/api/v1/iam/instances/$instanceId/archive'
  | '/api/v1/iam/contents'
  | '/api/v1/iam/contents/$contentId'
  | '/api/v1/iam/contents/$contentId/history'
  | '/api/v1/iam/legal-texts'
  | '/api/v1/iam/legal-texts/$legalTextVersionId'
  | '/api/v1/iam/admin/reconcile'
  | '/iam/governance/workflows'
  | '/iam/governance/compliance/export'
  | '/iam/me/data-export'
  | '/iam/me/data-export/status'
  | '/iam/me/data-subject-rights/requests'
  | '/iam/me/legal-texts/pending'
  | '/iam/me/profile'
  | '/iam/me/optional-processing/execute'
  | '/iam/admin/data-subject-rights/export'
  | '/iam/admin/data-subject-rights/export/status'
  | '/iam/admin/data-subject-rights/cases'
  | '/iam/admin/data-subject-rights/legal-holds/apply'
  | '/iam/admin/data-subject-rights/legal-holds/release'
  | '/iam/admin/data-subject-rights/maintenance';

export const authRoutePaths = [
  '/auth/login',
  '/auth/callback',
  '/auth/me',
  '/auth/logout',
  '/api/v1/iam/health/ready',
  '/api/v1/iam/health/live',
  '/health/ready',
  '/health/live',
  '/iam/me/permissions',
  '/iam/authorize',
  '/api/v1/iam/users',
  '/api/v1/iam/users/sync-keycloak',
  '/api/v1/iam/users/$userId',
  '/api/v1/iam/users/$userId/timeline',
  '/api/v1/iam/users/bulk-deactivate',
  '/api/v1/iam/users/me/profile',
  '/api/v1/iam/organizations',
  '/api/v1/iam/organizations/$organizationId',
  '/api/v1/iam/organizations/$organizationId/memberships',
  '/api/v1/iam/organizations/$organizationId/memberships/$accountId',
  '/api/v1/iam/me/context',
  '/api/v1/iam/permissions',
  '/api/v1/iam/roles',
  '/api/v1/iam/roles/$roleId',
  '/api/v1/iam/groups',
  '/api/v1/iam/groups/$groupId',
  '/api/v1/iam/groups/$groupId/roles',
  '/api/v1/iam/groups/$groupId/roles/$roleId',
  '/api/v1/iam/groups/$groupId/memberships',
  '/api/v1/iam/instances',
  '/api/v1/iam/instances/$instanceId',
  '/api/v1/iam/instances/$instanceId/keycloak/status',
  '/api/v1/iam/instances/$instanceId/keycloak/preflight',
  '/api/v1/iam/instances/$instanceId/keycloak/plan',
  '/api/v1/iam/instances/$instanceId/keycloak/execute',
  '/api/v1/iam/instances/$instanceId/keycloak/runs/$runId',
  '/api/v1/iam/instances/$instanceId/keycloak/reconcile',
  '/api/v1/iam/instances/$instanceId/tenant-iam/access-probe',
  '/api/v1/iam/instances/$instanceId/activate',
  '/api/v1/iam/instances/$instanceId/suspend',
  '/api/v1/iam/instances/$instanceId/archive',
  '/api/v1/iam/contents',
  '/api/v1/iam/contents/$contentId',
  '/api/v1/iam/contents/$contentId/history',
  '/api/v1/iam/legal-texts',
  '/api/v1/iam/legal-texts/$legalTextVersionId',
  '/api/v1/iam/admin/reconcile',
  '/iam/governance/workflows',
  '/iam/governance/compliance/export',
  '/iam/me/data-export',
  '/iam/me/data-export/status',
  '/iam/me/data-subject-rights/requests',
  '/iam/me/legal-texts/pending',
  '/iam/me/profile',
  '/iam/me/optional-processing/execute',
  '/iam/admin/data-subject-rights/export',
  '/iam/admin/data-subject-rights/export/status',
  '/iam/admin/data-subject-rights/cases',
  '/iam/admin/data-subject-rights/legal-holds/apply',
  '/iam/admin/data-subject-rights/legal-holds/release',
  '/iam/admin/data-subject-rights/maintenance',
] as const satisfies readonly AuthRoutePath[];
