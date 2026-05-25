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
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: state.getWorkspaceContext,
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('../shared/request-security.js', () => ({
  validateCsrf: state.validateCsrf,
}));

vi.mock('../shared/request-helpers.js', () => ({
  createApiError: state.createApiError,
  parseRequestBody: async <T>(request: Request) => ({
    ok: true as const,
    data: (await request.json()) as T,
    rawBody: '',
  }),
}));

vi.mock('../plugin-operations/core.shared.js', () => ({
  createJsonItemResponse: state.createJsonItemResponse,
}));

vi.mock('./authorize-performance.server.js', () => ({
  readLatestAuthorizePerformanceBenchmark: state.readLatestAuthorizePerformanceBenchmark,
  runAuthorizePerformanceBenchmark: state.runAuthorizePerformanceBenchmark,
}));

const baseUser: SessionUser = {
  id: 'kc-user-1',
  instanceId: INSTANCE_ID,
  roles: ['system_admin'],
};

describe('authorize performance handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
        handler({ user: baseUser })
    );
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
  });

  it('fails closed for users without monitoring privileges', async () => {
    const { startAuthorizePerformanceRunHandler } = await import('./authorize-performance.js');
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
  });
});
