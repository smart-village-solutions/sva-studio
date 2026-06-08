// This file exists so client and server code can share auth routes type-safely.
export type AuthRoutePath =
  | '/auth/login'
  | '/auth/account-action'
  | '/auth/dev-login'
  | '/auth/callback'
  | '/auth/me'
  | '/auth/dev-logout'
  | '/auth/logout'
  | '/api/v1/iam/health/ready'
  | '/api/v1/iam/health/live'
  | '/health/ready'
  | '/health/live'
  | '/iam/me/permissions'
  | '/iam/authorize'
  | '/api/v1/iam/authorize-performance'
  | '/api/v1/iam/users'
  | '/api/v1/iam/users/sync-keycloak'
  | '/api/v1/iam/users/$userId'
  | '/api/v1/iam/users/$userId/send-password-setup-email'
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
  | '/api/v1/iam/instances/$instanceId/modules/assign'
  | '/api/v1/iam/instances/$instanceId/modules/bootstrap-admin-structure'
  | '/api/v1/iam/instances/$instanceId/modules/revoke'
  | '/api/v1/iam/instances/$instanceId/modules/seed-iam-baseline'
  | '/api/v1/iam/instances/$instanceId/activate'
  | '/api/v1/iam/instances/$instanceId/suspend'
  | '/api/v1/iam/instances/$instanceId/archive'
  | '/api/v1/iam/contents'
  | '/api/v1/iam/contents/$contentId'
  | '/api/v1/iam/contents/$contentId/history'
  | '/api/v1/iam/media'
  | '/api/v1/iam/media/references'
  | '/api/v1/iam/media/upload-sessions'
  | '/api/v1/iam/media/upload-sessions/$uploadSessionId/complete'
  | '/api/v1/iam/media/$assetId'
  | '/api/v1/iam/media/$assetId/usage'
  | '/api/v1/iam/media/$assetId/delivery'
  | '/api/v1/iam/legal-texts'
  | '/api/v1/iam/legal-texts/$legalTextVersionId'
  | '/api/v1/iam/admin/reconcile'
  | '/iam/governance/workflows'
  | '/iam/governance/workflows/$caseId'
  | '/iam/governance/compliance/export'
  | '/iam/governance/legal-consents/export'
  | '/iam/admin/deletion-rules'
  | '/iam/me/deletion-rules'
  | '/iam/me/deletion-rules/content-preference'
  | '/iam/me/permission-change-requests'
  | '/iam/me/data-export'
  | '/iam/me/data-export/status'
  | '/iam/me/data-subject-rights/requests'
  | '/iam/me/data-subject-rights/cases/$caseId'
  | '/iam/me/legal-texts/pending'
  | '/iam/me/profile'
  | '/iam/me/optional-processing/execute'
  | '/iam/admin/data-subject-rights/export'
  | '/iam/admin/data-subject-rights/export/status'
  | '/iam/admin/data-subject-rights/cases'
  | '/iam/admin/data-subject-rights/cases/$caseId'
  | '/iam/admin/data-subject-rights/legal-holds/apply'
  | '/iam/admin/data-subject-rights/legal-holds/release'
  | '/iam/admin/data-subject-rights/maintenance'
  | '/api/v1/waste-management/history'
  | '/api/v1/waste-management/master-data'
  | '/api/v1/waste-management/fractions'
  | '/api/v1/waste-management/fractions/$fractionId'
  | '/api/v1/waste-management/regions'
  | '/api/v1/waste-management/regions/$regionId'
  | '/api/v1/waste-management/cities'
  | '/api/v1/waste-management/cities/$cityId'
  | '/api/v1/waste-management/streets'
  | '/api/v1/waste-management/streets/$streetId'
  | '/api/v1/waste-management/house-numbers'
  | '/api/v1/waste-management/house-numbers/$houseNumberId'
  | '/api/v1/waste-management/collection-locations'
  | '/api/v1/waste-management/collection-locations/$locationId'
  | '/api/v1/waste-management/location-tour-links'
  | '/api/v1/waste-management/location-tour-links/bulk'
  | '/api/v1/waste-management/location-tour-links/$linkId'
  | '/api/v1/waste-management/scheduling'
  | '/api/v1/waste-management/global-date-shifts'
  | '/api/v1/waste-management/global-date-shifts/$shiftId'
  | '/api/v1/waste-management/holiday-rules/$holidayRuleId'
  | '/api/v1/waste-management/tour-date-shifts'
  | '/api/v1/waste-management/tour-date-shifts/$shiftId'
  | '/api/v1/waste-management/tours'
  | '/api/v1/waste-management/tours/$tourId'
  | '/api/v1/waste-management/settings'
  | '/api/v1/waste-management/settings/holiday-sync'
  | '/api/v1/waste-management/tools/initialize'
  | '/api/v1/waste-management/tools/imports'
  | '/api/v1/waste-management/tools/imports/preview'
  | '/api/v1/waste-management/tools/migrations'
  | '/api/v1/waste-management/tools/seed'
  | '/api/v1/waste-management/tools/reset'
  | '/api/v1/plugin-operations/jobs'
  | '/api/v1/plugin-operations/jobs/$jobId'
  | '/api/v1/plugin-operations/jobs/$jobId/cancel';

export const authRoutePaths = [
  '/auth/login',
  '/auth/account-action',
  '/auth/dev-login',
  '/auth/callback',
  '/auth/me',
  '/auth/dev-logout',
  '/auth/logout',
  '/api/v1/iam/health/ready',
  '/api/v1/iam/health/live',
  '/health/ready',
  '/health/live',
  '/iam/me/permissions',
  '/iam/authorize',
  '/api/v1/iam/authorize-performance',
  '/api/v1/iam/users',
  '/api/v1/iam/users/sync-keycloak',
  '/api/v1/iam/users/$userId',
  '/api/v1/iam/users/$userId/send-password-setup-email',
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
  '/api/v1/iam/instances/$instanceId/modules/assign',
  '/api/v1/iam/instances/$instanceId/modules/bootstrap-admin-structure',
  '/api/v1/iam/instances/$instanceId/modules/revoke',
  '/api/v1/iam/instances/$instanceId/modules/seed-iam-baseline',
  '/api/v1/iam/instances/$instanceId/activate',
  '/api/v1/iam/instances/$instanceId/suspend',
  '/api/v1/iam/instances/$instanceId/archive',
  '/api/v1/iam/contents',
  '/api/v1/iam/contents/$contentId',
  '/api/v1/iam/contents/$contentId/history',
  '/api/v1/iam/media',
  '/api/v1/iam/media/references',
  '/api/v1/iam/media/upload-sessions',
  '/api/v1/iam/media/upload-sessions/$uploadSessionId/complete',
  '/api/v1/iam/media/$assetId',
  '/api/v1/iam/media/$assetId/usage',
  '/api/v1/iam/media/$assetId/delivery',
  '/api/v1/iam/legal-texts',
  '/api/v1/iam/legal-texts/$legalTextVersionId',
  '/api/v1/iam/admin/reconcile',
  '/iam/governance/workflows',
  '/iam/governance/workflows/$caseId',
  '/iam/governance/compliance/export',
  '/iam/governance/legal-consents/export',
  '/iam/admin/deletion-rules',
  '/iam/me/deletion-rules',
  '/iam/me/deletion-rules/content-preference',
  '/iam/me/permission-change-requests',
  '/iam/me/data-export',
  '/iam/me/data-export/status',
  '/iam/me/data-subject-rights/requests',
  '/iam/me/data-subject-rights/cases/$caseId',
  '/iam/me/legal-texts/pending',
  '/iam/me/profile',
  '/iam/me/optional-processing/execute',
  '/iam/admin/data-subject-rights/export',
  '/iam/admin/data-subject-rights/export/status',
  '/iam/admin/data-subject-rights/cases',
  '/iam/admin/data-subject-rights/cases/$caseId',
  '/iam/admin/data-subject-rights/legal-holds/apply',
  '/iam/admin/data-subject-rights/legal-holds/release',
  '/iam/admin/data-subject-rights/maintenance',
  '/api/v1/waste-management/history',
  '/api/v1/waste-management/master-data',
  '/api/v1/waste-management/fractions',
  '/api/v1/waste-management/fractions/$fractionId',
  '/api/v1/waste-management/regions',
  '/api/v1/waste-management/regions/$regionId',
  '/api/v1/waste-management/cities',
  '/api/v1/waste-management/cities/$cityId',
  '/api/v1/waste-management/streets',
  '/api/v1/waste-management/streets/$streetId',
  '/api/v1/waste-management/house-numbers',
  '/api/v1/waste-management/house-numbers/$houseNumberId',
  '/api/v1/waste-management/collection-locations',
  '/api/v1/waste-management/collection-locations/$locationId',
  '/api/v1/waste-management/location-tour-links',
  '/api/v1/waste-management/location-tour-links/bulk',
  '/api/v1/waste-management/location-tour-links/$linkId',
  '/api/v1/waste-management/scheduling',
  '/api/v1/waste-management/global-date-shifts',
  '/api/v1/waste-management/global-date-shifts/$shiftId',
  '/api/v1/waste-management/holiday-rules/$holidayRuleId',
  '/api/v1/waste-management/tour-date-shifts',
  '/api/v1/waste-management/tour-date-shifts/$shiftId',
  '/api/v1/waste-management/tours',
  '/api/v1/waste-management/tours/$tourId',
  '/api/v1/waste-management/settings',
  '/api/v1/waste-management/settings/holiday-sync',
  '/api/v1/waste-management/tools/initialize',
  '/api/v1/waste-management/tools/imports',
  '/api/v1/waste-management/tools/imports/preview',
  '/api/v1/waste-management/tools/migrations',
  '/api/v1/waste-management/tools/seed',
  '/api/v1/waste-management/tools/reset',
  '/api/v1/plugin-operations/jobs',
  '/api/v1/plugin-operations/jobs/$jobId',
  '/api/v1/plugin-operations/jobs/$jobId/cancel',
] as const satisfies readonly AuthRoutePath[];
