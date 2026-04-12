import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  actorResolution: {
    actor: {
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      requestId: 'req-users',
      traceId: 'trace-users',
    },
  } as
    | { actor: { instanceId: string; actorAccountId?: string; requestId?: string; traceId?: string } }
    | { error: Response },
  identityProvider: null as null | { provider: Record<string, unknown> },
  reserve: { status: 'reserved' as const },
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-users' }),
}));

vi.mock('../shared/db-helpers.js', () => ({
  createPoolResolver: vi.fn(() => () => null),
  jsonResponse: (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  withInstanceDb: vi.fn(),
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: (data: unknown, requestId?: string) => ({ data, ...(requestId ? { requestId } : {}) }),
  createApiError: (status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ error: { code, message }, ...(requestId ? { requestId } : {}) }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  parseRequestBody: vi.fn(async () => ({ ok: true, data: {}, rawBody: '{}' })),
  readInstanceIdFromRequest: vi.fn(() => undefined),
  readPathSegment: vi.fn(
    (request: Request, index: number) =>
      new URL(request.url).pathname.split('/').filter((segment) => segment.length > 0)[index]
  ),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-1' })),
  toPayloadHash: vi.fn(() => 'hash-1'),
}));

vi.mock('./feature-flags.js', () => ({
  getFeatureFlags: vi.fn(() => ({})),
  ensureFeature: vi.fn(() => null),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: vi.fn(() => null),
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('./shared.js', () => ({
  assignGroups: vi.fn(),
  assignRoles: vi.fn(),
  completeIdempotency: vi.fn(),
  emitActivityLog: vi.fn(),
  ensureActorCanManageTarget: vi.fn(),
  ensureRoleAssignmentWithinActorLevel: vi.fn(),
  iamUserOperationsCounter: { add: vi.fn() },
  isSystemAdminAccount: vi.fn(),
  logger: { error: vi.fn() },
  notifyPermissionInvalidation: vi.fn(),
  requireRoles: vi.fn(() => null),
  reserveIdempotency: vi.fn(async () => state.reserve),
  resolveActorAccountId: vi.fn(),
  resolveActorInfo: vi.fn(async () => state.actorResolution),
  resolveActorMaxRoleLevel: vi.fn(),
  resolveIdentityProvider: vi.fn(() => state.identityProvider),
  resolveIdentityProviderForInstance: vi.fn(async () => state.identityProvider),
  resolveGroupsByIds: vi.fn(),
  resolveRoleIdsForGroups: vi.fn(),
  resolveRolesByIds: vi.fn(),
  resolveSystemAdminCount: vi.fn(),
  trackKeycloakCall: vi.fn(async (_operation: string, fn: () => Promise<unknown>) => fn()),
  withInstanceScopedDb: vi.fn(async () => undefined),
}));

vi.mock('./shared-actor-resolution.js', () => ({
  requireRoles: vi.fn(() => null),
  resolveActorInfo: vi.fn(async () => state.actorResolution),
}));

vi.mock('./shared-runtime.js', () => ({
  resolveIdentityProvider: vi.fn(() => state.identityProvider),
  resolveIdentityProviderForInstance: vi.fn(async () => state.identityProvider),
  withInstanceScopedDb: vi.fn(async () => undefined),
}));

vi.mock('./shared-idempotency.js', () => ({
  completeIdempotency: vi.fn(),
  reserveIdempotency: vi.fn(async () => state.reserve),
}));

vi.mock('./shared-observability.js', () => ({
  iamUserOperationsCounter: { add: vi.fn() },
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  trackKeycloakCall: vi.fn(async (_operation: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('./shared-activity.js', () => ({
  emitActivityLog: vi.fn(),
  notifyPermissionInvalidation: vi.fn(),
}));

vi.mock('./shared-actor-authorization.js', () => ({
  ensureActorCanManageTarget: vi.fn(() => ({ ok: true })),
  isSystemAdminAccount: vi.fn(async () => false),
  resolveActorMaxRoleLevel: vi.fn(async () => 100),
  resolveSystemAdminCount: vi.fn(async () => 2),
}));

vi.mock('./schemas.js', () => ({
  bulkDeactivateSchema: {},
  updateUserSchema: {},
}));

vi.mock('./user-bulk-query.js', () => ({
  resolveUsersForBulkDeactivation: vi.fn(),
}));

vi.mock('./user-detail-query.js', () => ({
  resolveUserDetail: vi.fn(),
}));

vi.mock('../keycloak-admin-client.js', () => ({
  KeycloakAdminRequestError: class KeycloakAdminRequestError extends Error {},
  KeycloakAdminUnavailableError: class KeycloakAdminUnavailableError extends Error {},
}));

import { bulkDeactivateInternal, deactivateUserInternal, updateUserInternal } from './users-handlers';

const ctx = {
  user: {
    id: 'kc-1',
    roles: ['system_admin'],
  },
} as never;

describe('iam-account-management/users-handlers internals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actorResolution = {
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-users',
        traceId: 'trace-users',
      },
    };
    state.identityProvider = null;
    state.reserve = { status: 'reserved' };
  });

  it('rejects invalid user ids for update and deactivate', async () => {
    const updateResponse = await updateUserInternal(
      new Request('http://localhost/api/v1/iam/users/not-a-uuid', { method: 'PATCH' }),
      ctx
    );
    const deactivateResponse = await deactivateUserInternal(
      new Request('http://localhost/api/v1/iam/users/not-a-uuid', { method: 'DELETE' }),
      ctx
    );

    expect(updateResponse.status).toBe(400);
    expect(deactivateResponse.status).toBe(400);
  });

  it('returns route-specific errors without identity provider for update and deactivate', async () => {
    const updateResponse = await updateUserInternal(
      new Request('http://localhost/api/v1/iam/users/11111111-1111-1111-8111-111111111111', { method: 'PATCH' }),
      ctx
    );
    const deactivateResponse = await deactivateUserInternal(
      new Request('http://localhost/api/v1/iam/users/11111111-1111-1111-8111-111111111111', { method: 'DELETE' }),
      ctx
    );

    expect(updateResponse.status).toBe(409);
    expect(deactivateResponse.status).toBe(409);
  });

  it('maps idempotency replay and missing identity provider for bulk deactivation', async () => {
    state.reserve = {
      status: 'replay',
      responseStatus: 202,
      responseBody: { data: { count: 1 } },
    } as never;

    const replay = await bulkDeactivateInternal(
      new Request('http://localhost/api/v1/iam/users/bulk-deactivate', { method: 'POST' }),
      ctx
    );
    expect(replay.status).toBe(202);

    state.reserve = { status: 'reserved' };
    const missingIdp = await bulkDeactivateInternal(
      new Request('http://localhost/api/v1/iam/users/bulk-deactivate', { method: 'POST' }),
      ctx
    );
    expect(missingIdp.status).toBe(409);
  });
});
