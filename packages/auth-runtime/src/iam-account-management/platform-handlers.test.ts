import { beforeEach, describe, expect, it, vi } from 'vitest';

type DbClient = {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
};

const state = vi.hoisted(() => {
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
  };

  return {
    logger,
    createSdkLogger: vi.fn(() => logger),
    getInstanceConfig: vi.fn(),
    getWorkspaceContext: vi.fn(() => ({ requestId: 'req-123' })),
    isCanonicalAuthHost: vi.fn(() => false),
    classifyHost: vi.fn(),
    isTrafficEnabledInstanceStatus: vi.fn(() => true),
    loadInstanceByHostname: vi.fn(),
    getPermissionCacheHealth: vi.fn(() => ({ status: 'ready' as const })),
    bootstrapStudioAppDbUserIfNeeded: vi.fn(),
    getLastRedisError: vi.fn(),
    isRedisAvailable: vi.fn(),
    jsonResponse: vi.fn((status: number, payload: unknown) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    ),
    resolveEffectiveRequestHost: vi.fn(),
    resolveIdentityProvider: vi.fn(),
    resolvePool: vi.fn(),
    isKeycloakIdentityProvider: vi.fn(),
    trackKeycloakCall: vi.fn(),
    addActiveSpanEvent: vi.fn(),
    annotateActiveSpan: vi.fn(),
    runCriticalIamSchemaGuard: vi.fn(),
    summarizeSchemaGuardFailures: vi.fn(),
  };
});

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: state.createSdkLogger,
  getInstanceConfig: state.getInstanceConfig,
  getWorkspaceContext: state.getWorkspaceContext,
  isCanonicalAuthHost: state.isCanonicalAuthHost,
}));

vi.mock('@sva/core', () => ({
  classifyHost: state.classifyHost,
  isTrafficEnabledInstanceStatus: state.isTrafficEnabledInstanceStatus,
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadInstanceByHostname: state.loadInstanceByHostname,
}));

vi.mock('../iam-authorization/shared.js', () => ({
  getPermissionCacheHealth: state.getPermissionCacheHealth,
}));

vi.mock('../postgres-app-user-bootstrap.js', () => ({
  bootstrapStudioAppDbUserIfNeeded: state.bootstrapStudioAppDbUserIfNeeded,
}));

vi.mock('../redis.js', () => ({
  getLastRedisError: state.getLastRedisError,
  isRedisAvailable: state.isRedisAvailable,
}));

vi.mock('../db.js', () => ({
  jsonResponse: state.jsonResponse,
}));

vi.mock('../request-hosts.js', () => ({
  resolveEffectiveRequestHost: state.resolveEffectiveRequestHost,
}));

vi.mock('./shared.js', () => ({
  isKeycloakIdentityProvider: state.isKeycloakIdentityProvider,
  resolveIdentityProvider: state.resolveIdentityProvider,
  resolvePool: state.resolvePool,
  trackKeycloakCall: state.trackKeycloakCall,
}));

vi.mock('./diagnostics.js', () => ({
  addActiveSpanEvent: state.addActiveSpanEvent,
  annotateActiveSpan: state.annotateActiveSpan,
}));

vi.mock('./schema-guard.js', () => ({
  runCriticalIamSchemaGuard: state.runCriticalIamSchemaGuard,
  summarizeSchemaGuardFailures: state.summarizeSchemaGuardFailures,
}));

const defaultEnv = {
  KEYCLOAK_ADMIN_REALM: 'platform-realm',
  KEYCLOAK_ADMIN_CLIENT_ID: 'platform-admin-client',
  SVA_AUTH_ISSUER: 'https://auth.example.test/realms/platform-fallback',
};

const createDbClient = (): DbClient => ({
  query: vi.fn().mockResolvedValue(undefined),
  release: vi.fn(),
});

const importSubject = async () => import('./platform-handlers.js');

describe('platform handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    vi.stubEnv('KEYCLOAK_ADMIN_REALM', defaultEnv.KEYCLOAK_ADMIN_REALM);
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_ID', defaultEnv.KEYCLOAK_ADMIN_CLIENT_ID);
    vi.stubEnv('SVA_AUTH_ISSUER', defaultEnv.SVA_AUTH_ISSUER);

    state.getWorkspaceContext.mockReturnValue({ requestId: 'req-123' });
    state.getInstanceConfig.mockReturnValue(undefined);
    state.isCanonicalAuthHost.mockReturnValue(false);
    state.classifyHost.mockReturnValue({ kind: 'unknown' });
    state.isTrafficEnabledInstanceStatus.mockReturnValue(true);
    state.loadInstanceByHostname.mockResolvedValue(null);
    state.getPermissionCacheHealth.mockReturnValue({ status: 'ready' });
    state.bootstrapStudioAppDbUserIfNeeded.mockResolvedValue(false);
    state.getLastRedisError.mockReturnValue('redis down');
    state.isRedisAvailable.mockResolvedValue(true);
    state.resolveEffectiveRequestHost.mockReturnValue('platform.example.test');
    state.resolveIdentityProvider.mockReturnValue(null);
    state.resolvePool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(createDbClient()),
    });
    state.isKeycloakIdentityProvider.mockReturnValue(false);
    state.trackKeycloakCall.mockImplementation(async (_operation: string, handler: () => Promise<unknown>) => handler());
    state.runCriticalIamSchemaGuard.mockResolvedValue({ ok: true, checks: [] });
    state.summarizeSchemaGuardFailures.mockReturnValue('schema drift detected');
  });

  it('returns alive payload with request context in liveInternal', async () => {
    const { liveInternal } = await importSubject();

    const response = await liveInternal(new Request('https://platform.example.test/internal/live'));
    const payload = (await response.json()) as {
      path: string;
      requestId: string;
      status: string;
    };

    expect(response.status).toBe(200);
    expect(payload.status).toBe('alive');
    expect(payload.requestId).toBe('req-123');
    expect(payload.path).toBe('/internal/live');
  });

  it('maps missing pool, redis failure and missing keycloak admin client to not_ready services', async () => {
    const { readyInternal } = await importSubject();

    state.resolvePool.mockReturnValue(null);
    state.isRedisAvailable.mockResolvedValue(false);
    state.getPermissionCacheHealth.mockReturnValue({ status: 'failed' });

    const response = await readyInternal(new Request('https://platform.example.test/internal/ready'));
    const payload = (await response.json()) as {
      status: string;
      checks: {
        auth: { scopeKind: string; activeRealm?: string };
        authorizationCache: { status: string };
        errors: Record<string, string>;
        services: Record<string, { reasonCode?: string; status: string }>;
      };
      path: string;
      requestId: string;
    };

    expect(response.status).toBe(503);
    expect(payload.status).toBe('not_ready');
    expect(payload.requestId).toBe('req-123');
    expect(payload.path).toBe('/internal/ready');
    expect(payload.checks.auth).toMatchObject({
      scopeKind: 'platform',
      activeRealm: 'platform-realm',
    });
    expect(payload.checks.errors).toEqual({
      db: 'IAM database not configured',
      redis: 'redis down',
      keycloak: 'Keycloak admin client not configured',
    });
    expect(payload.checks.authorizationCache.status).toBe('failed');
    expect(payload.checks.services).toMatchObject({
      authorizationCache: { reasonCode: 'authorization_cache_failed', status: 'not_ready' },
      database: { status: 'not_ready' },
      redis: { reasonCode: 'redis_ping_failed', status: 'not_ready' },
      keycloak: { reasonCode: 'keycloak_admin_not_configured', status: 'not_ready' },
    });
    expect(state.logger.error).toHaveBeenCalledTimes(3);
    expect(state.annotateActiveSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        'dependency.database.status': 'not_ready',
        'dependency.redis.status': 'not_ready',
        'dependency.keycloak.status': 'not_ready',
      })
    );
  });

  it('bootstraps the db user on first connect failure and reports degraded authorization cache', async () => {
    const { readyInternal } = await importSubject();

    const dbClient = createDbClient();
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error('role missing'))
      .mockResolvedValueOnce(dbClient);
    const listRoles = vi.fn().mockResolvedValue([{ id: 'role-1' }]);

    state.resolvePool.mockReturnValue({ connect });
    state.bootstrapStudioAppDbUserIfNeeded.mockResolvedValue(true);
    state.resolveIdentityProvider.mockReturnValue({
      provider: { listRoles },
    });
    state.isKeycloakIdentityProvider.mockReturnValue(true);
    state.getPermissionCacheHealth.mockReturnValue({ status: 'degraded' });

    const response = await readyInternal(new Request('https://platform.example.test/internal/ready'));
    const payload = (await response.json()) as {
      status: string;
      checks: {
        diagnostics: Record<string, unknown>;
        services: Record<string, { reasonCode?: string; status: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.status).toBe('degraded');
    expect(connect).toHaveBeenCalledTimes(2);
    expect(dbClient.query).toHaveBeenCalledWith('SELECT 1;');
    expect(dbClient.release).toHaveBeenCalledTimes(1);
    expect(state.bootstrapStudioAppDbUserIfNeeded).toHaveBeenCalledTimes(1);
    expect(state.trackKeycloakCall).toHaveBeenCalledTimes(1);
    expect(listRoles).toHaveBeenCalledTimes(1);
    expect(payload.checks.diagnostics).toEqual({});
    expect(payload.checks.services.authorizationCache).toEqual({
      reasonCode: 'authorization_cache_degraded',
      status: 'degraded',
    });
    expect(state.logger.warn).toHaveBeenCalledWith(
      'iam_readiness_degraded',
      expect.objectContaining({
        dependency: 'authorization_cache',
        reason_code: 'authorization_cache_degraded',
      })
    );
  });

  it('returns tenant auth metadata and schema drift diagnostics when the critical schema guard fails', async () => {
    const { readyInternal } = await importSubject();

    const dbClient = createDbClient();

    state.getInstanceConfig.mockReturnValue({ parentDomain: 'example.test' });
    state.classifyHost.mockReturnValue({ kind: 'tenant' });
    state.resolveEffectiveRequestHost.mockReturnValue('tenant.example.test');
    state.loadInstanceByHostname.mockResolvedValue({
      status: 'active',
      authRealm: 'tenant-realm',
      authClientId: 'tenant-login-client',
      tenantAdminClient: undefined,
    });
    state.resolvePool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(dbClient),
    });
    state.runCriticalIamSchemaGuard.mockResolvedValue({ ok: false, checks: [{ schemaObject: 'iam.groups' }] });
    state.resolveIdentityProvider.mockReturnValue({
      provider: { kind: 'mock-non-keycloak' },
    });

    const response = await readyInternal(new Request('https://platform.example.test/internal/ready'));
    const payload = (await response.json()) as {
      status: string;
      checks: {
        auth: {
          activeRealm: string;
          breakGlass: { configured: boolean };
          login: { configured: boolean };
          platformAdmin: { configured: boolean };
          scopeKind: string;
          tenantAdmin: { configured: boolean; fallbackToLoginClient: boolean; secretConfigured: boolean };
        };
        diagnostics: {
          db: {
            reason_code: string;
            schema_guard: { ok: boolean };
          };
        };
        errors: Record<string, string>;
        services: Record<string, { reasonCode?: string; status: string }>;
      };
    };

    expect(response.status).toBe(503);
    expect(payload.status).toBe('not_ready');
    expect(payload.checks.auth).toMatchObject({
      scopeKind: 'instance',
      activeRealm: 'tenant-realm',
      login: { configured: true },
      tenantAdmin: {
        configured: false,
        fallbackToLoginClient: true,
        secretConfigured: false,
      },
      platformAdmin: { configured: true },
      breakGlass: { configured: true },
    });
    expect(payload.checks.errors.db).toBe('schema drift detected');
    expect(payload.checks.diagnostics.db).toMatchObject({
      reason_code: 'schema_drift',
      schema_guard: { ok: false },
    });
    expect(payload.checks.services.database).toEqual({
      reasonCode: 'schema_drift',
      status: 'not_ready',
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'iam_readiness_dependency_failed',
      expect.objectContaining({
        dependency: 'database',
        reason_code: 'schema_drift',
      })
    );
    expect(state.trackKeycloakCall).not.toHaveBeenCalled();
  });

  it('falls back to platform auth metadata and maps keycloak errors when tenant lookup and keycloak checks fail', async () => {
    const { readyInternal } = await importSubject();

    const keycloakError = new Error('keycloak unavailable');

    state.getInstanceConfig.mockReturnValue({ parentDomain: 'example.test' });
    state.classifyHost.mockReturnValue({ kind: 'tenant' });
    state.resolveEffectiveRequestHost.mockReturnValue('tenant.example.test');
    state.loadInstanceByHostname.mockRejectedValue(new Error('lookup unavailable'));
    state.resolveIdentityProvider.mockReturnValue({
      provider: { listRoles: vi.fn().mockRejectedValue(keycloakError) },
    });
    state.isKeycloakIdentityProvider.mockReturnValue(true);
    state.trackKeycloakCall.mockImplementation(async (_operation: string, handler: () => Promise<unknown>) => handler());

    const response = await readyInternal(new Request('https://platform.example.test/internal/ready'));
    const payload = (await response.json()) as {
      status: string;
      checks: {
        auth: { activeRealm?: string; scopeKind: string };
        errors: Record<string, string>;
        services: Record<string, { reasonCode?: string; status: string }>;
      };
    };

    expect(response.status).toBe(503);
    expect(payload.status).toBe('not_ready');
    expect(payload.checks.auth).toMatchObject({
      scopeKind: 'platform',
      activeRealm: 'platform-realm',
    });
    expect(payload.checks.errors.keycloak).toBe('keycloak unavailable');
    expect(payload.checks.services.keycloak).toEqual({
      reasonCode: 'keycloak_dependency_failed',
      status: 'not_ready',
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'iam_readiness_dependency_failed',
      expect.objectContaining({
        dependency: 'keycloak',
        reason_code: 'keycloak_dependency_failed',
      })
    );
  });
});
