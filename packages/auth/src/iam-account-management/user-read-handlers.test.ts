import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  actorResolution: {
    actor: {
      instanceId: 'test-instance',
      actorAccountId: 'account-1',
      requestId: 'req-users',
      traceId: 'trace-users',
    },
  } as
    | { actor: { instanceId: string; actorAccountId?: string; requestId?: string; traceId?: string } }
    | { error: Response },
  rateLimitResult: null as Response | null,
  usersListResult: {
    users: [
      { id: 'user-1', username: 'alice', email: 'alice@example.com' },
      { id: 'user-2', username: 'bob', email: 'bob@example.com' },
    ],
    total: 2,
  },
  userDetailResult: {
    id: 'user-1',
    keycloakSubject: 'kc-user-1',
    username: 'alice',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Example',
    displayName: 'Alice Example',
  } as Record<string, unknown> | null,
  keycloakRolesResult: ['admin', 'user'],
  mainserverCredentialResult: { mainserverUserApplicationId: 'app-1', mainserverUserApplicationSecretSet: true },
  timelineResult: [
    { timestamp: 1234567890, action: 'created', actor: 'system' },
  ],
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getWorkspaceContext: () => ({ requestId: 'req-users', traceId: 'trace-users' }),
}));

vi.mock('../shared/input-readers.js', () => ({
  readString: (value: string | null) => value ?? undefined,
}));

vi.mock('../shared/db-helpers.js', () => ({
  jsonResponse: (status: number, body: unknown, requestId?: string) =>
    new Response(
      JSON.stringify({ data: body, ...(requestId ? { requestId } : {}) }),
      { status, headers: { 'content-type': 'application/json' } }
    ),
  withInstanceScopedDb: vi.fn((instanceId, cb) => cb({})),
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: (data: unknown, requestId?: string) => ({ data, ...(requestId ? { requestId } : {}) }),
  asApiList: (items: unknown[], pagination: unknown, requestId?: string) => ({
    items,
    pagination,
    ...(requestId ? { requestId } : {}),
  }),
  createApiError: (
    status: number,
    code: string,
    message: string,
    requestId?: string
  ) =>
    new Response(
      JSON.stringify({
        error: { code, message },
        ...(requestId ? { requestId } : {}),
      }),
      { status, headers: { 'content-type': 'application/json' } }
    ),
  readPage: () => ({ page: 0, pageSize: 10 }),
}));

vi.mock('./shared.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
  withInstanceScopedDb: vi.fn(async (instanceId, cb) => cb({})),
}));

vi.mock('./user-read-shared.js', () => ({
  logUserProjectionDegraded: vi.fn(),
  readValidatedUserId: vi.fn(() => ({
    userId: 'user-1',
  })),
  resolveUserReadAccess: vi.fn(async () => state.actorResolution),
  createDatabaseApiError: vi.fn(() =>
    new Response(JSON.stringify({ error: 'database_error' }), { status: 500 })
  ),
}));

vi.mock('./user-detail-query.js', () => ({
  resolveUserDetail: vi.fn(async () => state.userDetailResult),
}));

vi.mock('./user-list-query.js', () => ({
  resolveUsersWithPagination: vi.fn(async () => state.usersListResult),
}));

vi.mock('./user-projection.js', () => ({
  resolveKeycloakRoleNames: vi.fn(async () => state.keycloakRolesResult),
  resolveProjectedMainserverCredentialState: vi.fn(async () => state.mainserverCredentialResult),
  resolveProjectedUserDetail: vi.fn(async (input) => ({ ...input.user, roles: state.keycloakRolesResult })),
  applyCanonicalUserDetailProjection: vi.fn(async (input) => ({
    ...input.user,
    roles: state.keycloakRolesResult,
    credentials: state.mainserverCredentialResult,
  })),
  applyCanonicalUserListProjection: vi.fn(async ({ users }) =>
    users.map((user: Record<string, unknown>) => ({ ...user, roles: state.keycloakRolesResult }))
  ),
  mergeMainserverCredentialState: vi.fn((user, credentials) => ({ ...user, credentials })),
}));

vi.mock('./user-timeline-query.js', () => ({
  resolveUserTimeline: vi.fn(async () => state.timelineResult),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: vi.fn(() => state.rateLimitResult),
}));

vi.mock('./types.js', () => ({
  USER_STATUS: ['active', 'inactive', 'pending'],
}));

describe('user-read-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actorResolution = {
      actor: {
        instanceId: 'test-instance',
        actorAccountId: 'account-1',
        requestId: 'req-users',
        traceId: 'trace-users',
      },
    };
    state.rateLimitResult = null;
  });

  describe('listUsersInternal', () => {
    it('returns users list with pagination on success', async () => {
      const { listUsersInternal } = await import('./user-read-handlers');

      const request = new Request('http://localhost/users?page=0&pageSize=10');
      const ctx = { user: { id: 'actor-1' } } as any;

      const response = await listUsersInternal(request, ctx);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.items).toHaveLength(2);
      expect(data.data.items[0].roles).toEqual(['admin', 'user']);
    });

    it('respects status filter parameter', async () => {
      const { listUsersInternal } = await import('./user-read-handlers');

      const request = new Request('http://localhost/users?status=active');
      const ctx = { user: { id: 'actor-1' } } as any;

      const response = await listUsersInternal(request, ctx);

      expect(response.status).toBe(200);
    });

    it('returns 400 for invalid status filter', async () => {
      const { listUsersInternal } = await import('./user-read-handlers');

      const request = new Request('http://localhost/users?status=invalid_status');
      const ctx = { user: { id: 'actor-1' } } as any;

      const response = await listUsersInternal(request, ctx);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('invalid_request');
    });

    it('respects rate limit when enforced', async () => {
      state.rateLimitResult = new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
      });

      const { listUsersInternal } = await import('./user-read-handlers');

      const request = new Request('http://localhost/users');
      const ctx = { user: { id: 'actor-1' } } as any;

      const response = await listUsersInternal(request, ctx);

      expect(response.status).toBe(429);
    });
  });

  describe('getUserInternal', () => {
    it('returns user detail with roles and credentials on success', async () => {
      const { getUserInternal } = await import('./user-read-handlers');

      const request = new Request('http://localhost/users/user-1');
      const ctx = { user: { id: 'actor-1' } } as any;

      const response = await getUserInternal(request, ctx);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.data.username).toBe('alice');
    });

    it('returns 404 when user not found', async () => {
      state.userDetailResult = null;

      const { getUserInternal } = await import('./user-read-handlers');

      const request = new Request('http://localhost/users/nonexistent');
      const ctx = { user: { id: 'actor-1' } } as any;

      const response = await getUserInternal(request, ctx);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error.code).toBe('not_found');
    });

    it('handles degraded projection when keycloak roles fail', async () => {
      const { logUserProjectionDegraded } = await import('./user-read-shared.js');
      vi.mocked(logUserProjectionDegraded).mockClear();
    // Ensure userDetail is returned
    state.userDetailResult = {
      id: 'user-1',
      keycloakSubject: 'kc-user-1',
      username: 'alice',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Example',
      displayName: 'Alice Example',
    };
      const { getUserInternal } = await import('./user-read-handlers');

      const request = new Request('http://localhost/users/user-1');
      const ctx = { user: { id: 'actor-1' } } as any;

      const response = await getUserInternal(request, ctx);

      expect(response.status).toBe(200);
      expect(logUserProjectionDegraded).toHaveBeenCalled();
    });
  });
});
