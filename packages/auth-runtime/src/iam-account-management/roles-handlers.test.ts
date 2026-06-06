import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeInstancePermissionForUser: vi.fn(async () => ({ ok: true as const })),
  query: vi.fn(),
  resolveActorInfo: vi.fn(async () => ({
    actor: {
      instanceId: 'de-musterhausen',
      requestId: 'req-roles',
    },
  })),
}));

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();
  return {
    ...actual,
    getWorkspaceContext: () => ({ requestId: 'req-workspace', traceId: 'trace-workspace' }),
  };
});

vi.mock('../db.js', () => ({
  jsonResponse: (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
}));

vi.mock('../instance-permission-authorization.js', () => ({
  authorizeInstancePermissionForUser: (...args: Parameters<typeof mocks.authorizeInstancePermissionForUser>) =>
    mocks.authorizeInstancePermissionForUser(...args),
  toInstancePermissionApiErrorCode: () => 'forbidden',
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: (data: unknown, requestId?: string) => ({
    data,
    ...(requestId ? { requestId } : {}),
  }),
  asApiList: (
    data: readonly unknown[],
    pagination: { page: number; pageSize: number; total: number },
    requestId?: string
  ) => ({
    data,
    pagination,
    ...(requestId ? { requestId } : {}),
  }),
  createApiError: (status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ error: { code, message }, ...(requestId ? { requestId } : {}) }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  parseRequestBody: vi.fn(),
  readInstanceIdFromRequest: vi.fn(),
  readPage: vi.fn(() => ({ page: 1, pageSize: 20 })),
  readPathSegment: vi.fn(),
  requireIdempotencyKey: vi.fn(),
  toPayloadHash: vi.fn(),
}));

vi.mock('./diagnostics.js', () => ({
  classifyIamDiagnosticError: () => ({
    status: 503,
    code: 'database_unavailable',
    message: 'IAM-Datenbank ist nicht erreichbar.',
  }),
}));

vi.mock('./feature-flags.js', () => ({
  ensureFeature: () => null,
  getFeatureFlags: () => ({}),
}));

vi.mock('./platform-iam-handlers.js', () => ({
  listPlatformRolesInternal: vi.fn(),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: () => null,
}));

vi.mock('./role-query.js', () => ({
  loadRoleListItems: vi.fn(),
}));

vi.mock('./shared-actor-resolution.js', () => ({
  requireRoles: () => null,
  resolveActorInfo: (...args: Parameters<typeof mocks.resolveActorInfo>) => mocks.resolveActorInfo(...args),
}));

vi.mock('./shared-runtime.js', () => ({
  withInstanceScopedDb: async (_instanceId: string, callback: (client: { query: typeof mocks.query }) => Promise<unknown>) =>
    callback({ query: mocks.query }),
}));

describe('roles-handlers listPermissionsInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockResolvedValue({
      rows: [
        {
          id: 'perm-app-read',
          instance_id: 'de-musterhausen',
          permission_key: 'app.read',
          description: null,
        },
        {
          id: 'perm-content-read',
          instance_id: 'de-musterhausen',
          permission_key: 'content.read',
          description: null,
        },
        {
          id: 'perm-root',
          instance_id: 'de-musterhausen',
          permission_key: 'instance.registry.manage',
          description: null,
        },
      ],
    });
  });

  it('returns runtimeScope metadata and filters root-only permissions from tenant permission lists', async () => {
    const { listPermissionsInternal } = await import('./roles-handlers.js');

    const response = await listPermissionsInternal(new Request('http://localhost/api/v1/iam/permissions'), {
      sessionId: 'session-1',
      user: {
        id: 'kc-actor-1',
        instanceId: 'de-musterhausen',
        roles: ['system_admin'],
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: 'perm-app-read',
          instanceId: 'de-musterhausen',
          permissionKey: 'app.read',
          description: 'App-Link in der Sidebar anzeigen',
          runtimeScope: 'instance',
        },
        {
          id: 'perm-content-read',
          instanceId: 'de-musterhausen',
          permissionKey: 'content.read',
          runtimeScope: 'record',
          isScopeAssignable: true,
          supportedAccessScopes: ['all', 'own', 'organization'],
        },
      ],
      pagination: { page: 1, pageSize: 2, total: 2 },
      requestId: 'req-roles',
    });
    expect(mocks.authorizeInstancePermissionForUser).toHaveBeenCalledWith({
      ctx: expect.objectContaining({
        user: expect.objectContaining({ id: 'kc-actor-1', instanceId: 'de-musterhausen' }),
      }),
      action: 'iam.role.read',
    });
  });
});
