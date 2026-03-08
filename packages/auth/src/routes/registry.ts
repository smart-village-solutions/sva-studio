import {
  bulkDeactivateUsersHandler,
  createRoleHandler,
  createUserHandler,
  deactivateUserHandler,
  deleteRoleHandler,
  getMyProfileHandler,
  getUserHandler,
  healthLiveHandler,
  healthReadyHandler,
  listRolesHandler,
  listUsersHandler,
  reconcileHandler,
  updateMyProfileHandler,
  updateRoleHandler,
  updateUserHandler,
} from '../iam-account-management.server';
import {
  adminDataExportHandler,
  adminDataExportStatusHandler,
  dataExportHandler,
  dataExportStatusHandler,
  dataSubjectMaintenanceHandler,
  dataSubjectRequestHandler,
  legalHoldApplyHandler,
  legalHoldReleaseHandler,
  optionalProcessingExecuteHandler,
  profileCorrectionHandler,
} from '../iam-data-subject-rights.server';
import { governanceComplianceExportHandler, governanceWorkflowHandler } from '../iam-governance.server';
import type { AuthRoutePath } from '../routes.shared';
import { callbackHandler, loginHandler, logoutHandler, meHandler } from './handlers';

export type AuthRouteDefinition = {
  path: AuthRoutePath;
  handlers: {
    GET?: (ctx: { request: Request }) => Promise<Response> | Response;
    POST?: (ctx: { request: Request }) => Promise<Response> | Response;
    PATCH?: (ctx: { request: Request }) => Promise<Response> | Response;
    DELETE?: (ctx: { request: Request }) => Promise<Response> | Response;
  };
};

export const authRouteDefinitions: AuthRouteDefinition[] = [
  { path: '/auth/login', handlers: { GET: async ({ request }) => loginHandler(request) } },
  { path: '/auth/callback', handlers: { GET: async ({ request }) => callbackHandler(request) } },
  { path: '/auth/me', handlers: { GET: async ({ request }) => meHandler(request) } },
  { path: '/auth/logout', handlers: { POST: async ({ request }) => logoutHandler(request) } },
  { path: '/health/ready', handlers: { GET: async ({ request }) => healthReadyHandler(request) } },
  { path: '/health/live', handlers: { GET: async ({ request }) => healthLiveHandler(request) } },
  { path: '/iam/governance/workflows', handlers: { POST: async ({ request }) => governanceWorkflowHandler(request) } },
  {
    path: '/api/v1/iam/users',
    handlers: {
      GET: async ({ request }) => listUsersHandler(request),
      POST: async ({ request }) => createUserHandler(request),
    },
  },
  {
    path: '/api/v1/iam/users/$userId',
    handlers: {
      GET: async ({ request }) => getUserHandler(request),
      PATCH: async ({ request }) => updateUserHandler(request),
      DELETE: async ({ request }) => deactivateUserHandler(request),
    },
  },
  { path: '/api/v1/iam/users/bulk-deactivate', handlers: { POST: async ({ request }) => bulkDeactivateUsersHandler(request) } },
  {
    path: '/api/v1/iam/users/me/profile',
    handlers: {
      GET: async ({ request }) => getMyProfileHandler(request),
      PATCH: async ({ request }) => updateMyProfileHandler(request),
    },
  },
  {
    path: '/api/v1/iam/roles',
    handlers: {
      GET: async ({ request }) => listRolesHandler(request),
      POST: async ({ request }) => createRoleHandler(request),
    },
  },
  {
    path: '/api/v1/iam/roles/$roleId',
    handlers: {
      PATCH: async ({ request }) => updateRoleHandler(request),
      DELETE: async ({ request }) => deleteRoleHandler(request),
    },
  },
  { path: '/api/v1/iam/admin/reconcile', handlers: { POST: async ({ request }) => reconcileHandler(request) } },
  { path: '/iam/governance/compliance/export', handlers: { GET: async ({ request }) => governanceComplianceExportHandler(request) } },
  { path: '/iam/me/data-export', handlers: { GET: async ({ request }) => dataExportHandler(request) } },
  { path: '/iam/me/data-export/status', handlers: { GET: async ({ request }) => dataExportStatusHandler(request) } },
  { path: '/iam/me/data-subject-rights/requests', handlers: { POST: async ({ request }) => dataSubjectRequestHandler(request) } },
  { path: '/iam/me/profile', handlers: { POST: async ({ request }) => profileCorrectionHandler(request) } },
  {
    path: '/iam/me/optional-processing/execute',
    handlers: { POST: async ({ request }) => optionalProcessingExecuteHandler(request) },
  },
  { path: '/iam/admin/data-subject-rights/export', handlers: { GET: async ({ request }) => adminDataExportHandler(request) } },
  {
    path: '/iam/admin/data-subject-rights/export/status',
    handlers: { GET: async ({ request }) => adminDataExportStatusHandler(request) },
  },
  {
    path: '/iam/admin/data-subject-rights/legal-holds/apply',
    handlers: { POST: async ({ request }) => legalHoldApplyHandler(request) },
  },
  {
    path: '/iam/admin/data-subject-rights/legal-holds/release',
    handlers: { POST: async ({ request }) => legalHoldReleaseHandler(request) },
  },
  { path: '/iam/admin/data-subject-rights/maintenance', handlers: { POST: async ({ request }) => dataSubjectMaintenanceHandler(request) } },
];
