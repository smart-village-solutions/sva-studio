import { beforeEach, describe, expect, it, vi } from 'vitest';

const routingLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => routingLogger,
  getHeadersFromRequest: (request: Request) => {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return headers;
  },
  extractWorkspaceIdFromHeaders: (
    headers: Record<string, string>,
    headerNames: string[] = ['x-workspace-id', 'x-sva-workspace-id']
  ) => {
    for (const headerName of headerNames) {
      const value = headers[headerName];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
    return undefined;
  },
  extractRequestIdFromHeaders: (headers: Record<string, string>) => {
    const value = headers['x-request-id'];
    return typeof value === 'string' && value.length <= 128 ? value : undefined;
  },
  extractTraceIdFromHeaders: (headers: Record<string, string>) => {
    const traceparent = headers.traceparent;
    const match = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i.exec(traceparent ?? '');
    return match?.[1];
  },
  toJsonErrorResponse: (status: number, code: string, publicMessage?: string, options?: { requestId?: string }) =>
    new Response(
      JSON.stringify({
        error: code,
        ...(publicMessage ? { message: publicMessage } : {}),
        ...(options?.requestId ? { requestId: options.requestId } : {}),
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.requestId ? { 'X-Request-Id': options.requestId } : {}),
        },
      }
    ),
}));

import {
  authRoutePaths,
  authServerRouteFactories,
  dispatchAuthRouteRequest,
  resolveAuthHandlers,
  resolveAuthRoutePathForRequestPath,
  verifyAuthRouteHandlerCoverage,
  wrapHandlersWithJsonErrorBoundary,
} from './auth.routes.server';

type ServerRouteOptionsUnderTest = {
  path: string;
  getParentRoute: () => unknown;
  component: () => unknown;
  server: {
    handlers: {
      GET: (ctx: { request: Request }) => Promise<Response>;
    };
  };
};

const readServerRouteOptions = (route: unknown): ServerRouteOptionsUnderTest => {
  return (route as { options: unknown }).options as ServerRouteOptionsUnderTest;
};

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
    getUserTimelineHandler: vi.fn(async () => response('getUserTimelineHandler')),
    updateUserHandler: vi.fn(async () => response('updateUserHandler')),
    deactivateUserHandler: vi.fn(async () => response('deactivateUserHandler')),
    bulkDeactivateUsersHandler: vi.fn(async () => response('bulkDeactivateUsersHandler')),
    syncUsersFromKeycloakHandler: vi.fn(async () => response('syncUsersFromKeycloakHandler')),
    getMyProfileHandler: vi.fn(async () => response('getMyProfileHandler')),
    updateMyProfileHandler: vi.fn(async () => response('updateMyProfileHandler')),
    listGroupsHandler: vi.fn(async () => response('listGroupsHandler')),
    createGroupHandler: vi.fn(async () => response('createGroupHandler')),
    getGroupHandler: vi.fn(async () => response('getGroupHandler')),
    updateGroupHandler: vi.fn(async () => response('updateGroupHandler')),
    deleteGroupHandler: vi.fn(async () => response('deleteGroupHandler')),
    assignGroupRoleHandler: vi.fn(async () => response('assignGroupRoleHandler')),
    removeGroupRoleHandler: vi.fn(async () => response('removeGroupRoleHandler')),
    assignGroupMembershipHandler: vi.fn(async () => response('assignGroupMembershipHandler')),
    removeGroupMembershipHandler: vi.fn(async () => response('removeGroupMembershipHandler')),
    instanceRegistryHandlers: {
      listInstances: vi.fn(async () => response('listInstancesHandler')),
      getInstance: vi.fn(async () => response('getInstanceHandler')),
      createInstance: vi.fn(async () => response('createInstanceHandler')),
      updateInstance: vi.fn(async () => response('updateInstanceHandler')),
      getInstanceKeycloakStatus: vi.fn(async () => response('getInstanceKeycloakStatusHandler')),
      getInstanceKeycloakPreflight: vi.fn(async () => response('getInstanceKeycloakPreflightHandler')),
      planInstanceKeycloakProvisioning: vi.fn(async () => response('planInstanceKeycloakProvisioningHandler')),
      executeInstanceKeycloakProvisioning: vi.fn(async () => response('executeInstanceKeycloakProvisioningHandler')),
      getInstanceKeycloakProvisioningRun: vi.fn(async () => response('getInstanceKeycloakProvisioningRunHandler')),
      reconcileInstanceKeycloak: vi.fn(async () => response('reconcileInstanceKeycloakHandler')),
      probeTenantIamAccess: vi.fn(async () => response('probeTenantIamAccessHandler')),
      assignInstanceModule: vi.fn(async () => response('assignInstanceModuleHandler')),
      revokeInstanceModule: vi.fn(async () => response('revokeInstanceModuleHandler')),
      seedInstanceIamBaseline: vi.fn(async () => response('seedInstanceIamBaselineHandler')),
      activateInstance: vi.fn(async () => response('activateInstanceHandler')),
      suspendInstance: vi.fn(async () => response('suspendInstanceHandler')),
      archiveInstance: vi.fn(async () => response('archiveInstanceHandler')),
    },
    listContentsHandler: vi.fn(async () => response('listContentsHandler')),
    createContentHandler: vi.fn(async () => response('createContentHandler')),
    getContentHandler: vi.fn(async () => response('getContentHandler')),
    updateContentHandler: vi.fn(async () => response('updateContentHandler')),
    deleteContentHandler: vi.fn(async () => response('deleteContentHandler')),
    getContentHistoryHandler: vi.fn(async () => response('getContentHistoryHandler')),
    listMediaHandler: vi.fn(async () => response('listMediaHandler')),
    initializeMediaUploadHandler: vi.fn(async () => response('initializeMediaUploadHandler')),
    getMediaHandler: vi.fn(async () => response('getMediaHandler')),
    updateMediaHandler: vi.fn(async () => response('updateMediaHandler')),
    getMediaUsageHandler: vi.fn(async () => response('getMediaUsageHandler')),
    getMediaDeliveryHandler: vi.fn(async () => response('getMediaDeliveryHandler')),
    replaceMediaReferencesHandler: vi.fn(async () => response('replaceMediaReferencesHandler')),
    listOrganizationsHandler: vi.fn(async () => response('listOrganizationsHandler')),
    createOrganizationHandler: vi.fn(async () => response('createOrganizationHandler')),
    getOrganizationHandler: vi.fn(async () => response('getOrganizationHandler')),
    updateOrganizationHandler: vi.fn(async () => response('updateOrganizationHandler')),
    deactivateOrganizationHandler: vi.fn(async () => response('deactivateOrganizationHandler')),
    assignOrganizationMembershipHandler: vi.fn(async () => response('assignOrganizationMembershipHandler')),
    removeOrganizationMembershipHandler: vi.fn(async () => response('removeOrganizationMembershipHandler')),
    getMyOrganizationContextHandler: vi.fn(async () => response('getMyOrganizationContextHandler')),
    updateMyOrganizationContextHandler: vi.fn(async () => response('updateMyOrganizationContextHandler')),
    listPermissionsHandler: vi.fn(async () => response('listPermissionsHandler')),
    listRolesHandler: vi.fn(async () => response('listRolesHandler')),
    createRoleHandler: vi.fn(async () => response('createRoleHandler')),
    updateRoleHandler: vi.fn(async () => response('updateRoleHandler')),
    deleteRoleHandler: vi.fn(async () => response('deleteRoleHandler')),
    listLegalTextsHandler: vi.fn(async () => response('listLegalTextsHandler')),
    createLegalTextHandler: vi.fn(async () => response('createLegalTextHandler')),
    updateLegalTextHandler: vi.fn(async () => response('updateLegalTextHandler')),
    deleteLegalTextHandler: vi.fn(async () => response('deleteLegalTextHandler')),
    reconcileHandler: vi.fn(async () => response('reconcileHandler')),
    listGovernanceCasesHandler: vi.fn(async () => response('listGovernanceCasesHandler')),
    governanceWorkflowHandler: vi.fn(async () => response('governanceWorkflowHandler')),
    governanceComplianceExportHandler: vi.fn(async () => response('governanceComplianceExportHandler')),
    dataExportHandler: vi.fn(async () => response('dataExportHandler')),
    dataExportStatusHandler: vi.fn(async () => response('dataExportStatusHandler')),
    getMyDataSubjectRightsHandler: vi.fn(async () => response('getMyDataSubjectRightsHandler')),
    listPendingLegalTextsHandler: vi.fn(async () => response('listPendingLegalTextsHandler')),
    dataSubjectRequestHandler: vi.fn(async () => response('dataSubjectRequestHandler')),
    profileCorrectionHandler: vi.fn(async () => response('profileCorrectionHandler')),
    optionalProcessingExecuteHandler: vi.fn(async () => response('optionalProcessingExecuteHandler')),
    adminDataExportHandler: vi.fn(async () => response('adminDataExportHandler')),
    adminDataExportStatusHandler: vi.fn(async () => response('adminDataExportStatusHandler')),
    listAdminDataSubjectRightsCasesHandler: vi.fn(async () => response('listAdminDataSubjectRightsCasesHandler')),
    legalHoldApplyHandler: vi.fn(async () => response('legalHoldApplyHandler')),
    legalHoldReleaseHandler: vi.fn(async () => response('legalHoldReleaseHandler')),
    dataSubjectMaintenanceHandler: vi.fn(async () => response('dataSubjectMaintenanceHandler')),
  };
});

vi.mock('@sva/auth-runtime/runtime-routes', () => authServerMocks);
vi.mock('@sva/auth-runtime/runtime-health', () => ({
  healthLiveHandler: authServerMocks.healthLiveHandler,
  healthReadyHandler: authServerMocks.healthReadyHandler,
}));

describe('auth.routes.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves handlers for all declared auth paths', () => {
    for (const path of authRoutePaths) {
      expect(resolveAuthHandlers(path)).toBeDefined();
    }
  });

  it('maps runtime health API paths to the runtime health handlers', async () => {
    const readyHandlers = resolveAuthHandlers('/api/v1/iam/health/ready');
    const liveHandlers = resolveAuthHandlers('/api/v1/iam/health/live');

    expect(readyHandlers?.GET).toBeDefined();
    expect(liveHandlers?.GET).toBeDefined();

    const readyGet = readyHandlers?.GET;
    const liveGet = liveHandlers?.GET;

    if (!readyGet || !liveGet) {
      throw new Error('Expected GET handlers to be defined');
    }

    const readyResponse = await readyGet({
      request: new Request('http://localhost/api/v1/iam/health/ready', { method: 'GET' }),
    });
    const liveResponse = await liveGet({
      request: new Request('http://localhost/api/v1/iam/health/live', { method: 'GET' }),
    });

    expect(readyResponse.status).toBe(200);
    expect(liveResponse.status).toBe(200);
    expect(authServerMocks.healthReadyHandler).toHaveBeenCalled();
    expect(authServerMocks.healthLiveHandler).toHaveBeenCalled();
  });

  it('executes all mapped handlers for all routes', async () => {
    for (const path of authRoutePaths) {
      const handlers = resolveAuthHandlers(path);
      const request = new Request(`http://localhost${path}`, { method: 'GET' });

      if (handlers.GET) {
        const response = await handlers.GET({ request });
        if (path === '/iam/me/data-export' || path === '/iam/admin/data-subject-rights/export') {
          expect(response.status).toBe(405);
        } else {
          expect(response.status).toBe(200);
        }
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
    expect(authServerMocks.listGroupsHandler).toHaveBeenCalled();
    expect(authServerMocks.deleteGroupHandler).toHaveBeenCalled();
    expect(authServerMocks.listOrganizationsHandler).toHaveBeenCalled();
    expect(authServerMocks.updateMyOrganizationContextHandler).toHaveBeenCalled();
    expect(authServerMocks.listPermissionsHandler).toHaveBeenCalled();
    expect(authServerMocks.deleteRoleHandler).toHaveBeenCalled();
    expect(authServerMocks.listGroupsHandler).toHaveBeenCalled();
    expect(authServerMocks.deleteGroupHandler).toHaveBeenCalled();
    expect(authServerMocks.listContentsHandler).toHaveBeenCalled();
    expect(authServerMocks.createContentHandler).toHaveBeenCalled();
    expect(authServerMocks.getContentHandler).toHaveBeenCalled();
    expect(authServerMocks.updateContentHandler).toHaveBeenCalled();
    expect(authServerMocks.deleteContentHandler).toHaveBeenCalled();
    expect(authServerMocks.getContentHistoryHandler).toHaveBeenCalled();
    expect(authServerMocks.listMediaHandler).toHaveBeenCalled();
    expect(authServerMocks.initializeMediaUploadHandler).toHaveBeenCalled();
    expect(authServerMocks.getMediaHandler).toHaveBeenCalled();
    expect(authServerMocks.updateMediaHandler).toHaveBeenCalled();
    expect(authServerMocks.getMediaUsageHandler).toHaveBeenCalled();
    expect(authServerMocks.getMediaDeliveryHandler).toHaveBeenCalled();
    expect(authServerMocks.replaceMediaReferencesHandler).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.updateInstance).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.getInstanceKeycloakStatus).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.getInstanceKeycloakPreflight).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.planInstanceKeycloakProvisioning).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.executeInstanceKeycloakProvisioning).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.getInstanceKeycloakProvisioningRun).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.reconcileInstanceKeycloak).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.probeTenantIamAccess).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.assignInstanceModule).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.revokeInstanceModule).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.seedInstanceIamBaseline).toHaveBeenCalled();
    expect(authServerMocks.listLegalTextsHandler).toHaveBeenCalled();
    expect(authServerMocks.createLegalTextHandler).toHaveBeenCalled();
    expect(authServerMocks.updateLegalTextHandler).toHaveBeenCalled();
    expect(authServerMocks.deleteLegalTextHandler).toHaveBeenCalled();
    expect(authServerMocks.listGovernanceCasesHandler).toHaveBeenCalled();
    expect(authServerMocks.getUserTimelineHandler).toHaveBeenCalled();
    expect(authServerMocks.getMyDataSubjectRightsHandler).toHaveBeenCalled();
    expect(authServerMocks.listPendingLegalTextsHandler).toHaveBeenCalled();
    expect(authServerMocks.listAdminDataSubjectRightsCasesHandler).toHaveBeenCalled();
    expect(authServerMocks.dataSubjectMaintenanceHandler).toHaveBeenCalled();
  });

  it('passes the incoming request to the login handler', async () => {
    const handlers = resolveAuthHandlers('/auth/login');
    const request = new Request('https://bb-guben.studio.example.org/auth/login', {
      method: 'GET',
      headers: { host: 'bb-guben.studio.example.org' },
    });

    const response = await handlers.GET?.({ request });

    expect(response?.status).toBe(200);
    expect(authServerMocks.loginHandler).toHaveBeenCalledWith(request);
  });

  it('throws for unknown auth path', () => {
    expect(() => resolveAuthHandlers('/auth/unknown')).toThrow('Unknown auth route path');
  });

  it('matches static and parameterized runtime auth paths', () => {
    expect(resolveAuthRoutePathForRequestPath('/health/live')).toBe('/health/live');
    expect(resolveAuthRoutePathForRequestPath('/api/v1/iam/users/abc-123')).toBe('/api/v1/iam/users/$userId');
    expect(resolveAuthRoutePathForRequestPath('/api/v1/iam/groups/group-1/roles/role-1')).toBe(
      '/api/v1/iam/groups/$groupId/roles/$roleId'
    );
    expect(resolveAuthRoutePathForRequestPath('/not-covered')).toBeNull();
  });

  it('dispatches runtime auth requests without going through the route tree', async () => {
    const response = await dispatchAuthRouteRequest(new Request('http://localhost/health/live'));

    expect(response?.status).toBe(200);
    expect(authServerMocks.healthLiveHandler).toHaveBeenCalledTimes(1);
    expect(routingLogger.info).toHaveBeenCalledWith(
      'Routing handler dispatched',
      expect.objectContaining({
        event: 'routing.handler.dispatched',
        route: '/health/live',
        method: 'GET',
        workspace_id: 'default',
      })
    );
    expect(routingLogger.info).toHaveBeenCalledWith(
      'Routing handler completed',
      expect.objectContaining({
        event: 'routing.handler.completed',
        route: '/health/live',
        method: 'GET',
        status_code: 200,
        workspace_id: 'default',
      })
    );
  });

  it('does not let dispatched diagnostics failures break successful auth handlers', async () => {
    routingLogger.info.mockImplementationOnce(() => {
      throw new Error('logger down');
    });

    const response = await dispatchAuthRouteRequest(new Request('http://localhost/health/live'));

    expect(response?.status).toBe(200);
    expect(authServerMocks.healthLiveHandler).toHaveBeenCalledTimes(1);
  });

  it('does not let method-not-allowed diagnostics failures break the 405 response', async () => {
    routingLogger.warn.mockImplementationOnce(() => {
      throw new Error('logger down');
    });

    const response = await dispatchAuthRouteRequest(new Request('http://localhost/iam/me/data-export', { method: 'GET' }));

    expect(response?.status).toBe(405);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'method_not_allowed',
    });
  });

  it('returns null for requests outside the auth runtime route set', async () => {
    const response = await dispatchAuthRouteRequest(new Request('http://localhost/not-covered'));

    expect(response).toBeNull();
  });

  it('returns method_not_allowed for unsupported runtime auth methods', async () => {
    const response = await dispatchAuthRouteRequest(
      new Request('http://localhost/auth/logout', {
        method: 'GET',
        headers: {
          'X-Request-Id': 'req-method',
        },
      })
    );

    expect(response?.status).toBe(405);
    expect(response?.headers.get('Allow')).toBe('POST');
    await expect(response?.json()).resolves.toEqual({
      error: 'method_not_allowed',
      message: 'HTTP-Methode nicht erlaubt.',
      requestId: 'req-method',
    });
    expect(routingLogger.warn).toHaveBeenCalledWith(
      'Unsupported HTTP method for route handler',
      expect.objectContaining({
        event: 'routing.handler.method_not_allowed',
        reason: 'method-not-allowed',
        route: '/auth/logout',
        method: 'GET',
        allow: 'POST',
        request_id: 'req-method',
      })
    );
  });

  it('sorts allowed methods alphabetically for multi-method auth routes', async () => {
    const response = await dispatchAuthRouteRequest(
      new Request('http://localhost/api/v1/iam/users/test-user', {
        method: 'PUT',
      })
    );

    expect(response?.status).toBe(405);
    expect(response?.headers.get('Allow')).toBe('DELETE, GET, PATCH');
  });

  it('returns a JSON 500 response when a wrapped handler throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw new Error('boom');
      },
    });

    const response = await handlers.GET?.({
      request: new Request('http://localhost/auth/me', {
        headers: {
          'X-Request-Id': 'req-123',
          traceparent: '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
        },
      }),
    });

    expect(response).toBeDefined();
    expect(response?.status).toBe(500);
    expect(response?.headers.get('Content-Type')).toContain('application/json');
    expect(response?.headers.get('X-Request-Id')).toBe('req-123');
    await expect(response?.json()).resolves.toEqual({
      error: 'internal_error',
      message: 'Ein unerwarteter Fehler ist aufgetreten.',
      requestId: 'req-123',
    });
    expect(routingLogger.info).toHaveBeenCalledWith(
      'Routing handler dispatched',
      expect.objectContaining({
        event: 'routing.handler.dispatched',
        route: '/auth/me',
        method: 'GET',
        request_id: 'req-123',
        trace_id: '0123456789abcdef0123456789abcdef',
      })
    );
    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        method: 'GET',
        route: '/auth/me',
        workspace_id: 'default',
        request_id: 'req-123',
        trace_id: '0123456789abcdef0123456789abcdef',
        error_type: 'Error',
        error_message: 'boom',
      })
    );
    expect(routingLogger.info).toHaveBeenCalledWith(
      'Routing handler completed',
      expect.objectContaining({
        event: 'routing.handler.completed',
        route: '/auth/me',
        method: 'GET',
        status_code: 500,
        request_id: 'req-123',
      })
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('logs undefined correlation ids for missing or invalid headers', async () => {
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw 'boom';
      },
    });

    const response = await handlers.GET?.({
      request: new Request('http://localhost/auth/me', {
        headers: {
          'X-Request-Id': 'x'.repeat(256),
          traceparent: '00-invalid-0123456789abcdef-01',
        },
      }),
    });

    expect(response?.status).toBe(500);
    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        workspace_id: 'default',
        request_id: undefined,
        trace_id: undefined,
        error_type: 'string',
        error_message: 'boom',
      })
    );
  });

  it.each([
    '',
    '01-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
    '00-0123456789abcdef0123456789abcde-0123456789abcdef-01',
    '00-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-0123456789abcdef-01',
  ])('drops invalid traceparent edge case %j without crashing', async (traceparent) => {
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw new Error('boom');
      },
    });

    const response = await handlers.GET?.({
      request: new Request('http://localhost/auth/me', {
        headers: traceparent ? { traceparent } : undefined,
      }),
    });

    expect(response?.status).toBe(500);
    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        workspace_id: 'default',
        trace_id: undefined,
      })
    );
  });

  it('logs workspace_id from headers when available', async () => {
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw new Error('boom');
      },
    });

    await handlers.GET?.({
      request: new Request('http://localhost/auth/me', {
        headers: {
          'x-workspace-id': 'de-musterhausen',
        },
      }),
    });

    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        workspace_id: 'de-musterhausen',
      })
    );
  });

  it('prefers x-sva-workspace-id and x-instance-id header fallbacks for workspace logging', async () => {
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw new Error('boom');
      },
    });

    await handlers.GET?.({
      request: new Request('http://localhost/auth/me', {
        headers: {
          'x-sva-workspace-id': 'de-alt-workspace',
        },
      }),
    });

    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        workspace_id: 'de-alt-workspace',
      })
    );

    routingLogger.error.mockClear();

    await handlers.GET?.({
      request: new Request('http://localhost/auth/me', {
        headers: {
          'x-instance-id': 'de-instance-header',
        },
      }),
    });

    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        workspace_id: 'de-instance-header',
      })
    );
  });

  it('falls back to instanceId query parameter for workspace logging', async () => {
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw new Error('boom');
      },
    });

    await handlers.GET?.({
      request: new Request('http://localhost/iam/me/permissions?instanceId=de-musterhausen'),
    });

    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        workspace_id: 'de-musterhausen',
      })
    );
  });

  it('writes a stderr fallback when structured route logging itself throws', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    routingLogger.error.mockImplementationOnce(() => {
      throw new Error('logger down');
    });
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw new Error('boom');
      },
    });

    const response = await handlers.GET?.({
      request: new Request('http://localhost/auth/me?instanceId=de-fallback', {
        headers: {
          'X-Request-Id': 'req-fallback',
        },
      }),
    });

    expect(response?.status).toBe(500);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('"workspace_id":"de-fallback"'));
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"routing.logger.fallback_activated"'));
    stderrSpy.mockRestore();
  });

  it('derives the route path from the request URL when the error boundary wrapper gets no explicit route path', async () => {
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async ({ request }) => new Response(request.url, { status: 200 }),
    });

    const response = await handlers.GET?.({
      request: new Request('http://localhost/api/v1/iam/users/url-derived', {
        method: 'GET',
      }),
    });

    expect(response?.status).toBe(200);
    expect(routingLogger.info).toHaveBeenCalledWith(
      'Routing handler dispatched',
      expect.objectContaining({
        event: 'routing.handler.dispatched',
        route: '/api/v1/iam/users/url-derived',
      })
    );
  });

  it('builds server route factories with wrapped handlers for declared auth paths', async () => {
    const rootRoute = { id: 'root' } as never;
    const dataExportIndex = authRoutePaths.indexOf('/iam/me/data-export');
    const route = readServerRouteOptions(authServerRouteFactories[dataExportIndex]?.(rootRoute));

    expect(route.path).toBe('/iam/me/data-export');
    expect(route.getParentRoute()).toBe(rootRoute);
    expect(route.component()).toBeNull();

    const response = await route.server.handlers.GET({
      request: new Request('http://localhost/iam/me/data-export', {
        headers: {
          'X-Request-Id': 'req-route-factory',
        },
      }),
    });

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
    await expect(response.json()).resolves.toEqual({
      error: 'method_not_allowed',
      message: 'HTTP-Methode nicht erlaubt.',
      requestId: 'req-route-factory',
    });
    expect(routingLogger.warn).toHaveBeenCalledWith(
      'Unsupported HTTP method for route handler',
      expect.objectContaining({
        event: 'routing.handler.method_not_allowed',
        route: '/iam/me/data-export',
      })
    );
  });

  it('does not log method_not_allowed for health routes', async () => {
    const response = await dispatchAuthRouteRequest(
      new Request('http://localhost/health/live', {
        method: 'POST',
        headers: {
          'X-Request-Id': 'req-health',
        },
      })
    );

    expect(response?.status).toBe(405);
    expect(routingLogger.warn).not.toHaveBeenCalled();
  });

  it('warns when auth route mappings diverge from declared paths', () => {
    verifyAuthRouteHandlerCoverage(['/auth/login', '/auth/me'], { '/auth/login': {} }, routingLogger as never);

    expect(routingLogger.warn).toHaveBeenCalledWith(
      'Auth route mapping differs from declared auth route paths',
      expect.objectContaining({
        missing_paths: '/auth/me',
        extra_paths: '',
      })
    );
  });

  it('stays silent when auth route mappings match declared paths', () => {
    verifyAuthRouteHandlerCoverage(['/auth/login', '/auth/me'], { '/auth/login': {}, '/auth/me': {} }, routingLogger as never);

    expect(routingLogger.warn).not.toHaveBeenCalled();
  });
});
