import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const notificationHandlers: Array<(payload: { payload?: string }) => void> = [];

  return {
    buildLogContext: vi.fn((workspaceId?: string, options?: { includeTraceId?: boolean }) => ({
      workspaceId,
      includeTraceId: options?.includeTraceId ?? false,
    })),
    cacheLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    authorizeLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1', traceId: 'trace-1' })),
    markPermissionCacheColdStart: vi.fn(() => true),
    buildPermissionCacheColdStartLog: vi.fn((instanceId: string) => ({
      message: `cold:${instanceId}`,
      attributes: { instanceId },
    })),
    processSnapshotInvalidationEvent: vi.fn(async () => undefined),
    parseInvalidationEvent: vi.fn(),
    withResolvedInstanceDb: vi.fn(async (_resolvePool, instanceId: string, work: (client: { tenant: string }) => Promise<unknown>) =>
      work({ tenant: instanceId })
    ),
    jsonResponse: vi.fn((status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    ),
    createPoolResolver: vi.fn(),
    getIamDatabaseUrl: vi.fn(() => 'postgres://iam.test/db'),
    connect: vi.fn(),
    listenQuery: vi.fn(async () => undefined),
    addCallback: vi.fn((callback: (result: { observe: (value: number) => void }) => void) => {
      callback({ observe: vi.fn() });
    }),
    histogramRecord: vi.fn(),
    cacheInvalidate: vi.fn(),
    notificationHandlers,
    safeParse: vi.fn(),
  };
});

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createHistogram: vi.fn(() => ({ record: mocks.histogramRecord })),
      createCounter: vi.fn(() => ({ add: vi.fn() })),
      createObservableGauge: vi.fn(() => ({ addCallback: mocks.addCallback })),
    })),
  },
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: vi.fn(({ component }: { component: string }) =>
    component === 'iam-cache' ? mocks.cacheLogger : mocks.authorizeLogger
  ),
  getWorkspaceContext: mocks.getWorkspaceContext,
}));

vi.mock('../iam-authorization-cache.js', () => ({
  PermissionSnapshotCache: class {
    public invalidate = mocks.cacheInvalidate;
  },
  parseInvalidationEvent: mocks.parseInvalidationEvent,
}));

vi.mock('./snapshot-invalidation.server.js', () => ({
  processSnapshotInvalidationEvent: mocks.processSnapshotInvalidationEvent,
}));

vi.mock('../db.js', () => ({
  createPoolResolver: mocks.createPoolResolver,
  jsonResponse: mocks.jsonResponse,
  withResolvedInstanceDb: mocks.withResolvedInstanceDb,
}));

vi.mock('../runtime-secrets.js', () => ({
  getIamDatabaseUrl: mocks.getIamDatabaseUrl,
}));

vi.mock('../shared/schemas.js', () => ({
  authorizeRequestSchema: {
    safeParse: mocks.safeParse,
  },
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: mocks.buildLogContext,
}));

vi.mock('./shared-cache-health.js', () => ({
  cacheMetricsState: { lookups: 0, staleLookups: 0 },
  buildPermissionCacheColdStartLog: mocks.buildPermissionCacheColdStartLog,
  markPermissionCacheColdStart: mocks.markPermissionCacheColdStart,
}));

const importShared = async () => import('./shared.js');

describe('iam authorization shared helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.notificationHandlers.splice(0);
    mocks.connect.mockResolvedValue({
      query: mocks.listenQuery,
      on: vi.fn((event: string, handler: (payload: { payload?: string }) => void) => {
        if (event === 'notification') {
          mocks.notificationHandlers.push(handler);
        }
      }),
    });
    mocks.createPoolResolver.mockReturnValue(() => ({
      connect: mocks.connect,
    }));
    mocks.safeParse.mockImplementation((payload: unknown) =>
      payload && typeof payload === 'object' && 'instanceId' in (payload as Record<string, unknown>)
        ? { success: true, data: payload }
        : { success: false, error: 'invalid' }
    );
    mocks.parseInvalidationEvent.mockReturnValue({
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-user-1',
      trigger: 'pg_notify',
      event: { type: 'user_scope_changed', instanceId: 'tenant-a', keycloakSubject: 'kc-user-1' },
    });
  });

  it('delegates request context creation and cold-start logging', async () => {
    const { buildRequestContext, recordPermissionCacheColdStart } = await importShared();

    expect(buildRequestContext('tenant-a')).toEqual({
      workspaceId: 'tenant-a',
      includeTraceId: true,
    });
    expect(mocks.buildLogContext).toHaveBeenCalledWith('tenant-a', { includeTraceId: true });

    recordPermissionCacheColdStart('tenant-a');
    expect(mocks.cacheLogger.info).toHaveBeenCalledWith('cold:tenant-a', { instanceId: 'tenant-a' });

    mocks.markPermissionCacheColdStart.mockReturnValueOnce(false);
    recordPermissionCacheColdStart('tenant-b');
    expect(mocks.cacheLogger.info).toHaveBeenCalledTimes(1);
  });

  it('normalizes effective permission provenance deterministically', async () => {
    const { toEffectivePermissions } = await importShared();

    expect(
      toEffectivePermissions([
        {
          permission_key: 'news.publish',
          action: ' news.publish ',
          resource_type: ' news ',
          resource_id: ' article-1 ',
          effect: 'allow',
          organization_id: '11111111-1111-4111-8111-111111111111',
          account_id: 'user-b',
          role_id: 'role-2',
          group_id: 'group-b',
          group_key: 'publishers',
          source_kind: 'group_role',
        },
        {
          permission_key: 'news.publish',
          action: 'news.publish',
          resource_type: 'news',
          resource_id: 'article-1',
          organization_id: '11111111-1111-4111-8111-111111111111',
          account_id: 'user-a',
          role_id: 'role-1',
          group_id: 'group-a',
          source_kind: 'direct_user',
        },
        {
          permission_key: 'system.audit',
          organization_id: null,
          effect: 'deny',
          source_kind: 'direct_role',
        },
      ])
    ).toEqual([
      {
        action: 'news.publish',
        resourceType: 'news',
        resourceId: 'article-1',
        organizationId: '11111111-1111-4111-8111-111111111111',
        effect: 'allow',
        sourceUserIds: ['user-a', 'user-b'],
        sourceRoleIds: ['role-1', 'role-2'],
        sourceGroupIds: ['group-a', 'group-b'],
        groupName: 'publishers',
        provenance: { sourceKinds: ['direct_user', 'group_role'] },
      },
      {
        action: 'system.audit',
        resourceType: 'system',
        effect: 'deny',
        provenance: { sourceKinds: ['direct_role'] },
      },
    ]);
  });

  it('parses authorize requests and returns typed error responses', async () => {
    const { loadAuthorizeRequest, errorResponse } = await importShared();

    await expect(
      loadAuthorizeRequest(
        new Request('http://localhost/authorize', {
          method: 'POST',
          body: JSON.stringify({
            instanceId: 'tenant-a',
            action: 'content.read',
            resource: { type: 'content' },
          }),
        })
      )
    ).resolves.toMatchObject({ instanceId: 'tenant-a', action: 'content.read' });

    await expect(
      loadAuthorizeRequest(
        new Request('http://localhost/authorize', {
          method: 'POST',
          body: '{"broken"',
        })
      )
    ).resolves.toBeNull();

    await expect(
      loadAuthorizeRequest(
        new Request('http://localhost/authorize', {
          method: 'POST',
          body: JSON.stringify({ nope: true }),
        })
      )
    ).resolves.toBeNull();

    const response = errorResponse(403, 'forbidden');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'forbidden' });
  });

  it('builds permission responses with provenance and request metadata', async () => {
    const { buildMePermissionsResponse } = await importShared();

    expect(
      buildMePermissionsResponse({
        instanceId: 'tenant-a',
        organizationId: '11111111-1111-4111-8111-111111111111',
        actorUserId: 'actor-1',
        effectiveUserId: 'user-1',
        isImpersonating: true,
        snapshotVersion: 'snap-1',
        cacheStatus: 'hit',
        permissions: [
          {
            action: 'content.read',
            resourceType: 'content',
            effect: 'allow',
            sourceUserIds: ['user-1'],
            sourceGroupIds: ['group-1'],
            scope: {
              allowedGeoUnitIds: ['11111111-1111-4111-8111-111111111112'],
            },
          },
        ],
      })
    ).toEqual({
      instanceId: 'tenant-a',
      organizationId: '11111111-1111-4111-8111-111111111111',
      permissions: [
        {
          action: 'content.read',
          resourceType: 'content',
          effect: 'allow',
          sourceUserIds: ['user-1'],
          sourceGroupIds: ['group-1'],
          scope: {
            allowedGeoUnitIds: ['11111111-1111-4111-8111-111111111112'],
          },
        },
      ],
      subject: {
        actorUserId: 'actor-1',
        effectiveUserId: 'user-1',
        isImpersonating: true,
      },
      evaluatedAt: expect.any(String),
      requestId: 'req-1',
      traceId: 'trace-1',
      snapshotVersion: 'snap-1',
      cacheStatus: 'hit',
      provenance: {
        hasDirectUserPermissions: true,
        hasGroupDerivedPermissions: true,
        hasGeoInheritance: true,
      },
    });
  });

  it('resolves request parameters and geo context defensively', async () => {
    const {
      resolveActingAsUserIdFromRequest,
      resolveGeoContextFromRequest,
      resolveInstanceIdFromRequest,
      resolveOrganizationIdFromRequest,
    } = await importShared();

    expect(
      resolveInstanceIdFromRequest(new Request('http://localhost/api?instanceId=tenant-a'), 'tenant-b')
    ).toBe('tenant-a');
    expect(resolveInstanceIdFromRequest(new Request('http://localhost/api'), 'tenant-b')).toBe('tenant-b');

    expect(
      resolveOrganizationIdFromRequest(
        new Request('http://localhost/api?organizationId=11111111-1111-4111-8111-111111111111')
      )
    ).toBe('11111111-1111-4111-8111-111111111111');
    expect(resolveOrganizationIdFromRequest(new Request('http://localhost/api?organizationId=bad-id'))).toBeNull();
    expect(resolveOrganizationIdFromRequest(new Request('http://localhost/api'))).toBeUndefined();

    expect(
      resolveActingAsUserIdFromRequest(new Request('http://localhost/api?actingAsUserId=user-2'))
    ).toBe('user-2');

    expect(
      resolveGeoContextFromRequest(
        new Request(
          'http://localhost/api?geoUnitId=11111111-1111-4111-8111-111111111111&geoHierarchy=11111111-1111-4111-8111-111111111112,11111111-1111-4111-8111-111111111112&geoHierarchy=11111111-1111-4111-8111-111111111113'
        )
      )
    ).toEqual({
      geoUnitId: '11111111-1111-4111-8111-111111111111',
      geoHierarchy: [
        '11111111-1111-4111-8111-111111111112',
        '11111111-1111-4111-8111-111111111113',
      ],
    });

    expect(resolveGeoContextFromRequest(new Request('http://localhost/api?geoUnitId=bad-id'))).toBeNull();
    expect(resolveGeoContextFromRequest(new Request('http://localhost/api?geoHierarchy=bad-id'))).toBeNull();

    const tooLongHierarchy = Array.from({ length: 33 }, (_, index) =>
      `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`
    );
    expect(
      resolveGeoContextFromRequest(
        new Request(`http://localhost/api?${tooLongHierarchy.map((entry) => `geoHierarchy=${entry}`).join('&')}`)
      )
    ).toBeNull();

    expect(resolveGeoContextFromRequest(new Request('http://localhost/api'))).toEqual({});
  });

  it('delegates instance-scoped database access', async () => {
    const { withInstanceScopedDb } = await importShared();

    await expect(
      withInstanceScopedDb('tenant-z', async (client) => `db:${(client as { tenant: string }).tenant}`)
    ).resolves.toBe('db:tenant-z');
    expect(mocks.withResolvedInstanceDb).toHaveBeenCalled();
  });

  it('initializes the invalidation listener and processes notification payloads', async () => {
    const { ensureInvalidationListener } = await importShared();

    await ensureInvalidationListener();
    await ensureInvalidationListener();

    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.listenQuery).toHaveBeenCalledWith('LISTEN iam_permission_snapshot_invalidation');
    expect(mocks.cacheLogger.info).toHaveBeenCalledWith(
      'Cache invalidation listener initialized',
      expect.objectContaining({
        operation: 'cache_invalidate',
        trigger: 'pg_notify',
        listener_ready: true,
      })
    );

    const [notify] = mocks.notificationHandlers;
    expect(notify).toBeTypeOf('function');

    notify({ payload: 'raw-payload' });
    await Promise.resolve();

    expect(mocks.cacheInvalidate).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-user-1',
    });
    expect(mocks.processSnapshotInvalidationEvent).toHaveBeenCalledWith({
      type: 'user_scope_changed',
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-user-1',
    });
    expect(mocks.histogramRecord).toHaveBeenCalled();
    expect(mocks.cacheLogger.info).toHaveBeenCalledWith(
      'Cache invalidation event received',
      expect.objectContaining({
        operation: 'cache_invalidate',
        affected_scope: 'user',
      })
    );
  });

  it('logs malformed notifications, async invalidation failures and init failures', async () => {
    const { ensureInvalidationListener } = await importShared();

    await ensureInvalidationListener();
    const [notify] = mocks.notificationHandlers;

    mocks.parseInvalidationEvent.mockReturnValueOnce(null);
    notify({ payload: 'broken' });
    expect(mocks.cacheLogger.warn).toHaveBeenCalledWith(
      'Cache invalidation payload could not be parsed',
      expect.objectContaining({
        operation: 'cache_invalidate_failed',
        payload: 'broken',
      })
    );

    mocks.processSnapshotInvalidationEvent.mockRejectedValueOnce(new Error('redis down'));
    notify({ payload: 'raw-payload' });
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.cacheLogger.error).toHaveBeenCalledWith(
      'Redis snapshot invalidation failed',
      expect.objectContaining({
        operation: 'cache_invalidate_failed',
        error: 'redis down',
      })
    );

    vi.resetModules();
    vi.clearAllMocks();
    mocks.notificationHandlers.splice(0);
    mocks.createPoolResolver.mockReturnValue(() => ({
      connect: vi.fn(async () => {
        throw new Error('connect failed');
      }),
    }));

    const reimported = await importShared();
    await reimported.ensureInvalidationListener();
    expect(mocks.cacheLogger.error).toHaveBeenCalledWith(
      'Failed to initialize cache invalidation listener',
      expect.objectContaining({
        operation: 'cache_invalidate_failed',
        error: 'connect failed',
      })
    );
  });

  it('returns early when no pool is configured', async () => {
    mocks.createPoolResolver.mockReturnValue(() => null);
    const { ensureInvalidationListener } = await importShared();

    await expect(ensureInvalidationListener()).resolves.toBeUndefined();
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
