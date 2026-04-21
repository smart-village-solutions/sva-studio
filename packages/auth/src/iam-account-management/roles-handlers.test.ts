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
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getWorkspaceContext: () => ({ requestId: 'req-roles' }),
}));

vi.mock('../shared/db-helpers.js', () => ({
  createPoolResolver: vi.fn(() => vi.fn()),
  jsonResponse: (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  withInstanceDb: vi.fn(),
}));

vi.mock('./api-helpers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api-helpers.js')>();

  return {
    ...actual,
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
        JSON.stringify({
          error: { code, message, ...(details ? { details } : {}) },
          ...(requestId ? { requestId } : {}),
        }),
        { status, headers: { 'content-type': 'application/json' } }
      ),
    parseRequestBody: vi.fn(async () => state.parseResult),
    readInstanceIdFromRequest: vi.fn(() => 'de-musterhausen'),
    readPathSegment: vi.fn(
      (request: Request, index: number) =>
        new URL(request.url).pathname.split('/').filter((segment) => segment.length > 0)[index]
    ),
    requireIdempotencyKey: vi.fn(() => ({ key: 'idem-1' })),
    toPayloadHash: vi.fn(() => 'hash-1'),
  };
});

vi.mock('./diagnostics.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./diagnostics.js')>();

  return {
    ...actual,
    classifyIamDiagnosticError: vi.fn(),
    createActorResolutionDetails: vi.fn(({ actorResolution, instanceId }) => ({
      actor_resolution: actorResolution,
      instance_id: instanceId,
      reason_code: actorResolution,
    })),
  };
});

vi.mock('./feature-flags.js', () => ({
  getFeatureFlags: vi.fn(() => ({})),
  ensureFeature: vi.fn(() => null),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: vi.fn(() => null),
}));

vi.mock('./platform-iam-handlers.js', () => ({
  listPlatformRolesInternal: vi.fn(),
}));

vi.mock('./shared-actor-resolution.js', () => ({
  requireRoles: vi.fn(() => null),
  resolveActorInfo: vi.fn(async () => state.actorResolution),
}));

vi.mock('./shared-idempotency.js', () => ({
  completeIdempotency: state.completeIdempotency,
  reserveIdempotency: vi.fn(async () => state.reserve),
}));

vi.mock('./shared-activity.js', () => ({
  emitActivityLog: vi.fn(),
  emitRoleAuditEvent: vi.fn(),
  notifyPermissionInvalidation: vi.fn(),
  setRoleSyncState: vi.fn(),
}));

vi.mock('./shared-observability.js', () => ({
  iamRoleSyncCounter: { add: vi.fn() },
  iamUserOperationsCounter: { add: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  trackKeycloakCall: vi.fn(async (_operation: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('./shared-runtime.js', () => ({
  resolveIdentityProvider: vi.fn(() => state.identityProvider),
  resolveIdentityProviderForInstance: vi.fn(async () => state.identityProvider),
  withInstanceScopedDb: vi.fn(async () => undefined),
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('../keycloak-admin-client.js', () => ({
  KeycloakAdminRequestError: class KeycloakAdminRequestError extends Error {},
}));

import { createRoleInternal, listPermissionsInternal, listRolesInternal, updateRoleInternal } from './roles-handlers';

const ctx = {
  user: {
    id: 'kc-1',
    instanceId: 'de-musterhausen',
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

  it('persists a failed idempotent response when role creation cannot reach the admin API', async () => {
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

  it('rejects invalid role ids and returns tenant_admin_client_not_configured when no identity provider is configured', async () => {
    const invalidResponse = await updateRoleInternal(
      new Request('http://localhost/api/v1/iam/roles/not-a-uuid', { method: 'PATCH' }),
      ctx
    );
    expect(invalidResponse.status).toBe(400);

    state.actorResolution = {
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-roles',
        traceId: 'trace-roles',
      },
    };

    const { withInstanceScopedDb } = await import('./shared-runtime.js');
    vi.mocked(withInstanceScopedDb).mockImplementation(async (_instanceId, callback) =>
      callback({
        query: vi.fn(async (text: string) => {
          if (text.includes('FROM iam.roles') && text.includes('external_role_name')) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: '11111111-1111-1111-8111-111111111111',
                  role_key: 'editor',
                  role_name: 'Editor',
                  display_name: 'Editor',
                  external_role_name: 'editor',
                  description: 'desc',
                  is_system_role: false,
                  role_level: 10,
                  managed_by: 'studio',
                  sync_state: 'synced',
                  last_synced_at: null,
                  last_error_code: null,
                },
              ],
            };
          }

          if (text.includes('UPDATE iam.roles')) {
            return { rowCount: 1, rows: [] };
          }

          if (text.includes('DELETE FROM iam.role_permissions') || text.includes('INSERT INTO iam.role_permissions')) {
            return { rowCount: 1, rows: [] };
          }

          if (text.includes('FROM iam.roles r') && text.includes('permission_rows')) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: '11111111-1111-1111-8111-111111111111',
                  role_key: 'editor',
                  role_name: 'Editor',
                  display_name: 'Editor',
                  external_role_name: 'editor',
                  description: 'desc',
                  is_system_role: false,
                  role_level: 10,
                  managed_by: 'studio',
                  member_count: 0,
                  sync_state: 'synced',
                  last_synced_at: null,
                  last_error_code: null,
                  permission_rows: [],
                },
              ],
            };
          }

          return { rowCount: 0, rows: [] };
        }),
      } as never)
    );

    state.parseResult = {
      ok: true,
      data: { displayName: 'Editors' },
      rawBody: '{}',
    };

    const validUrlResponse = await updateRoleInternal(
      new Request('http://localhost/api/v1/iam/roles/11111111-1111-1111-8111-111111111111', { method: 'PATCH' }),
      ctx
    );
    expect(validUrlResponse.status).toBe(409);
    await expect(validUrlResponse.json()).resolves.toEqual({
      error: {
        code: 'tenant_admin_client_not_configured',
        message: 'Tenant-lokale Keycloak-Administration ist nicht konfiguriert.',
        details: {
          dependency: 'keycloak',
          execution_mode: 'tenant_admin',
          instance_id: 'de-musterhausen',
          reason_code: 'tenant_admin_client_not_configured',
          syncState: 'failed',
          syncError: { code: 'IDP_UNAVAILABLE' },
        },
      },
      requestId: 'req-roles',
    });
  });

  it('returns rate limited responses before listing roles', async () => {
    const { consumeRateLimit } = await import('./rate-limit.js');
    vi.mocked(consumeRateLimit).mockReturnValueOnce(
      new Response(JSON.stringify({ error: { code: 'rate_limited' } }), { status: 429 })
    );

    const response = await listRolesInternal(new Request('http://localhost/api/v1/iam/roles'), ctx);

    expect(response.status).toBe(429);
  });

  it('lists permissions and keeps page size at least one for empty result sets', async () => {
    const { withInstanceScopedDb } = await import('./shared-runtime.js');
    const { asApiList } = await import('./api-helpers.js');
    vi.mocked(withInstanceScopedDb).mockImplementation(async (_instanceId, callback) =>
      callback({
        query: vi.fn(async () => ({
          rows: [],
        })),
      } as never)
    );
    vi.mocked(asApiList).mockImplementation((data, meta, requestId) => ({ data, meta, requestId }) as never);

    const response = await listPermissionsInternal(new Request('http://localhost/api/v1/iam/permissions'), ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [],
      meta: { page: 1, pageSize: 1, total: 0 },
      requestId: 'req-roles',
    });
  });

  it('maps diagnostic database errors while listing roles', async () => {
    const dbError = new Error('db down');
    const { withInstanceScopedDb } = await import('./shared-runtime.js');
    const { classifyIamDiagnosticError } = await import('./diagnostics.js');
    vi.mocked(withInstanceScopedDb).mockRejectedValueOnce(dbError);
    vi.mocked(classifyIamDiagnosticError).mockReturnValueOnce({
      status: 503,
      code: 'database_unavailable',
      message: 'IAM-Datenbank ist nicht erreichbar.',
      details: { retryable: true },
    } as never);

    const response = await listRolesInternal(new Request('http://localhost/api/v1/iam/roles'), ctx);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'database_unavailable',
        message: 'IAM-Datenbank ist nicht erreichbar.',
        details: { retryable: true },
      },
      requestId: 'req-roles',
    });
  });
});
