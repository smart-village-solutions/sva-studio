import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  reserve: { status: 'reserved' as 'reserved' | 'replay' | 'conflict' } as
    | { status: 'reserved' }
    | { status: 'replay'; responseStatus: number; responseBody: unknown }
    | { status: 'conflict'; message: string },
  actorResolution: {
    actor: {
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      requestId: 'req-roles',
      traceId: 'trace-roles',
    },
  } as
    | { actor: { instanceId: string; actorAccountId?: string; requestId?: string; traceId?: string } }
    | { error: Response },
  identityProvider: null as null | { provider: Record<string, unknown> },
  parseResult: {
    ok: true as const,
    data: { roleName: 'editor', displayName: 'Editor', description: 'desc', roleLevel: 10, permissionIds: [] },
    rawBody: '{}',
  },
  completeIdempotency: vi.fn(),
}));

vi.mock('@sva/sdk/server', () => ({
  getWorkspaceContext: () => ({ requestId: 'req-roles' }),
}));

vi.mock('../shared/db-helpers.js', () => ({
  jsonResponse: (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: (data: unknown, requestId?: string) => ({ data, ...(requestId ? { requestId } : {}) }),
  asApiList: vi.fn(),
  createApiError: (
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: Record<string, unknown>
  ) =>
    new Response(
      JSON.stringify({ error: { code, message, ...(details ? { details } : {}) }, ...(requestId ? { requestId } : {}) }),
      { status, headers: { 'content-type': 'application/json' } }
    ),
  parseRequestBody: vi.fn(async () => state.parseResult),
  readPathSegment: vi.fn(
    (request: Request, index: number) =>
      new URL(request.url).pathname.split('/').filter((segment) => segment.length > 0)[index]
  ),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-1' })),
  toPayloadHash: vi.fn(() => 'hash-1'),
}));

vi.mock('./diagnostics.js', () => ({
  classifyIamDiagnosticError: vi.fn(),
  createActorResolutionDetails: vi.fn(({ actorResolution, instanceId }) => ({
    actor_resolution: actorResolution,
    instance_id: instanceId,
    reason_code: actorResolution,
  })),
}));

vi.mock('./feature-flags.js', () => ({
  getFeatureFlags: vi.fn(() => ({})),
  ensureFeature: vi.fn(() => null),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: vi.fn(() => null),
}));

vi.mock('./shared.js', () => ({
  completeIdempotency: state.completeIdempotency,
  emitActivityLog: vi.fn(),
  emitRoleAuditEvent: vi.fn(),
  iamRoleSyncCounter: { add: vi.fn() },
  iamUserOperationsCounter: { add: vi.fn() },
  logger: { error: vi.fn() },
  notifyPermissionInvalidation: vi.fn(),
  requireRoles: vi.fn(() => null),
  reserveIdempotency: vi.fn(async () => state.reserve),
  resolveActorInfo: vi.fn(async () => state.actorResolution),
  resolveIdentityProvider: vi.fn(() => state.identityProvider),
  setRoleSyncState: vi.fn(),
  trackKeycloakCall: vi.fn(async (_operation: string, fn: () => Promise<unknown>) => fn()),
  withInstanceScopedDb: vi.fn(async () => undefined),
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('../keycloak-admin-client.js', () => ({
  KeycloakAdminRequestError: class KeycloakAdminRequestError extends Error {},
}));

import { createRoleInternal, updateRoleInternal } from './roles-handlers';

const ctx = {
  user: {
    id: 'kc-1',
    roles: ['system_admin'],
  },
} as never;

describe('iam-account-management/roles-handlers internals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.reserve = { status: 'reserved' };
    state.actorResolution = {
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-roles',
        traceId: 'trace-roles',
      },
    };
    state.identityProvider = null;
    state.parseResult = {
      ok: true,
      data: { roleName: 'editor', displayName: 'Editor', description: 'desc', roleLevel: 10, permissionIds: [] },
      rawBody: '{}',
    };
  });

  it('returns forbidden when the actor account is missing during role creation', async () => {
    state.actorResolution = {
      actor: {
        instanceId: 'de-musterhausen',
        requestId: 'req-roles',
      },
    };

    const response = await createRoleInternal(new Request('http://localhost/api/v1/iam/roles', { method: 'POST' }), ctx);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'forbidden',
        message: 'Akteur-Account nicht gefunden.',
        details: {
          actor_resolution: 'missing_actor_account',
          instance_id: 'de-musterhausen',
          reason_code: 'missing_actor_account',
        },
      },
      requestId: 'req-roles',
    });
  });

  it('returns idempotent replay and conflict responses for role creation', async () => {
    state.reserve = {
      status: 'replay',
      responseStatus: 202,
      responseBody: { data: { id: 'role-1' } },
    };

    const replay = await createRoleInternal(new Request('http://localhost/api/v1/iam/roles', { method: 'POST' }), ctx);
    expect(replay.status).toBe(202);
    await expect(replay.json()).resolves.toEqual({ data: { id: 'role-1' } });

    state.reserve = {
      status: 'conflict',
      message: 'payload mismatch',
    };

    const conflict = await createRoleInternal(new Request('http://localhost/api/v1/iam/roles', { method: 'POST' }), ctx);
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({
      error: {
        code: 'idempotency_key_reuse',
        message: 'payload mismatch',
      },
      requestId: 'req-roles',
    });
  });

  it('persists a failed idempotent response when the identity provider is unavailable', async () => {
    const response = await createRoleInternal(new Request('http://localhost/api/v1/iam/roles', { method: 'POST' }), ctx);

    expect(response.status).toBe(503);
    expect(state.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'POST:/api/v1/iam/roles',
        status: 'FAILED',
        responseStatus: 503,
      })
    );
  });

  it('rejects invalid role ids and missing identity provider during updates', async () => {
    const invalidResponse = await updateRoleInternal(
      new Request('http://localhost/api/v1/iam/roles/not-a-uuid', { method: 'PATCH' }),
      ctx
    );
    expect(invalidResponse.status).toBe(400);

    const validUrlResponse = await updateRoleInternal(
      new Request('http://localhost/api/v1/iam/roles/11111111-1111-1111-8111-111111111111', { method: 'PATCH' }),
      ctx
    );
    expect(validUrlResponse.status).toBe(503);
    await expect(validUrlResponse.json()).resolves.toEqual({
      error: {
        code: 'keycloak_unavailable',
        message: 'Keycloak Admin API ist nicht konfiguriert.',
        details: {
          syncState: 'failed',
          syncError: { code: 'IDP_UNAVAILABLE' },
        },
      },
      requestId: 'req-roles',
    });
  });
});
