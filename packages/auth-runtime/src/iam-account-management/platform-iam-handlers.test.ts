import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createSdkLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-platform', traceId: 'trace-platform' })),
  jsonResponse: vi.fn((status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  ),
  readString: vi.fn((value: unknown) => (typeof value === 'string' ? value : undefined)),
  asApiItem: vi.fn((data: unknown, requestId?: string) => ({ data, ...(requestId ? { requestId } : {}) })),
  asApiList: vi.fn((data: unknown, pagination: unknown, requestId?: string) => ({
    data,
    pagination,
    ...(requestId ? { requestId } : {}),
  })),
  createApiError: vi.fn((status: number, code: string, message: string, requestId?: string, details?: unknown) =>
    new Response(JSON.stringify({ error: { code, message, ...(details ? { details } : {}) }, requestId }), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  ),
  readPage: vi.fn(() => ({ page: 1, pageSize: 20 })),
  validateCsrf: vi.fn(() => null),
  ensureFeature: vi.fn(() => null),
  getFeatureFlags: vi.fn(() => ({})),
  listPlatformRoles: vi.fn(async () => [{ roleId: 'platform:instance_registry_admin' }]),
  listPlatformUsers: vi.fn(async () => ({ total: 1, users: [{ id: 'user-1' }] })),
  runPlatformRoleReconcile: vi.fn(async () => ({ syncState: 'ready' })),
  consumeRateLimit: vi.fn(() => null),
  mapRoleSyncErrorCode: vi.fn(() => 'unknown'),
  sanitizeRoleErrorMessage: vi.fn(() => 'sanitized'),
  logger: {
    error: vi.fn(),
  },
  requireRoles: vi.fn(() => null),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: state.createSdkLogger,
  getWorkspaceContext: state.getWorkspaceContext,
}));

vi.mock('../db.js', () => ({
  jsonResponse: state.jsonResponse,
}));

vi.mock('../shared/input-readers.js', () => ({
  readString: state.readString,
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: state.asApiItem,
  asApiList: state.asApiList,
  createApiError: state.createApiError,
  readPage: state.readPage,
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: state.validateCsrf,
}));

vi.mock('./feature-flags.js', () => ({
  ensureFeature: state.ensureFeature,
  getFeatureFlags: state.getFeatureFlags,
}));

vi.mock('./platform-iam.js', () => ({
  listPlatformRoles: state.listPlatformRoles,
  listPlatformUsers: state.listPlatformUsers,
  runPlatformRoleReconcile: state.runPlatformRoleReconcile,
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: state.consumeRateLimit,
}));

vi.mock('./role-audit.js', () => ({
  mapRoleSyncErrorCode: state.mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage: state.sanitizeRoleErrorMessage,
}));

vi.mock('./shared.js', () => ({
  logger: state.logger,
  requireRoles: state.requireRoles,
}));

describe('platform-iam-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getWorkspaceContext.mockReturnValue({ requestId: 'req-platform', traceId: 'trace-platform' });
    state.readPage.mockReturnValue({ page: 1, pageSize: 20 });
    state.readString.mockImplementation((value: unknown) => (typeof value === 'string' ? value : undefined));
    state.ensureFeature.mockReturnValue(null);
    state.requireRoles.mockReturnValue(null);
    state.consumeRateLimit.mockReturnValue(null);
    state.validateCsrf.mockReturnValue(null);
    state.listPlatformUsers.mockResolvedValue({ total: 1, users: [{ id: 'user-1' }] });
    state.listPlatformRoles.mockResolvedValue([{ roleId: 'platform:instance_registry_admin' }]);
    state.runPlatformRoleReconcile.mockResolvedValue({ syncState: 'ready' });
  });

  it('guards all platform endpoints with the root admin role set', async () => {
    const {
      listPlatformRolesInternal,
      listPlatformUsersInternal,
      reconcilePlatformRolesInternal,
    } = await import('./platform-iam-handlers.js');
    const ctx = { user: { id: 'kc-root', roles: ['instance_registry_admin'] } } as never;

    await listPlatformUsersInternal(new Request('http://localhost/api/v1/platform/users?search=demo'), ctx);
    await listPlatformRolesInternal(ctx, 'req-platform', 'trace-platform');
    await reconcilePlatformRolesInternal(
      new Request('http://localhost/api/v1/platform/roles/reconcile', { method: 'POST' }),
      ctx,
      'req-platform',
      'trace-platform'
    );

    expect(state.requireRoles).toHaveBeenNthCalledWith(1, ctx, new Set(['instance_registry_admin']), 'req-platform');
    expect(state.requireRoles).toHaveBeenNthCalledWith(2, ctx, new Set(['instance_registry_admin']), 'req-platform');
    expect(state.requireRoles).toHaveBeenNthCalledWith(3, ctx, new Set(['instance_registry_admin']), 'req-platform');
  });

  it('fails closed before executing platform reads or writes when root role check fails', async () => {
    const forbidden = new Response('forbidden', { status: 403 });
    state.requireRoles.mockReturnValue(forbidden);

    const {
      listPlatformRolesInternal,
      listPlatformUsersInternal,
      reconcilePlatformRolesInternal,
    } = await import('./platform-iam-handlers.js');
    const ctx = { user: { id: 'kc-tenant', roles: ['system_admin'] } } as never;

    await expect(
      listPlatformUsersInternal(new Request('http://localhost/api/v1/platform/users'), ctx)
    ).resolves.toBe(forbidden);
    await expect(listPlatformRolesInternal(ctx, 'req-platform', 'trace-platform')).resolves.toBe(forbidden);
    await expect(
      reconcilePlatformRolesInternal(
        new Request('http://localhost/api/v1/platform/roles/reconcile', { method: 'POST' }),
        ctx,
        'req-platform',
        'trace-platform'
      )
    ).resolves.toBe(forbidden);

    expect(state.listPlatformUsers).not.toHaveBeenCalled();
    expect(state.listPlatformRoles).not.toHaveBeenCalled();
    expect(state.runPlatformRoleReconcile).not.toHaveBeenCalled();
  });
});
