import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  featureResponse: null as Response | null,
  roleResponse: null as Response | null,
  csrfResponse: null as Response | null,
  rateLimitResponse: null as Response | null,
  platformUsersResult: {
    users: [{ id: 'platform:user-1', username: 'alice' }],
    total: 1,
  },
  platformRolesResult: [{ id: 'platform:system_admin', roleName: 'system_admin' }],
  platformReconcileResult: {
    outcome: 'success',
    checkedCount: 1,
    correctedCount: 0,
    failedCount: 0,
    requiresManualActionCount: 0,
    roles: [],
  },
  platformUserError: null as Error | null,
  platformRoleError: null as Error | null,
  platformReconcileError: null as Error | null,
}));

vi.mock('@sva/sdk/server', () => ({
  getWorkspaceContext: () => ({ requestId: 'req-platform', traceId: 'trace-platform' }),
}));

vi.mock('../shared/db-helpers.js', () => ({
  jsonResponse: (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
}));

vi.mock('../shared/input-readers.js', () => ({
  readString: (value: string | null) => value ?? undefined,
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: (data: unknown, requestId?: string) => ({ data, requestId }),
  asApiList: (items: unknown[], meta: unknown, requestId?: string) => ({ items, meta, requestId }),
  createApiError: (
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) =>
    new Response(JSON.stringify({ error: { code, message, details }, requestId }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  readPage: () => ({ page: 1, pageSize: 10 }),
}));

vi.mock('./feature-flags.js', () => ({
  ensureFeature: vi.fn(() => state.featureResponse),
  getFeatureFlags: vi.fn(() => ({})),
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: vi.fn(() => state.csrfResponse),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: vi.fn(() => state.rateLimitResponse),
}));

vi.mock('./role-audit.js', () => ({
  mapRoleSyncErrorCode: vi.fn(() => 'IDP_FORBIDDEN'),
  sanitizeRoleErrorMessage: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
}));

vi.mock('./shared.js', () => ({
  logger: { error: vi.fn() },
  requireRoles: vi.fn(() => state.roleResponse),
}));

vi.mock('./types.js', () => ({
  USER_STATUS: ['active', 'inactive', 'pending'],
}));

vi.mock('./platform-iam.js', () => ({
  listPlatformUsers: vi.fn(async () => {
    if (state.platformUserError) {
      throw state.platformUserError;
    }
    return state.platformUsersResult;
  }),
  listPlatformRoles: vi.fn(async () => {
    if (state.platformRoleError) {
      throw state.platformRoleError;
    }
    return state.platformRolesResult;
  }),
  runPlatformRoleReconcile: vi.fn(async () => {
    if (state.platformReconcileError) {
      throw state.platformReconcileError;
    }
    return state.platformReconcileResult;
  }),
}));

import {
  listPlatformRolesInternal,
  listPlatformUsersInternal,
  reconcilePlatformRolesInternal,
} from './platform-iam-handlers.js';

const ctx = { user: { id: 'kc-platform', roles: ['system_admin'] } } as never;

describe('platform IAM handlers', () => {
  beforeEach(() => {
    state.featureResponse = null;
    state.roleResponse = null;
    state.csrfResponse = null;
    state.rateLimitResponse = null;
    state.platformUserError = null;
    state.platformRoleError = null;
    state.platformReconcileError = null;
  });

  it('lists platform users with filters', async () => {
    const response = await listPlatformUsersInternal(
      new Request('https://studio.smart-village.app/api/v1/iam/users?status=active&role=system_admin&search=alice'),
      ctx
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [{ id: 'platform:user-1', username: 'alice' }],
      meta: { page: 1, pageSize: 10, total: 1 },
      requestId: 'req-platform',
    });
  });

  it('rejects invalid platform user filters and propagates platform dependency failures', async () => {
    const invalidResponse = await listPlatformUsersInternal(
      new Request('https://studio.smart-village.app/api/v1/iam/users?status=archived'),
      ctx
    );
    expect(invalidResponse.status).toBe(400);

    state.platformUserError = new Error('keycloak down');
    const failureResponse = await listPlatformUsersInternal(
      new Request('https://studio.smart-village.app/api/v1/iam/users'),
      ctx
    );
    expect(failureResponse.status).toBe(503);
    await expect(failureResponse.json()).resolves.toMatchObject({
      error: {
        code: 'keycloak_unavailable',
        details: { reason_code: 'platform_keycloak_unavailable', scope_kind: 'platform' },
      },
    });
  });

  it('lists and reconciles platform roles', async () => {
    const rolesResponse = await listPlatformRolesInternal(ctx, 'req-platform');
    expect(rolesResponse.status).toBe(200);

    const reconcileResponse = await reconcilePlatformRolesInternal(
      new Request('https://studio.smart-village.app/api/v1/iam/admin/reconcile', { method: 'POST' }),
      ctx,
      'req-platform',
      'trace-platform'
    );
    expect(reconcileResponse.status).toBe(200);
  });

  it('maps platform role failures and guard responses', async () => {
    state.rateLimitResponse = new Response(JSON.stringify({ error: { code: 'rate_limited' } }), { status: 429 });
    const limitedResponse = await listPlatformRolesInternal(ctx, 'req-platform');
    expect(limitedResponse.status).toBe(429);

    state.rateLimitResponse = null;
    state.platformRoleError = new Error('keycloak denied');
    const rolesFailure = await listPlatformRolesInternal(ctx, 'req-platform');
    expect(rolesFailure.status).toBe(503);

    state.platformReconcileError = new Error('forbidden');
    const reconcileFailure = await reconcilePlatformRolesInternal(
      new Request('https://studio.smart-village.app/api/v1/iam/admin/reconcile', { method: 'POST' }),
      ctx,
      'req-platform'
    );
    expect(reconcileFailure.status).toBe(503);
    await expect(reconcileFailure.json()).resolves.toMatchObject({
      error: {
        code: 'keycloak_unavailable',
        details: {
          syncState: 'failed',
          syncError: { code: 'IDP_FORBIDDEN' },
          scope_kind: 'platform',
        },
      },
    });
  });
});
