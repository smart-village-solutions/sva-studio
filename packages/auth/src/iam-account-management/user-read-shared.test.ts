import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  workspaceContext: { requestId: 'req-user-shared', traceId: 'trace-user-shared' },
  featureCheck: null as any,
  roleCheck: null as any,
  actorResolution: {
    actor: {
      instanceId: 'test-instance',
      actorAccountId: 'account-1',
      requestId: 'req-user-shared',
      traceId: 'trace-user-shared',
    },
  },
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: () => state.workspaceContext,
}));

vi.mock('./shared.js', () => ({
  requireRoles: vi.fn(() => state.roleCheck),
  resolveActorInfo: vi.fn(async () => state.actorResolution),
}));

vi.mock('./feature-flags.js', () => ({
  getFeatureFlags: vi.fn(() => ({})),
  ensureFeature: vi.fn(() => state.featureCheck),
}));

vi.mock('./api-helpers.js', () => ({
  createApiError: (status: number, code: string, message: string, requestId?: string) =>
    new Response(
      JSON.stringify({
        error: { code, message },
        ...(requestId ? { requestId } : {}),
      }),
      { status, headers: { 'content-type': 'application/json' } }
    ),
  readPathSegment: vi.fn((request: Request, segmentIndex: number) => {
    const pathname = new URL(request.url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    return segments[segmentIndex - 1]; // Adjust for 1-based vs 0-based indexing
  }),
}));

vi.mock('../shared/input-readers.js', () => ({
  isUuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
}));

vi.mock('./diagnostics.js', () => ({
  classifyIamDiagnosticError: vi.fn((error: unknown, fallbackMessage: string) => ({
    status: 500,
    code: 'internal_error',
    message: fallbackMessage,
    details: { reason_code: 'unexpected_internal_error' },
  })),
}));

describe('user-read-shared', () => {
  beforeEach(() => {
    state.featureCheck = null;
    state.roleCheck = null;
    state.actorResolution = {
      actor: {
        instanceId: 'test-instance',
        actorAccountId: 'account-1',
        requestId: 'req-user-shared',
        traceId: 'trace-user-shared',
      },
    };
  });

  describe('resolveUserReadAccess', () => {
    it('returns response when feature flag check fails', async () => {
      const featureCheckResponse = new Response(JSON.stringify({ error: 'feature_disabled' }), {
        status: 403,
      });
      state.featureCheck = featureCheckResponse;

      const { resolveUserReadAccess } = await import('./user-read-shared');

      const request = new Request('http://localhost/users');
      const ctx = { user: { id: 'actor-1' } } as any;

      const result = await resolveUserReadAccess(request, ctx);

      expect(result).toHaveProperty('response');
      expect((result as { response: Response }).response).toBe(featureCheckResponse);
    });

    it('returns response when role check fails', async () => {
      const roleCheckResponse = new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
      });
      state.roleCheck = roleCheckResponse;

      const { resolveUserReadAccess } = await import('./user-read-shared');

      const request = new Request('http://localhost/users');
      const ctx = { user: { id: 'actor-1' } } as any;

      const result = await resolveUserReadAccess(request, ctx);

      expect(result).toHaveProperty('response');
      expect((result as { response: Response }).response).toBe(roleCheckResponse);
    });

    it('returns response when actor resolution fails', async () => {
      const errorResponse = new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
      });
      state.actorResolution = { error: errorResponse };

      const { resolveUserReadAccess } = await import('./user-read-shared');

      const request = new Request('http://localhost/users');
      const ctx = { user: { id: 'actor-1' } } as any;

      const result = await resolveUserReadAccess(request, ctx);

      expect(result).toHaveProperty('response');
    });

    it('returns actor when all checks pass', async () => {
      const { resolveUserReadAccess } = await import('./user-read-shared');

      const request = new Request('http://localhost/users');
      const ctx = { user: { id: 'actor-1' } } as any;

      const result = await resolveUserReadAccess(request, ctx);

      expect(result).toHaveProperty('actor');
      expect((result as any).actor.instanceId).toBe('test-instance');
    });
  });

  describe('readValidatedUserId', () => {
    it('returns response for missing userId', async () => {
      const { readValidatedUserId } = await import('./user-read-shared');

      const request = new Request('http://localhost/users/');
      const result = readValidatedUserId(request, 'req-1');

      expect(result).toHaveProperty('response');
    });

    it('returns response for invalid UUID', async () => {
      const { readValidatedUserId } = await import('./user-read-shared');

      const request = new Request('http://localhost/users/not-a-uuid');
      const result = readValidatedUserId(request, 'req-1');

      expect(result).toHaveProperty('response');
    });
  });

  describe('createDatabaseApiError', () => {
    it('creates API error with classified diagnostic error', async () => {
      const { createDatabaseApiError } = await import('./user-read-shared');

      const error = new Error('Connection timeout');
      const response = createDatabaseApiError(error, 'req-1');

      expect(response.status).toBe(500);
    });
  });

  describe('logUserProjectionDegraded', () => {
    it('logs warning when keycloak roles fail', async () => {
      const { logUserProjectionDegraded } = await import('./user-read-shared');

      const mockLogger = { warn: vi.fn() };

      logUserProjectionDegraded({
        actor: {
          instanceId: 'test-instance',
          requestId: 'req-1',
          traceId: 'trace-1',
        },
        userId: 'user-1',
        keycloakRoleNamesResult: {
          status: 'rejected',
          reason: new Error('KC error'),
        },
        mainserverCredentialStateResult: {
          status: 'fulfilled',
          value: { mainserverUserApplicationId: 'app-1', mainserverUserApplicationSecretSet: true },
        },
        logger: mockLogger,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('external data could not be loaded'),
        expect.objectContaining({
          operation: 'get_user',
          user_id: 'user-1',
        })
      );
    });

    it('logs warning when mainserver credentials fail', async () => {
      const { logUserProjectionDegraded } = await import('./user-read-shared');

      const mockLogger = { warn: vi.fn() };

      logUserProjectionDegraded({
        actor: {
          instanceId: 'test-instance',
          requestId: 'req-1',
          traceId: 'trace-1',
        },
        userId: 'user-1',
        keycloakRoleNamesResult: {
          status: 'fulfilled',
          value: ['admin', 'user'],
        },
        mainserverCredentialStateResult: {
          status: 'rejected',
          reason: new Error('Mainserver error'),
        },
        logger: mockLogger,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('external data could not be loaded'),
        expect.objectContaining({
          operation: 'get_user',
          user_id: 'user-1',
        })
      );
    });

    it('does not log when both fulfil', async () => {
      const { logUserProjectionDegraded } = await import('./user-read-shared');

      const mockLogger = { warn: vi.fn() };

      logUserProjectionDegraded({
        actor: {
          instanceId: 'test-instance',
          requestId: 'req-1',
          traceId: 'trace-1',
        },
        userId: 'user-1',
        keycloakRoleNamesResult: {
          status: 'fulfilled',
          value: ['admin', 'user'],
        },
        mainserverCredentialStateResult: {
          status: 'fulfilled',
          value: { mainserverUserApplicationId: 'app-1', mainserverUserApplicationSecretSet: true },
        },
        logger: mockLogger,
      });

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
