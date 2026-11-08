import { beforeEach, describe, expect, it, vi } from 'vitest';

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  jsonResponse: vi.fn((status: number, payload: unknown, headers?: Record<string, string>) => {
    const responseHeaders = new Headers(headers);
    responseHeaders.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
  }),
  resolvePool: vi.fn(),
  withResolvedInstanceDb: vi.fn(),
  query: vi.fn(),
  control: vi.fn(),
  getUserStatus: vi.fn(),
}));
vi.mock('./redis-session.js', () => ({ getSessionControlState: dbMocks.control }));
vi.mock('./iam-account-management/shared-runtime.js', () => ({
  resolveIdentityProvider: () => ({ provider: { getUserStatus: dbMocks.getUserStatus } }),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => logger,
  toSafeLogPath: (value: string) => new URL(value).pathname,
  getWorkspaceContext: () => ({
    requestId: 'req-auth-runtime',
    traceId: 'trace-auth-runtime',
    workspaceId: 'de-musterhausen',
  }),
}));

vi.mock('./db.js', () => ({
  jsonResponse: dbMocks.jsonResponse,
  resolvePool: dbMocks.resolvePool,
  withResolvedInstanceDb: dbMocks.withResolvedInstanceDb,
}));

describe('middleware-guards', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    dbMocks.resolvePool.mockReturnValue({} as object);
    dbMocks.control.mockResolvedValue(undefined);
    dbMocks.getUserStatus.mockResolvedValue(true);
    dbMocks.query.mockResolvedValue({ rows: [{ account_allowed: true }] });
    dbMocks.withResolvedInstanceDb.mockImplementation(async (_resolvePool, _instanceId, work) =>
      work({ query: dbMocks.query })
    );
  });

  it('logs profile diagnostics only for enabled profile routes', async () => {
    vi.stubEnv('IAM_DEBUG_PROFILE_ERRORS', 'true');
    const { logProfileDiagnosticsIfEnabled } = await import('./middleware-guards.js');

    logProfileDiagnosticsIfEnabled(new Request('http://localhost/auth/me'), {
      id: 'user-1',
      roles: ['editor'],
      instanceId: 'de-musterhausen',
    } as never);

    expect(logger.info).toHaveBeenCalledWith(
      'Auth middleware resolved session user for self-service diagnostics',
      expect.objectContaining({
        user_id: 'user-1',
        session_roles_count: 1,
        trace_id: 'trace-auth-runtime',
      })
    );
  });

  it('skips diagnostics logging when the feature flag is disabled or the route is unrelated', async () => {
    const { logComplianceDiagnosticsIfEnabled, logProfileDiagnosticsIfEnabled } =
      await import('./middleware-guards.js');

    logProfileDiagnosticsIfEnabled(new Request('http://localhost/admin'), {
      id: 'user-1',
      roles: ['editor'],
      instanceId: 'de-musterhausen',
    } as never);
    vi.stubEnv('IAM_DEBUG_PROFILE_ERRORS', 'true');
    logComplianceDiagnosticsIfEnabled(new Request('http://localhost/admin'), {
      id: 'user-2',
      roles: ['editor'],
      instanceId: 'de-musterhausen',
    } as never);

    expect(logger.info).not.toHaveBeenCalled();
  });

  it('logs compliance diagnostics on supported profile routes when enabled', async () => {
    vi.stubEnv('IAM_DEBUG_PROFILE_ERRORS', 'true');
    const { logComplianceDiagnosticsIfEnabled } = await import('./middleware-guards.js');

    logComplianceDiagnosticsIfEnabled(new Request('http://localhost/api/v1/iam/users/me/profile'), {
      id: 'user-3',
      roles: ['editor'],
      instanceId: 'de-musterhausen',
    } as never);

    expect(logger.info).toHaveBeenCalledWith(
      'Auth middleware enforcing legal text compliance for self-service request',
      expect.objectContaining({
        user_id: 'user-3',
        session_instance_id: 'de-musterhausen',
      })
    );
  });

  it('returns null when lifecycle enforcement is bypassed or handled through session revocation', async () => {
    const { ensureAccountLifecycleAllowsAccess } = await import('./middleware-guards.js');
    const request = new Request('http://localhost/auth/me');
    const activeUser = {
      id: 'user-1',
      roles: ['editor'],
      instanceId: 'de-musterhausen',
    } as never;

    await expect(
      ensureAccountLifecycleAllowsAccess(request, activeUser, { isLocalDevelopmentAuth: true })
    ).resolves.toBeNull();
    await expect(ensureAccountLifecycleAllowsAccess(request, activeUser)).resolves.toBeNull();
  });

  it('skips lifecycle database lookups on the authenticated hot path', async () => {
    const { ensureAccountLifecycleAllowsAccess } = await import('./middleware-guards.js');
    const request = new Request('http://localhost/auth/me');
    const activeUser = {
      id: 'user-1',
      roles: ['editor'],
      instanceId: 'de-musterhausen',
    } as never;

    await expect(ensureAccountLifecycleAllowsAccess(request, activeUser)).resolves.toBeNull();
    await expect(ensureAccountLifecycleAllowsAccess(request, activeUser)).resolves.toBeNull();

    expect(dbMocks.resolvePool).not.toHaveBeenCalled();
    expect(dbMocks.withResolvedInstanceDb).not.toHaveBeenCalled();
  });

  it('freshly checks the tenant account on every personal request even with retained roles', async () => {
    const { ensureAccountLifecycleAllowsAccess: check } = await import('./middleware-guards.js');
    const request = new Request('https://tenant.example/api/v1/iam/users');
    const user = { id: 'subject', instanceId: 'tenant', roles: ['system_admin'] };
    await expect(check(request, user, { requireCurrentAccount: true })).resolves.toBeNull();
    dbMocks.query.mockResolvedValue({ rows: [{ account_allowed: false }] });
    expect((await check(request, user, { requireCurrentAccount: true }))?.status).toBe(403);
    expect(dbMocks.query).toHaveBeenCalledTimes(2);
    expect(dbMocks.query).toHaveBeenCalledWith(expect.stringContaining("a.status = 'active'"), [
      'tenant',
      'subject',
    ]);
  });

  it('honors the existing Redis login block before reading account or roles', async () => {
    dbMocks.control.mockResolvedValue({ loginBlocked: true });
    const { ensureAccountLifecycleAllowsAccess: check } = await import('./middleware-guards.js');
    const result = await check(
      new Request('https://tenant.example/'),
      {
        id: 'subject',
        instanceId: 'tenant',
        roles: ['system_admin'],
      },
      { requireCurrentAccount: true }
    );
    expect(result?.status).toBe(403);
    expect(dbMocks.query).not.toHaveBeenCalled();
  });

  it.each(['redis', 'database'])(
    'does not grant access when %s cannot be read',
    async (dependency) => {
      if (dependency === 'redis') dbMocks.control.mockRejectedValue(new Error('unavailable'));
      else dbMocks.query.mockRejectedValue(new Error('unavailable'));
      const { ensureAccountLifecycleAllowsAccess: check } = await import('./middleware-guards.js');
      expect(
        (
          await check(
            new Request('https://tenant.example/'),
            {
              id: 'subject',
              instanceId: 'tenant',
              roles: [],
            },
            { requireCurrentAccount: true }
          )
        )?.status
      ).toBe(503);
    }
  );

  it.each([true, false, null])(
    'checks platform status %s without inventing a tenant account',
    async (enabled) => {
      dbMocks.getUserStatus.mockResolvedValue(enabled);
      const { ensureAccountLifecycleAllowsAccess: check } = await import('./middleware-guards.js');
      const result = await check(
        new Request('https://studio.example/'),
        {
          id: 'platform-subject',
          roles: ['system_admin'],
        },
        { requireCurrentAccount: true }
      );
      expect(result?.status ?? null).toBe(enabled === true ? null : 403);
      expect(dbMocks.getUserStatus).toHaveBeenCalledWith('platform-subject');
      expect(dbMocks.query).not.toHaveBeenCalled();
    }
  );

  it('fails closed when the platform status cannot be verified', async () => {
    dbMocks.getUserStatus.mockRejectedValue(new Error('unavailable'));
    const { ensureAccountLifecycleAllowsAccess: check } = await import('./middleware-guards.js');
    expect(
      (
        await check(
          new Request('https://studio.example/'),
          {
            id: 'platform-subject',
            roles: [],
          },
          { requireCurrentAccount: true }
        )
      )?.status
    ).toBe(503);
  });

  it('maps session store, hydration, and unexpected middleware failures to stable api errors', async () => {
    const { logUnexpectedMiddlewareError } = await import('./middleware-guards.js');
    const {
      SessionStoreUnavailableError: RuntimeSessionStoreUnavailableError,
      SessionUserHydrationError: RuntimeSessionUserHydrationError,
    } = await import('./runtime-errors.js');
    const request = new Request('http://localhost/auth/me');

    const redisResponse = logUnexpectedMiddlewareError(
      request,
      new RuntimeSessionStoreUnavailableError('load_session')
    );
    const hydrationResponse = logUnexpectedMiddlewareError(
      request,
      new RuntimeSessionUserHydrationError({
        reason: 'missing_instance_id',
        requestHost: 'tenant.example.com',
      })
    );
    const genericResponse = logUnexpectedMiddlewareError(request, new Error('boom'));

    expect(redisResponse.status).toBe(503);
    await expect(redisResponse.json()).resolves.toMatchObject({
      error: {
        code: 'internal_error',
        details: {
          dependency: 'redis',
          reason_code: 'session_store_unavailable',
        },
      },
    });
    expect(hydrationResponse.status).toBe(401);
    await expect(hydrationResponse.json()).resolves.toMatchObject({
      error: {
        code: 'unauthorized',
        details: {
          reason_code: 'missing_session_instance_id',
          request_host: 'tenant.example.com',
        },
      },
    });
    expect(genericResponse.status).toBe(500);
    await expect(genericResponse.json()).resolves.toMatchObject({
      error: {
        code: 'internal_error',
        details: {
          reason_code: 'auth_resolution_failed',
        },
      },
    });
    const unknownResponse = logUnexpectedMiddlewareError(request, 'boom-string');

    expect(unknownResponse.status).toBe(500);
    await expect(unknownResponse.json()).resolves.toMatchObject({
      error: {
        code: 'internal_error',
        details: {
          reason_code: 'auth_resolution_failed',
        },
      },
    });
    expect(logger.error).toHaveBeenCalledTimes(3);
  });
});
