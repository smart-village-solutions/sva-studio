import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authRoutePaths, resolveAuthHandlers } from './auth.routes.server';

const authServerMocks = vi.hoisted(() => {
  const response = (name: string) => new Response(JSON.stringify({ name }), { status: 200 });
  return {
    loginHandler: vi.fn(async () => response('loginHandler')),
    callbackHandler: vi.fn(async () => response('callbackHandler')),
    meHandler: vi.fn(async () => response('meHandler')),
    logoutHandler: vi.fn(async () => response('logoutHandler')),
    healthReadyHandler: vi.fn(async () => response('healthReadyHandler')),
    healthLiveHandler: vi.fn(async () => response('healthLiveHandler')),
    mePermissionsHandler: vi.fn(async () => response('mePermissionsHandler')),
    authorizeHandler: vi.fn(async () => response('authorizeHandler')),
    listUsersHandler: vi.fn(async () => response('listUsersHandler')),
    createUserHandler: vi.fn(async () => response('createUserHandler')),
    getUserHandler: vi.fn(async () => response('getUserHandler')),
    updateUserHandler: vi.fn(async () => response('updateUserHandler')),
    deactivateUserHandler: vi.fn(async () => response('deactivateUserHandler')),
    bulkDeactivateUsersHandler: vi.fn(async () => response('bulkDeactivateUsersHandler')),
    syncUsersFromKeycloakHandler: vi.fn(async () => response('syncUsersFromKeycloakHandler')),
    getMyProfileHandler: vi.fn(async () => response('getMyProfileHandler')),
    updateMyProfileHandler: vi.fn(async () => response('updateMyProfileHandler')),
    listOrganizationsHandler: vi.fn(async () => response('listOrganizationsHandler')),
    createOrganizationHandler: vi.fn(async () => response('createOrganizationHandler')),
    getOrganizationHandler: vi.fn(async () => response('getOrganizationHandler')),
    updateOrganizationHandler: vi.fn(async () => response('updateOrganizationHandler')),
    deactivateOrganizationHandler: vi.fn(async () => response('deactivateOrganizationHandler')),
    assignOrganizationMembershipHandler: vi.fn(async () => response('assignOrganizationMembershipHandler')),
    removeOrganizationMembershipHandler: vi.fn(async () => response('removeOrganizationMembershipHandler')),
    getMyOrganizationContextHandler: vi.fn(async () => response('getMyOrganizationContextHandler')),
    updateMyOrganizationContextHandler: vi.fn(async () => response('updateMyOrganizationContextHandler')),
    listRolesHandler: vi.fn(async () => response('listRolesHandler')),
    createRoleHandler: vi.fn(async () => response('createRoleHandler')),
    updateRoleHandler: vi.fn(async () => response('updateRoleHandler')),
    deleteRoleHandler: vi.fn(async () => response('deleteRoleHandler')),
    reconcileHandler: vi.fn(async () => response('reconcileHandler')),
    governanceWorkflowHandler: vi.fn(async () => response('governanceWorkflowHandler')),
    governanceComplianceExportHandler: vi.fn(async () => response('governanceComplianceExportHandler')),
    dataExportHandler: vi.fn(async () => response('dataExportHandler')),
    dataExportStatusHandler: vi.fn(async () => response('dataExportStatusHandler')),
    dataSubjectRequestHandler: vi.fn(async () => response('dataSubjectRequestHandler')),
    profileCorrectionHandler: vi.fn(async () => response('profileCorrectionHandler')),
    optionalProcessingExecuteHandler: vi.fn(async () => response('optionalProcessingExecuteHandler')),
    adminDataExportHandler: vi.fn(async () => response('adminDataExportHandler')),
    adminDataExportStatusHandler: vi.fn(async () => response('adminDataExportStatusHandler')),
    legalHoldApplyHandler: vi.fn(async () => response('legalHoldApplyHandler')),
    legalHoldReleaseHandler: vi.fn(async () => response('legalHoldReleaseHandler')),
    dataSubjectMaintenanceHandler: vi.fn(async () => response('dataSubjectMaintenanceHandler')),
  };
});

vi.mock('@sva/auth/server', () => authServerMocks);

describe('auth.routes.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves handlers for all declared auth paths', () => {
    for (const path of authRoutePaths) {
      expect(resolveAuthHandlers(path)).toBeDefined();
    }
  });

  it('executes all mapped handlers for all routes', async () => {
    for (const path of authRoutePaths) {
      const handlers = resolveAuthHandlers(path);
      const request = new Request(`http://localhost${path}`, { method: 'GET' });

      if (handlers.GET) {
        const response = await handlers.GET({ request });
        expect(response.status).toBe(200);
      }

      if (handlers.POST) {
        const response = await handlers.POST({ request });
        expect(response.status).toBe(200);
      }

      if (handlers.PATCH) {
        const response = await handlers.PATCH({ request });
        expect(response.status).toBe(200);
      }

      if (handlers.PUT) {
        const response = await handlers.PUT({ request });
        expect(response.status).toBe(200);
      }

      if (handlers.DELETE) {
        const response = await handlers.DELETE({ request });
        expect(response.status).toBe(200);
      }
    }

    expect(authServerMocks.loginHandler).toHaveBeenCalled();
    expect(authServerMocks.callbackHandler).toHaveBeenCalled();
    expect(authServerMocks.meHandler).toHaveBeenCalled();
    expect(authServerMocks.logoutHandler).toHaveBeenCalled();
    expect(authServerMocks.listUsersHandler).toHaveBeenCalled();
    expect(authServerMocks.getUserHandler).toHaveBeenCalled();
    expect(authServerMocks.updateUserHandler).toHaveBeenCalled();
    expect(authServerMocks.listOrganizationsHandler).toHaveBeenCalled();
    expect(authServerMocks.updateMyOrganizationContextHandler).toHaveBeenCalled();
    expect(authServerMocks.deleteRoleHandler).toHaveBeenCalled();
    expect(authServerMocks.dataSubjectMaintenanceHandler).toHaveBeenCalled();
  });

  it('throws for unknown auth path', () => {
    expect(() => resolveAuthHandlers('/auth/unknown')).toThrow('Unknown auth route path');
  });
});
