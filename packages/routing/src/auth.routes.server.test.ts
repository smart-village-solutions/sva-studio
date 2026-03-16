import { beforeEach, describe, expect, it, vi } from 'vitest';

const routingLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => routingLogger,
  getHeadersFromRequest: (request: Request) => {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return headers;
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
  resolveAuthHandlers,
  verifyAuthRouteHandlerCoverage,
  wrapHandlersWithJsonErrorBoundary,
} from './auth.routes.server';

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
    listLegalTextsHandler: vi.fn(async () => response('listLegalTextsHandler')),
    createLegalTextHandler: vi.fn(async () => response('createLegalTextHandler')),
    updateLegalTextHandler: vi.fn(async () => response('updateLegalTextHandler')),
    reconcileHandler: vi.fn(async () => response('reconcileHandler')),
    listGovernanceCasesHandler: vi.fn(async () => response('listGovernanceCasesHandler')),
    governanceWorkflowHandler: vi.fn(async () => response('governanceWorkflowHandler')),
    governanceComplianceExportHandler: vi.fn(async () => response('governanceComplianceExportHandler')),
    dataExportHandler: vi.fn(async () => response('dataExportHandler')),
    dataExportStatusHandler: vi.fn(async () => response('dataExportStatusHandler')),
    getMyDataSubjectRightsHandler: vi.fn(async () => response('getMyDataSubjectRightsHandler')),
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
    expect(authServerMocks.listLegalTextsHandler).toHaveBeenCalled();
    expect(authServerMocks.updateLegalTextHandler).toHaveBeenCalled();
    expect(authServerMocks.dataSubjectMaintenanceHandler).toHaveBeenCalled();
  });

  it('throws for unknown auth path', () => {
    expect(() => resolveAuthHandlers('/auth/unknown')).toThrow('Unknown auth route path');
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
      message: 'Ein unerwarteter Server-Fehler ist aufgetreten.',
      requestId: 'req-123',
    });
    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in auth route handler',
      expect.objectContaining({
        method: 'GET',
        route: '/auth/me',
        request_id: 'req-123',
        trace_id: '0123456789abcdef0123456789abcdef',
        error_type: 'Error',
        error_message: 'boom',
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
      'Unhandled exception in auth route handler',
      expect.objectContaining({
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
      'Unhandled exception in auth route handler',
      expect.objectContaining({
        trace_id: undefined,
      })
    );
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
