import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  redisReady: vi.fn(async () => true),
  redisError: vi.fn(() => null as string | null),
  resolvePool: vi.fn(),
  resolveIdentityProvider: vi.fn(),
  isKeycloakIdentityProvider: vi.fn(() => true),
  trackKeycloakCall: vi.fn(async (_operation: string, work: () => Promise<unknown>) => work()),
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: () => ({ requestId: 'req-health' }),
  withRequestContext: (_input: unknown, work: () => Promise<unknown>) => work(),
}));

vi.mock('./redis.js', () => ({
  getLastRedisError: state.redisError,
  isRedisAvailable: state.redisReady,
}));

vi.mock('./db.js', () => ({
  jsonResponse: (status: number, payload: unknown, headers?: Record<string, string>) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    }),
  resolvePool: state.resolvePool,
}));

vi.mock('./iam-account-management/shared.js', () => ({
  isKeycloakIdentityProvider: state.isKeycloakIdentityProvider,
  resolveIdentityProvider: state.resolveIdentityProvider,
  trackKeycloakCall: state.trackKeycloakCall,
}));

const createReadyPool = () => ({
  connect: vi.fn(async () => ({
    query: vi.fn(async () => ({ rows: [], rowCount: 1 })),
    release: vi.fn(),
  })),
});

const createReadyIdentityProvider = () => ({
  provider: {
    listRoles: vi.fn(async () => []),
  },
});

describe('auth-runtime health handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolvePool.mockReturnValue(createReadyPool());
    state.redisReady.mockResolvedValue(true);
    state.redisError.mockReturnValue(null);
    state.resolveIdentityProvider.mockReturnValue(createReadyIdentityProvider());
    state.isKeycloakIdentityProvider.mockReturnValue(true);
    state.trackKeycloakCall.mockImplementation(async (_operation: string, work: () => Promise<unknown>) => work());
  });

  it('returns live status without dependency checks', async () => {
    const { healthLiveHandler } = await import('./runtime-health.js');

    const response = await healthLiveHandler(new Request('http://localhost/health/live'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'alive',
      path: '/health/live',
      requestId: 'req-health',
    });
  });

  it('returns ready when database, redis and keycloak are ready', async () => {
    const { healthReadyHandler } = await import('./runtime-health.js');

    const response = await healthReadyHandler(new Request('http://localhost/health/ready'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      checks: {
        authorizationCache: {
          coldStart: false,
          consecutiveRedisFailures: 0,
          recomputePerMinute: 0,
          status: 'empty',
        },
        auth: {},
        db: true,
        redis: true,
        keycloak: true,
        errors: {},
        services: {
          authorizationCache: {
            reasonCode: 'authorization_cache_unavailable',
            status: 'unknown',
          },
          database: { status: 'ready' },
          keycloak: { status: 'ready' },
          redis: { status: 'ready' },
        },
      },
    });
    expect(state.trackKeycloakCall).toHaveBeenCalledWith('readiness_list_roles', expect.any(Function));
  });

  it('returns not_ready when dependencies fail', async () => {
    state.resolvePool.mockReturnValue(null);
    state.redisReady.mockResolvedValue(false);
    state.redisError.mockReturnValue('redis down');
    state.resolveIdentityProvider.mockReturnValue(null);
    const { healthReadyHandler } = await import('./runtime-health.js');

    const response = await healthReadyHandler(new Request('http://localhost/health/ready'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'not_ready',
      checks: {
        db: false,
        redis: false,
        keycloak: false,
        diagnostics: {
          db: { reason_code: 'database_not_configured' },
          redis: { reason_code: 'redis_ping_failed' },
          keycloak: { reason_code: 'keycloak_admin_not_configured' },
        },
        errors: {
          db: 'IAM database not configured',
          redis: 'redis down',
          keycloak: 'Keycloak admin client not configured',
        },
        services: {
          authorizationCache: {
            reasonCode: 'authorization_cache_unavailable',
            status: 'unknown',
          },
          database: { reasonCode: 'database_not_configured', status: 'not_ready' },
          keycloak: { reasonCode: 'keycloak_admin_not_configured', status: 'not_ready' },
          redis: { reasonCode: 'redis_ping_failed', status: 'not_ready' },
        },
      },
    });
  });

  it('returns not_ready when keycloak readiness fails', async () => {
    state.resolveIdentityProvider.mockReturnValue({
      provider: {
        listRoles: vi.fn(async () => {
          throw new Error('keycloak down');
        }),
      },
    });
    const { healthReadyHandler } = await import('./runtime-health.js');

    const response = await healthReadyHandler(new Request('http://localhost/health/ready'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'not_ready',
      checks: {
        db: true,
        redis: true,
        keycloak: false,
        diagnostics: {
          keycloak: { reason_code: 'keycloak_dependency_failed' },
        },
        errors: {
          keycloak: 'keycloak down',
        },
        services: {
          database: { status: 'ready' },
          keycloak: { reasonCode: 'keycloak_dependency_failed', status: 'not_ready' },
          redis: { status: 'ready' },
        },
      },
    });
  });
});
