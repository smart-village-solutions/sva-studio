import { beforeEach, describe, expect, it, vi } from 'vitest';

const registryMocks = vi.hoisted(() => {
  const response = (name: string) => new Response(JSON.stringify({ name }), { status: 200 });

  return {
    loginHandler: vi.fn(async () => response('loginHandler')),
    callbackHandler: vi.fn(async (_request?: Request) => response('callbackHandler')),
    meHandler: vi.fn(async (_request?: Request) => response('meHandler')),
    logoutHandler: vi.fn(async (_request?: Request) => response('logoutHandler')),
    healthReadyHandler: vi.fn(async (_request?: Request) => response('healthReadyHandler')),
    healthLiveHandler: vi.fn(async (_request?: Request) => response('healthLiveHandler')),
    listUsersHandler: vi.fn(async (_request?: Request) => response('listUsersHandler')),
    syncUsersFromKeycloakHandler: vi.fn(async (_request?: Request) => response('syncUsersFromKeycloakHandler')),
    createUserHandler: vi.fn(async (_request?: Request) => response('createUserHandler')),
    getUserHandler: vi.fn(async (_request?: Request) => response('getUserHandler')),
    updateUserHandler: vi.fn(async (_request?: Request) => response('updateUserHandler')),
    deactivateUserHandler: vi.fn(async (_request?: Request) => response('deactivateUserHandler')),
    bulkDeactivateUsersHandler: vi.fn(async (_request?: Request) => response('bulkDeactivateUsersHandler')),
    getMyProfileHandler: vi.fn(async (_request?: Request) => response('getMyProfileHandler')),
    updateMyProfileHandler: vi.fn(async (_request?: Request) => response('updateMyProfileHandler')),
    listOrganizationsHandler: vi.fn(async (_request?: Request) => response('listOrganizationsHandler')),
    createOrganizationHandler: vi.fn(async (_request?: Request) => response('createOrganizationHandler')),
    getOrganizationHandler: vi.fn(async (_request?: Request) => response('getOrganizationHandler')),
    updateOrganizationHandler: vi.fn(async (_request?: Request) => response('updateOrganizationHandler')),
    deactivateOrganizationHandler: vi.fn(async (_request?: Request) => response('deactivateOrganizationHandler')),
    assignOrganizationMembershipHandler: vi.fn(async (_request?: Request) =>
      response('assignOrganizationMembershipHandler')
    ),
    removeOrganizationMembershipHandler: vi.fn(async (_request?: Request) =>
      response('removeOrganizationMembershipHandler')
    ),
    getMyOrganizationContextHandler: vi.fn(async (_request?: Request) => response('getMyOrganizationContextHandler')),
    updateMyOrganizationContextHandler: vi.fn(async (_request?: Request) =>
      response('updateMyOrganizationContextHandler')
    ),
    listRolesHandler: vi.fn(async (_request?: Request) => response('listRolesHandler')),
    createRoleHandler: vi.fn(async (_request?: Request) => response('createRoleHandler')),
    updateRoleHandler: vi.fn(async (_request?: Request) => response('updateRoleHandler')),
    deleteRoleHandler: vi.fn(async (_request?: Request) => response('deleteRoleHandler')),
    reconcileHandler: vi.fn(async (_request?: Request) => response('reconcileHandler')),
    governanceWorkflowHandler: vi.fn(async (_request?: Request) => response('governanceWorkflowHandler')),
    governanceComplianceExportHandler: vi.fn(async (_request?: Request) =>
      response('governanceComplianceExportHandler')
    ),
    dataExportHandler: vi.fn(async (_request?: Request) => response('dataExportHandler')),
    dataExportStatusHandler: vi.fn(async (_request?: Request) => response('dataExportStatusHandler')),
    dataSubjectRequestHandler: vi.fn(async (_request?: Request) => response('dataSubjectRequestHandler')),
    profileCorrectionHandler: vi.fn(async (_request?: Request) => response('profileCorrectionHandler')),
    optionalProcessingExecuteHandler: vi.fn(async (_request?: Request) =>
      response('optionalProcessingExecuteHandler')
    ),
    adminDataExportHandler: vi.fn(async (_request?: Request) => response('adminDataExportHandler')),
    adminDataExportStatusHandler: vi.fn(async (_request?: Request) => response('adminDataExportStatusHandler')),
    legalHoldApplyHandler: vi.fn(async (_request?: Request) => response('legalHoldApplyHandler')),
    legalHoldReleaseHandler: vi.fn(async (_request?: Request) => response('legalHoldReleaseHandler')),
    dataSubjectMaintenanceHandler: vi.fn(async (_request?: Request) => response('dataSubjectMaintenanceHandler')),
  };
});

vi.mock('../iam-account-management.server', () => ({
  bulkDeactivateUsersHandler: registryMocks.bulkDeactivateUsersHandler,
  createRoleHandler: registryMocks.createRoleHandler,
  createUserHandler: registryMocks.createUserHandler,
  deactivateUserHandler: registryMocks.deactivateUserHandler,
  deleteRoleHandler: registryMocks.deleteRoleHandler,
  getMyProfileHandler: registryMocks.getMyProfileHandler,
  getUserHandler: registryMocks.getUserHandler,
  healthLiveHandler: registryMocks.healthLiveHandler,
  healthReadyHandler: registryMocks.healthReadyHandler,
  listRolesHandler: registryMocks.listRolesHandler,
  listUsersHandler: registryMocks.listUsersHandler,
  reconcileHandler: registryMocks.reconcileHandler,
  syncUsersFromKeycloakHandler: registryMocks.syncUsersFromKeycloakHandler,
  updateMyProfileHandler: registryMocks.updateMyProfileHandler,
  updateRoleHandler: registryMocks.updateRoleHandler,
  updateUserHandler: registryMocks.updateUserHandler,
}));

vi.mock('../iam-organizations.server', () => ({
  assignOrganizationMembershipHandler: registryMocks.assignOrganizationMembershipHandler,
  createOrganizationHandler: registryMocks.createOrganizationHandler,
  deactivateOrganizationHandler: registryMocks.deactivateOrganizationHandler,
  getMyOrganizationContextHandler: registryMocks.getMyOrganizationContextHandler,
  getOrganizationHandler: registryMocks.getOrganizationHandler,
  listOrganizationsHandler: registryMocks.listOrganizationsHandler,
  removeOrganizationMembershipHandler: registryMocks.removeOrganizationMembershipHandler,
  updateMyOrganizationContextHandler: registryMocks.updateMyOrganizationContextHandler,
  updateOrganizationHandler: registryMocks.updateOrganizationHandler,
}));

vi.mock('../iam-data-subject-rights.server', () => ({
  adminDataExportHandler: registryMocks.adminDataExportHandler,
  adminDataExportStatusHandler: registryMocks.adminDataExportStatusHandler,
  dataExportHandler: registryMocks.dataExportHandler,
  dataExportStatusHandler: registryMocks.dataExportStatusHandler,
  dataSubjectMaintenanceHandler: registryMocks.dataSubjectMaintenanceHandler,
  dataSubjectRequestHandler: registryMocks.dataSubjectRequestHandler,
  legalHoldApplyHandler: registryMocks.legalHoldApplyHandler,
  legalHoldReleaseHandler: registryMocks.legalHoldReleaseHandler,
  optionalProcessingExecuteHandler: registryMocks.optionalProcessingExecuteHandler,
  profileCorrectionHandler: registryMocks.profileCorrectionHandler,
}));

vi.mock('../iam-governance.server', () => ({
  governanceComplianceExportHandler: registryMocks.governanceComplianceExportHandler,
  governanceWorkflowHandler: registryMocks.governanceWorkflowHandler,
}));

vi.mock('./handlers', () => ({
  callbackHandler: registryMocks.callbackHandler,
  loginHandler: registryMocks.loginHandler,
  logoutHandler: registryMocks.logoutHandler,
  meHandler: registryMocks.meHandler,
}));

import { authRouteDefinitions } from './registry';

describe('auth route registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes unique route definitions including organization endpoints', () => {
    const uniquePaths = new Set(authRouteDefinitions.map((route) => route.path));

    expect(uniquePaths.size).toBe(authRouteDefinitions.length);
    expect(uniquePaths.has('/api/v1/iam/organizations')).toBe(true);
    expect(uniquePaths.has('/api/v1/iam/organizations/$organizationId')).toBe(true);
    expect(uniquePaths.has('/api/v1/iam/me/context')).toBe(true);
    expect(uniquePaths.has('/api/v1/iam/users/sync-keycloak')).toBe(true);
  });

  it('invokes each configured handler wrapper', async () => {
    for (const routeDefinition of authRouteDefinitions) {
      const request = new Request(`http://localhost${routeDefinition.path}`, { method: 'GET' });

      if (routeDefinition.handlers.GET) {
        const response = await routeDefinition.handlers.GET({ request });
        expect(response.status).toBe(200);
      }

      if (routeDefinition.handlers.POST) {
        const response = await routeDefinition.handlers.POST({ request });
        expect(response.status).toBe(200);
      }

      if (routeDefinition.handlers.PUT) {
        const response = await routeDefinition.handlers.PUT({ request });
        expect(response.status).toBe(200);
      }

      if (routeDefinition.handlers.PATCH) {
        const response = await routeDefinition.handlers.PATCH({ request });
        expect(response.status).toBe(200);
      }

      if (routeDefinition.handlers.DELETE) {
        const response = await routeDefinition.handlers.DELETE({ request });
        expect(response.status).toBe(200);
      }
    }

    expect(registryMocks.loginHandler).toHaveBeenCalledTimes(1);
    expect(registryMocks.createOrganizationHandler).toHaveBeenCalledTimes(1);
    expect(registryMocks.updateOrganizationHandler).toHaveBeenCalledTimes(1);
    expect(registryMocks.updateMyOrganizationContextHandler).toHaveBeenCalledTimes(1);
    expect(registryMocks.dataSubjectMaintenanceHandler).toHaveBeenCalledTimes(1);
  });
});
