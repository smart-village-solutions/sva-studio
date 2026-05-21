import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStoreUnavailableError, SessionUserHydrationError } from './runtime-errors.js';

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  resolvePool: vi.fn(),
  withResolvedInstanceDb: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => logger,
  getWorkspaceContext: () => ({
    requestId: 'req-auth-runtime',
    traceId: 'trace-auth-runtime',
    workspaceId: 'de-musterhausen',
  }),
}));

vi.mock('./db.js', () => ({
  resolvePool: dbMocks.resolvePool,
  withResolvedInstanceDb: dbMocks.withResolvedInstanceDb,
}));

describe('middleware-guards', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    dbMocks.resolvePool.mockReturnValue({} as object);
    dbMocks.withResolvedInstanceDb.mockImplementation(async (_resolvePool, _instanceId, work) =>
      work({
        query: vi.fn(async () => ({
          rows: [{ deletion_lifecycle_state: 'active' }],
        })),
      })
    );
  });

  it('logs profile diagnostics only for enabled profile routes', async () => {
    vi.stubEnv('IAM_DEBUG_PROFILE_ERRORS', 'true');
    const { logProfileDiagnosticsIfEnabled } = await import('./middleware-guards.js');

    logProfileDiagnosticsIfEnabled(
      new Request('http://localhost/auth/me'),
      {
        id: 'user-1',
        roles: ['editor'],
        instanceId: 'de-musterhausen',
      } as never
    );

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
    const { logComplianceDiagnosticsIfEnabled, logProfileDiagnosticsIfEnabled } = await import('./middleware-guards.js');

    logProfileDiagnosticsIfEnabled(
      new Request('http://localhost/admin'),
      {
        id: 'user-1',
        roles: ['editor'],
        instanceId: 'de-musterhausen',
      } as never
    );
    vi.stubEnv('IAM_DEBUG_PROFILE_ERRORS', 'true');
    logComplianceDiagnosticsIfEnabled(
      new Request('http://localhost/admin'),
      {
        id: 'user-2',
        roles: ['editor'],
        instanceId: 'de-musterhausen',
      } as never
    );

    expect(logger.info).not.toHaveBeenCalled();
  });

  it('logs compliance diagnostics on supported profile routes when enabled', async () => {
    vi.stubEnv('IAM_DEBUG_PROFILE_ERRORS', 'true');
    const { logComplianceDiagnosticsIfEnabled } = await import('./middleware-guards.js');

    logComplianceDiagnosticsIfEnabled(
      new Request('http://localhost/api/v1/iam/users/me/profile'),
      {
        id: 'user-3',
        roles: ['editor'],
        instanceId: 'de-musterhausen',
      } as never
    );

    expect(logger.info).toHaveBeenCalledWith(
      'Auth middleware enforcing legal text compliance for self-service request',
      expect.objectContaining({
        user_id: 'user-3',
        session_instance_id: 'de-musterhausen',
      })
    );
  });

  it('returns null when lifecycle enforcement is bypassed and rejects blocked accounts otherwise', async () => {
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

    dbMocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolvePool, _instanceId, work) =>
      work({
        query: vi.fn(async () => ({
          rows: [{ deletion_lifecycle_state: 'deleted' }],
        })),
      })
    );

    const response = await ensureAccountLifecycleAllowsAccess(request, activeUser);

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: {
        code: 'forbidden',
        details: {
          lifecycle_state: 'deleted',
          reason_code: 'account_lifecycle_blocked',
        },
      },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Auth middleware rejected request because the account lifecycle is blocked',
      expect.objectContaining({
        lifecycle_state: 'deleted',
      })
    );
  });

  it('maps session store, hydration, and unexpected middleware failures to stable api errors', async () => {
    const { logUnexpectedMiddlewareError } = await import('./middleware-guards.js');
    const request = new Request('http://localhost/auth/me');

    const redisResponse = logUnexpectedMiddlewareError(
      request,
      new SessionStoreUnavailableError('load_session')
    );
    const hydrationResponse = logUnexpectedMiddlewareError(
      request,
      new SessionUserHydrationError({ reason: 'missing_instance_id', requestHost: 'tenant.example.com' })
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
