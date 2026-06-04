import { beforeEach, describe, expect, it, vi } from 'vitest';

type SessionUser = {
  id: string;
  instanceId?: string;
  roles: readonly string[];
};

const INSTANCE_ID = '11111111-1111-4111-8111-111111111111';

const state = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  withAuthenticatedUser: vi.fn(),
  validateCsrf: vi.fn(() => null),
  parseRequestBody: vi.fn(),
  createApiError: vi.fn(
    (status: number, code: string, message: string, requestId?: string) =>
      new Response(
        JSON.stringify({
          error: {
            code,
            message,
            requestId,
          },
        }),
        {
          status,
          headers: { 'Content-Type': 'application/json' },
        }
      )
  ),
  createJsonItemResponse: vi.fn((status: number, item: unknown) =>
    new Response(JSON.stringify({ data: item }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  runAuthorizePerformanceBenchmark: vi.fn(),
  readLatestAuthorizePerformanceBenchmark: vi.fn(() => null),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'request-1' })),
  withRequestContext: vi.fn(async (_input: unknown, work: () => Promise<Response>) => work()),
  authorizeInstancePermissionForUser: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: state.getWorkspaceContext,
  withRequestContext: state.withRequestContext,
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('../shared/request-security.js', () => ({
  validateCsrf: state.validateCsrf,
}));

vi.mock('../shared/request-helpers.js', () => ({
  createApiError: state.createApiError,
  parseRequestBody: state.parseRequestBody,
}));

vi.mock('../plugin-operations/core.shared.js', () => ({
  createJsonItemResponse: state.createJsonItemResponse,
}));

vi.mock('./authorize-performance.server.js', () => ({
  readLatestAuthorizePerformanceBenchmark: state.readLatestAuthorizePerformanceBenchmark,
  runAuthorizePerformanceBenchmark: state.runAuthorizePerformanceBenchmark,
}));

vi.mock('../instance-permission-authorization.js', () => ({
  authorizeInstancePermissionForUser: state.authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode: (error: string) =>
    error === 'missing_instance'
      ? 'invalid_instance_id'
      : error === 'invalid_action'
        ? 'invalid_request'
        : error === 'database_unavailable'
          ? 'database_unavailable'
          : 'forbidden',
}));

const baseUser: SessionUser = {
  id: 'kc-user-1',
  instanceId: INSTANCE_ID,
  roles: ['custom_role'],
};

describe('authorize performance handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.parseRequestBody.mockImplementation(async <T>(request: Request) => ({
      ok: true as const,
      data: (await request.json()) as T,
      rawBody: '',
    }));
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
        handler({ user: baseUser })
    );
    state.authorizeInstancePermissionForUser.mockResolvedValue({ ok: true, permissions: [] });
    state.runAuthorizePerformanceBenchmark.mockResolvedValue({
      generatedAt: '2026-05-25T18:00:00.000Z',
      measuredOn: 'server',
      actor: {
        instanceId: INSTANCE_ID,
        keycloakSubject: 'kc-user-1',
      },
      request: {
        action: 'content.read',
        resourceType: 'content',
      },
      configuration: {
        measuredRequests: 12,
        warmupRequests: 2,
      },
      scenarios: [],
    });
  });

  it('runs the benchmark with the current session user and request payload', async () => {
    const { startAuthorizePerformanceRunHandler } = await import('./authorize-performance.js');

    const response = await startAuthorizePerformanceRunHandler(
      new Request('https://studio.test/api/v1/iam/authorize-performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          action: 'content.read',
          resourceType: 'content',
          resourceId: 'article-1',
          organizationId: 'org-1',
          measuredRequests: 12,
          warmupRequests: 2,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(state.validateCsrf).toHaveBeenCalled();
    expect(state.runAuthorizePerformanceBenchmark).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({
          id: 'kc-user-1',
          instanceId: INSTANCE_ID,
        }),
        request: expect.objectContaining({
          action: 'content.read',
          resourceType: 'content',
          resourceId: 'article-1',
          organizationId: 'org-1',
        }),
      })
    );
    expect(state.withRequestContext).toHaveBeenCalledWith(
      {
        request: expect.any(Request),
        fallbackWorkspaceId: 'default',
      },
      expect.any(Function)
    );
  });

  it('fails closed for users without monitoring permissions', async () => {
    const { startAuthorizePerformanceRunHandler } = await import('./authorize-performance.js');
    state.authorizeInstancePermissionForUser.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für Authorize-Performance-Monitoring.',
    });
    state.withAuthenticatedUser.mockImplementationOnce(
      async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
        handler({
          user: {
            ...baseUser,
            roles: ['editor'],
          },
        })
    );

    const response = await startAuthorizePerformanceRunHandler(
      new Request('https://studio.test/api/v1/iam/authorize-performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          action: 'content.read',
          resourceType: 'content',
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(state.runAuthorizePerformanceBenchmark).not.toHaveBeenCalled();
  });

  it('rejects requests without an actor instance context', async () => {
    const { startAuthorizePerformanceRunHandler } = await import('./authorize-performance.js');
    state.withAuthenticatedUser.mockImplementationOnce(
      async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
        handler({
          user: {
            ...baseUser,
            instanceId: '   ',
          },
        })
    );

    const response = await startAuthorizePerformanceRunHandler(
      new Request('https://studio.test/api/v1/iam/authorize-performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          action: 'content.read',
          resourceType: 'content',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(state.validateCsrf).not.toHaveBeenCalled();
    expect(state.runAuthorizePerformanceBenchmark).not.toHaveBeenCalled();
  });

  it('returns csrf validation errors before parsing the payload', async () => {
    const { startAuthorizePerformanceRunHandler } = await import('./authorize-performance.js');
    state.validateCsrf.mockReturnValueOnce(
      new Response(JSON.stringify({ error: { code: 'invalid_csrf' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const response = await startAuthorizePerformanceRunHandler(
      new Request('https://studio.test/api/v1/iam/authorize-performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          action: 'content.read',
          resourceType: 'content',
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(state.runAuthorizePerformanceBenchmark).not.toHaveBeenCalled();
  });

  it('returns invalid request errors for rejected payloads', async () => {
    state.parseRequestBody.mockResolvedValueOnce({
      ok: false as const,
      message: 'payload invalid',
    });
    const { startAuthorizePerformanceRunHandler } = await import('./authorize-performance.js');

    const response = await startAuthorizePerformanceRunHandler(
      new Request('https://studio.test/api/v1/iam/authorize-performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          action: 'x',
          resourceType: '',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(state.runAuthorizePerformanceBenchmark).not.toHaveBeenCalled();
  });

  it('maps benchmark execution errors to a 503 api response', async () => {
    const { startAuthorizePerformanceRunHandler } = await import('./authorize-performance.js');
    state.runAuthorizePerformanceBenchmark.mockRejectedValueOnce(new Error('database offline'));

    const response = await startAuthorizePerformanceRunHandler(
      new Request('https://studio.test/api/v1/iam/authorize-performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          action: 'content.read',
          resourceType: 'content',
        }),
      })
    );

    expect(response.status).toBe(503);
    expect(state.logger.error).toHaveBeenCalledWith(
      'Authorize performance benchmark failed',
      expect.objectContaining({
        operation: 'authorize_performance_run',
        error: 'database offline',
      })
    );
  });

  it('returns the latest cached run through the read endpoint', async () => {
    const { getLatestAuthorizePerformanceRunHandler } = await import('./authorize-performance.js');
    state.readLatestAuthorizePerformanceBenchmark.mockReturnValueOnce({
      generatedAt: '2026-05-25T18:00:00.000Z',
      measuredOn: 'server',
      actor: {
        instanceId: INSTANCE_ID,
        keycloakSubject: 'kc-user-1',
      },
      request: {
        action: 'content.read',
        resourceType: 'content',
      },
      configuration: {
        measuredRequests: 12,
        warmupRequests: 2,
      },
      scenarios: [],
    });

    const response = await getLatestAuthorizePerformanceRunHandler(
      new Request('https://studio.test/api/v1/iam/authorize-performance', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(200);
    expect(state.readLatestAuthorizePerformanceBenchmark).toHaveBeenCalledWith({
      instanceId: INSTANCE_ID,
      keycloakSubject: 'kc-user-1',
    });
    expect(state.withRequestContext).toHaveBeenCalledWith(
      {
        request: expect.any(Request),
        fallbackWorkspaceId: 'default',
      },
      expect.any(Function)
    );
  });

  it('blocks latest-run access for users without monitoring permissions', async () => {
    const { getLatestAuthorizePerformanceRunHandler } = await import('./authorize-performance.js');
    state.authorizeInstancePermissionForUser.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für Authorize-Performance-Monitoring.',
    });
    state.withAuthenticatedUser.mockImplementationOnce(
      async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
        handler({
          user: {
            ...baseUser,
            roles: ['editor'],
          },
        })
    );

    const response = await getLatestAuthorizePerformanceRunHandler(
      new Request('https://studio.test/api/v1/iam/authorize-performance', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(403);
    expect(state.readLatestAuthorizePerformanceBenchmark).not.toHaveBeenCalled();
  });
});
