import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  redisReady: vi.fn(async () => true),
  redisError: vi.fn(() => null as string | null),
  resolvePool: vi.fn(),
  resolveIdentityProvider: vi.fn(),
  resolveTenantAuthClientSecret: vi.fn(),
  isKeycloakIdentityProvider: vi.fn(() => true),
  trackKeycloakCall: vi.fn(async (_operation: string, work: () => Promise<unknown>) => work()),
  getPermissionCacheHealth: vi.fn(() => ({
    coldStart: false,
    consecutiveRedisFailures: 0,
    lastRedisLatencyMs: 0,
    recomputePerMinute: 0,
    status: 'ready' as const,
  })),
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

vi.mock('./config-tenant-secret.js', () => ({
  resolveTenantAuthClientSecret: state.resolveTenantAuthClientSecret,
}));

vi.mock('./iam-authorization/shared.js', () => ({
  getPermissionCacheHealth: state.getPermissionCacheHealth,
}));

const createReadyPool = () => ({
  connect: vi.fn(async () => ({
    query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM iam.instances')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 1 };
    }),
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
    state.resolveTenantAuthClientSecret.mockResolvedValue({
      configured: true,
      readable: true,
      source: 'tenant',
      secret: 'tenant-secret',
    });
    state.isKeycloakIdentityProvider.mockReturnValue(true);
    state.trackKeycloakCall.mockImplementation(async (_operation: string, work: () => Promise<unknown>) => work());
    state.getPermissionCacheHealth.mockReturnValue({
      coldStart: false,
      consecutiveRedisFailures: 0,
      lastRedisLatencyMs: 0,
      recomputePerMinute: 0,
      status: 'ready',
    });
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
          lastRedisLatencyMs: 0,
          recomputePerMinute: 0,
          status: 'ready',
        },
        auth: {},
        db: true,
        redis: true,
        keycloak: true,
        errors: {},
        services: {
          authorizationCache: {
            status: 'ready',
          },
          database: { status: 'ready' },
          keycloak: { status: 'ready' },
          redis: { status: 'ready' },
        },
      },
    });
    expect(state.trackKeycloakCall).toHaveBeenCalledWith('readiness_list_roles', expect.any(Function));
    expect(state.resolveTenantAuthClientSecret).not.toHaveBeenCalled();
    expect(state.getPermissionCacheHealth).toHaveBeenCalled();
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
          auth: { reason_code: 'database_not_configured' },
          db: { reason_code: 'database_not_configured' },
          redis: { reason_code: 'redis_ping_failed' },
          keycloak: { reason_code: 'keycloak_admin_not_configured' },
        },
        errors: {
          auth: 'Tenant login contract check requires IAM database configuration.',
          db: 'IAM database not configured',
          redis: 'redis down',
          keycloak: 'Keycloak admin client not configured',
        },
        services: {
          authorizationCache: {
            status: 'ready',
          },
          database: { reasonCode: 'database_not_configured', status: 'not_ready' },
          keycloak: { reasonCode: 'keycloak_admin_not_configured', status: 'not_ready' },
          redis: { reasonCode: 'redis_ping_failed', status: 'not_ready' },
        },
      },
    });
  });

  it('returns not_ready when the tenant login contract probe throws instead of failing the handler', async () => {
    state.resolvePool.mockReturnValue({
      connect: vi.fn(async () => ({
        query: vi.fn(async (sql: string) => {
          if (sql.includes('FROM iam.instances')) {
            throw new Error('tenant probe failed');
          }
          return { rows: [], rowCount: 1 };
        }),
        release: vi.fn(),
      })),
    });
    const { healthReadyHandler } = await import('./runtime-health.js');

    const response = await healthReadyHandler(new Request('http://localhost/health/ready'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'not_ready',
      checks: {
        diagnostics: {
          auth: { reason_code: 'tenant_login_contract_probe_failed' },
        },
        errors: {
          auth: 'tenant probe failed',
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

  it('returns not_ready when an active tenant instance misses login contract fields', async () => {
    state.resolvePool.mockReturnValue({
      connect: vi.fn(async () => ({
        query: vi.fn(async (sql: string) => {
          if (sql.includes('FROM iam.instances')) {
            return {
              rows: [
                {
                  auth_client_id: '',
                  auth_realm: 'tenant-a',
                  id: 'tenant-a',
                  primary_hostname: 'tenant-a.example.test',
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 1 };
        }),
        release: vi.fn(),
      })),
    });
    const { healthReadyHandler } = await import('./runtime-health.js');

    const response = await healthReadyHandler(new Request('http://localhost/health/ready'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'not_ready',
      checks: {
        diagnostics: {
          auth: {
            invalid_config_instance_ids: ['tenant-a'],
            reason_code: 'tenant_login_contract_incomplete',
          },
        },
        errors: {
          auth: 'Active tenant login contract is incomplete for at least one instance.',
        },
      },
    });
    expect(state.resolveTenantAuthClientSecret).not.toHaveBeenCalled();
  });

  it('returns not_ready when an active tenant instance lacks a readable tenant auth secret', async () => {
    state.resolvePool.mockReturnValue({
      connect: vi.fn(async () => ({
        query: vi.fn(async (sql: string) => {
          if (sql.includes('FROM iam.instances')) {
            return {
              rows: [
                {
                  auth_client_id: 'tenant-client',
                  auth_realm: 'tenant-a',
                  id: 'tenant-a',
                  primary_hostname: 'tenant-a.example.test',
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 1 };
        }),
        release: vi.fn(),
      })),
    });
    state.resolveTenantAuthClientSecret.mockResolvedValueOnce({
      configured: false,
      readable: false,
      reason: 'tenant_auth_client_secret_missing',
      source: 'tenant',
    });
    const { healthReadyHandler } = await import('./runtime-health.js');

    const response = await healthReadyHandler(new Request('http://localhost/health/ready'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'not_ready',
      checks: {
        diagnostics: {
          auth: {
            invalid_secret_instance_ids: ['tenant-a'],
            reason_code: 'tenant_auth_client_secret_missing',
          },
        },
        errors: {
          auth: 'Active tenant auth secrets are unavailable for at least one instance.',
        },
      },
    });
    expect(state.resolveTenantAuthClientSecret).toHaveBeenCalledWith('tenant-a', {
      allowGlobalFallback: false,
    });
  });

  it('returns not_ready when authorization cache health has failed', async () => {
    state.getPermissionCacheHealth.mockReturnValue({
      coldStart: false,
      consecutiveRedisFailures: 3,
      lastRedisLatencyMs: 120,
      recomputePerMinute: 4,
      status: 'failed',
    });
    const { healthReadyHandler } = await import('./runtime-health.js');

    const response = await healthReadyHandler(new Request('http://localhost/health/ready'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'not_ready',
      checks: {
        authorizationCache: {
          coldStart: false,
          consecutiveRedisFailures: 3,
          lastRedisLatencyMs: 120,
          recomputePerMinute: 4,
          status: 'failed',
        },
        diagnostics: {
          authorizationCache: { reason_code: 'authorization_cache_failed' },
        },
        services: {
          authorizationCache: {
            reasonCode: 'authorization_cache_failed',
            status: 'not_ready',
          },
        },
      },
    });
  });

  it('returns degraded service details when authorization cache health is degraded', async () => {
    state.getPermissionCacheHealth.mockReturnValue({
      coldStart: true,
      consecutiveRedisFailures: 1,
      lastRedisLatencyMs: 70,
      recomputePerMinute: 21,
      status: 'degraded',
    });
    const { healthReadyHandler } = await import('./runtime-health.js');

    const response = await healthReadyHandler(new Request('http://localhost/health/ready'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      checks: {
        authorizationCache: {
          coldStart: true,
          consecutiveRedisFailures: 1,
          lastRedisLatencyMs: 70,
          recomputePerMinute: 21,
          status: 'degraded',
        },
        diagnostics: {
          authorizationCache: { reason_code: 'authorization_cache_degraded' },
        },
        services: {
          authorizationCache: {
            reasonCode: 'authorization_cache_degraded',
            status: 'degraded',
          },
        },
      },
    });
  });
});
