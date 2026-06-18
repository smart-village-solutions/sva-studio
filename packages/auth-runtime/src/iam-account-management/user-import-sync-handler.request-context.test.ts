import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiErrorResponse } from './test-api-response.js';

const state = vi.hoisted(() => ({
  resolveMutationActorWithAccount: vi.fn(),
  createSyncUsersFromKeycloakHandlerInternal: vi.fn(),
}));

vi.mock('@sva/iam-admin', () => ({
  createSyncUsersFromKeycloakHandlerInternal: state.createSyncUsersFromKeycloakHandlerInternal,
  createUserImportPersistence: vi.fn(() => ({
    loadLocalProfileSeed: vi.fn(),
    upsertIdentityUser: vi.fn(),
  })),
  IamSchemaDriftError: class IamSchemaDriftError extends Error {
    expectedMigration = 'test-migration';
    schemaObject = 'test-schema-object';
  },
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-workspace', traceId: 'trace-workspace' })),
}));

vi.mock('../db.js', () => ({
  createPoolResolver: vi.fn(),
  jsonResponse: vi.fn((status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  ),
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: vi.fn(() => ({ instance_id: 'instance-1', trace_id: 'trace-1' })),
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: vi.fn((data: unknown, requestId?: string) => ({ data, ...(requestId ? { requestId } : {}) })),
  createApiError: vi.fn(createApiErrorResponse),
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('./feature-flags.js', () => ({
  ensureFeature: vi.fn(() => null),
  getFeatureFlags: vi.fn(() => ({ iam_admin: true })),
}));

vi.mock('./platform-iam-sync.js', () => ({
  runPlatformKeycloakUserSync: vi.fn(),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: vi.fn(() => null),
}));

vi.mock('./shared.js', () => ({
  emitActivityLog: vi.fn(),
  iamUserOperationsCounter: { add: vi.fn() },
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  requireRoles: vi.fn(),
  resolveIdentityProviderForInstance: vi.fn(),
  trackKeycloakCall: vi.fn(),
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('./mutation-request-context.shared.js', () => ({
  resolveMutationActorWithAccount: state.resolveMutationActorWithAccount,
}));

describe('user-import-sync-handler request context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveMutationActorWithAccount.mockResolvedValue({
      actor: {
        instanceId: 'instance-1',
        actorAccountId: 'actor-1',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    });
    state.createSyncUsersFromKeycloakHandlerInternal.mockImplementation((deps) => async (request, ctx) => {
      const actorResolution = await deps.resolveSyncActor(request, ctx);
      if ('error' in actorResolution) {
        return actorResolution.error;
      }

      return deps.jsonResponse(200, deps.asApiItem({ actor: actorResolution.actor }, actorResolution.actor.requestId));
    });
  });

  it('allows custom permission grants without legacy tenant admin roles', async () => {
    const { syncUsersFromKeycloakInternal } = await import('./user-import-sync-handler.js');
    const request = new Request('http://localhost/api/v1/iam/users/sync-keycloak', { method: 'POST' });
    const ctx = {
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['custom_role'],
      },
    } as never;

    const response = await syncUsersFromKeycloakInternal(request, ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        actor: {
          instanceId: 'instance-1',
          actorAccountId: 'actor-1',
          requestId: 'req-1',
          traceId: 'trace-1',
        },
      },
      requestId: 'req-1',
    });
    expect(state.resolveMutationActorWithAccount).toHaveBeenCalledWith(request, ctx, {
      allowedRoles: new Set(['system_admin']),
      requiredPermissionAction: 'iam.user.write',
      feature: 'iam_admin',
      scope: 'write',
      provisionMissingActorMembership: true,
    });
  }, 15_000);

  it('returns shared guard responses unchanged', async () => {
    const { syncUsersFromKeycloakInternal } = await import('./user-import-sync-handler.js');
    const request = new Request('http://localhost/api/v1/iam/users/sync-keycloak', { method: 'POST' });
    const ctx = {
      user: {
        id: 'kc-user-1',
        instanceId: 'instance-1',
        roles: ['custom_role'],
      },
    } as never;
    const forbidden = new Response('forbidden', { status: 403 });
    state.resolveMutationActorWithAccount.mockResolvedValueOnce({ response: forbidden });

    await expect(syncUsersFromKeycloakInternal(request, ctx)).resolves.toBe(forbidden);
  });
});
