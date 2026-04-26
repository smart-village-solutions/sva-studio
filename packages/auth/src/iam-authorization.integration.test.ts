import { beforeEach, describe, expect, it, vi } from 'vitest';

const integrationState = vi.hoisted(() => ({
  user: {
    id: 'keycloak-sub-integration',
    name: 'Integration User',
    roles: [],
    instanceId: 'de-musterhausen',
  },
  queryHandler: null as null | ((text: string, values?: readonly unknown[]) => unknown),
  impersonationResult: { ok: true } as { ok: true } | { ok: false; reasonCode: string },
  redisStore: new Map<string, string>(),
}));

vi.mock('./middleware.server.js', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-integration',
      user: integrationState.user,
    })
  ),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getWorkspaceContext: () => ({
    workspaceId: integrationState.user.instanceId,
    requestId: 'req-integration',
    traceId: 'trace-integration',
  }),
  toJsonErrorResponse: (status: number, code: string, publicMessage?: string, options?: { requestId?: string }) =>
    new Response(
      JSON.stringify({
        error: code,
        ...(publicMessage ? { message: publicMessage } : {}),
        ...(options?.requestId ? { requestId: options.requestId } : {}),
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    ),
  withRequestContext: async (
    _options: unknown,
    handler: () => Promise<Response> | Response
  ) => handler(),
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createHistogram: vi.fn(() => ({ record: vi.fn() })),
      createCounter: vi.fn(() => ({ add: vi.fn() })),
      createObservableGauge: vi.fn(() => ({ addCallback: vi.fn() })),
    })),
  },
}));

vi.mock('pg', () => ({
  Pool: class MockPool {
    async connect() {
      return {
        async query(text: string, values?: readonly unknown[]) {
          if (integrationState.queryHandler) {
            const handled = integrationState.queryHandler(text, values) as
              | { rowCount: number; rows: unknown[] }
              | undefined;
            if (handled) {
              return handled;
            }
          }
          return { rowCount: 0, rows: [] };
        },
        release() {
          return undefined;
        },
      };
    }
  },
}));

vi.mock('./redis.server.js', () => ({
  getRedisClient: () => ({
    async get(key: string) {
      return integrationState.redisStore.get(key) ?? null;
    },
    async setex(key: string, _ttl: number, value: string) {
      integrationState.redisStore.set(key, value);
      return 'OK';
    },
    async del(...keys: string[]) {
      let deleted = 0;
      for (const key of keys) {
        deleted += integrationState.redisStore.delete(key) ? 1 : 0;
      }
      return deleted;
    },
    async scan(_cursor: string, _matchToken: string, pattern: string) {
      const regex = new RegExp(`^${pattern.replaceAll('*', '.*')}$`);
      const keys = [...integrationState.redisStore.keys()].filter((key) => regex.test(key));
      return ['0', keys];
    },
  }),
}));

vi.mock('./iam-governance.server.js', () => ({
  resolveImpersonationSubject: vi.fn(async () => integrationState.impersonationResult),
}));

import { authorizeHandler, mePermissionsHandler } from './iam-authorization.server';
import { permissionSnapshotCache } from './iam-authorization/shared';

describe('IAM authorization integration denials', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    integrationState.user = {
      id: 'keycloak-sub-integration',
      name: 'Integration User',
      roles: [],
      instanceId: 'de-musterhausen',
    };
    permissionSnapshotCache.invalidate({
      instanceId: integrationState.user.instanceId,
      keycloakSubject: integrationState.user.id,
    });
    permissionSnapshotCache.invalidate({
      instanceId: integrationState.user.instanceId,
      keycloakSubject: 'keycloak-sub-target',
    });
    integrationState.queryHandler = null;
    integrationState.impersonationResult = { ok: true };
    integrationState.redisStore.clear();
  });

  it('denies me/permissions for cross-instance request', async () => {
    const request = new Request(
      'http://localhost/iam/me/permissions?instanceId=22222222-2222-2222-8222-222222222222',
      {
        method: 'GET',
      }
    );

    const response = await mePermissionsHandler(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toBe('instance_scope_mismatch');
  });

  it('denies me/permissions for non-matching string instance ids', async () => {
    const request = new Request('http://localhost/iam/me/permissions?instanceId=invalid', {
      method: 'GET',
    });

    const response = await mePermissionsHandler(request);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'instance_scope_mismatch' });
  });

  it('rejects me/permissions for invalid organization id', async () => {
    const request = new Request('http://localhost/iam/me/permissions?organizationId=invalid', {
      method: 'GET',
    });

    const response = await mePermissionsHandler(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_organization_id' });
  });

  it('rejects me/permissions for invalid geo query context', async () => {
    const request = new Request('http://localhost/iam/me/permissions?geoUnitId=invalid', {
      method: 'GET',
    });

    const response = await mePermissionsHandler(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
  });

  it('denies authorize for cross-instance request', async () => {
    integrationState.user = {
      ...integrationState.user,
      instanceId: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa',
    };

    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instanceId: 'de-musterhausen',
        action: 'content.read',
        resource: { type: 'content', id: 'article-1' },
      }),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { allowed: boolean; reason: string };

    expect(response.status).toBe(200);
    expect(payload.allowed).toBe(false);
    expect(payload.reason).toBe('instance_scope_mismatch');
  });

  it('denies authorize for organization without effective permissions', async () => {
    integrationState.queryHandler = (text: string, values?: readonly unknown[]) => {
      if (text.includes('SELECT\n  p.permission_key')) {
        const organizationId = values?.[2];
        if (organizationId === '33333333-3333-3333-8333-333333333333') {
          return { rowCount: 0, rows: [] };
        }
      }
      return { rowCount: 0, rows: [] };
    };

    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instanceId: 'de-musterhausen',
        action: 'content.read',
        resource: {
          type: 'content',
          id: 'article-1',
          organizationId: '33333333-3333-3333-8333-333333333333',
        },
        context: {
          organizationId: '33333333-3333-3333-8333-333333333333',
        },
      }),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { allowed: boolean; reason: string };

    expect(response.status).toBe(200);
    expect(payload.allowed).toBe(false);
    expect(payload.reason).toBe('permission_missing');
  });

  it('allows authorize for fully qualified plugin action within the same namespace', async () => {
    integrationState.queryHandler = () => ({
      rowCount: 1,
      rows: [
        {
          permission_key: 'news.publish',
          action: 'news.publish',
          resource_type: 'news',
          effect: 'allow',
          scope: {},
          role_id: 'role-news-publisher',
          organization_id: null,
        },
      ],
    });

    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instanceId: 'de-musterhausen',
        action: 'news.publish',
        resource: {
          type: 'news',
          id: 'news-1',
        },
      }),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { allowed: boolean; reason: string };

    expect(response.status).toBe(200);
    expect(payload.allowed).toBe(true);
    expect(payload.reason).toBe('allowed_by_rbac');
  });

  it('denies authorize for foreign fully qualified plugin action despite same action name', async () => {
    integrationState.queryHandler = () => ({
      rowCount: 1,
      rows: [
        {
          permission_key: 'events.publish',
          action: 'events.publish',
          resource_type: 'events',
          effect: 'allow',
          scope: {},
          role_id: 'role-events-publisher',
          organization_id: null,
        },
      ],
    });

    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instanceId: 'de-musterhausen',
        action: 'news.publish',
        resource: {
          type: 'news',
          id: 'news-1',
        },
      }),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { allowed: boolean; reason: string; action?: string };

    expect(response.status).toBe(200);
    expect(payload.allowed).toBe(false);
    expect(payload.reason).toBe('permission_missing');
    expect(payload.action).toBe('news.publish');
  });

  it('propagates request_id and trace_id in me/permissions response', async () => {
    integrationState.queryHandler = (text: string) => {
      if (text.includes('SELECT DISTINCT')) {
        return {
          rowCount: 1,
          rows: [
            {
              permission_key: 'content.read',
              role_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa',
              organization_id: null,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const request = new Request('http://localhost/iam/me/permissions', { method: 'GET' });
    const response = await mePermissionsHandler(request);
    const payload = (await response.json()) as {
      requestId?: string;
      traceId?: string;
      snapshotVersion?: string | null;
      cacheStatus?: string;
      permissions: unknown[];
      subject: {
        actorUserId: string;
        effectiveUserId: string;
        isImpersonating: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.requestId).toBe('req-integration');
    expect(payload.traceId).toBe('trace-integration');
    expect(payload.snapshotVersion).toEqual(expect.any(String));
    expect(payload.cacheStatus).toBe('miss');
    expect(payload.permissions.length).toBe(1);
    expect(payload.subject).toEqual({
      actorUserId: 'keycloak-sub-integration',
      effectiveUserId: 'keycloak-sub-integration',
      isImpersonating: false,
    });
  });

  it('returns impersonation_not_active when actingAsUserId has no active session', async () => {
    integrationState.impersonationResult = { ok: false, reasonCode: 'DENY_TICKET_REQUIRED' };

    const request = new Request(
      'http://localhost/iam/me/permissions?actingAsUserId=keycloak-sub-target',
      { method: 'GET' }
    );

    const response = await mePermissionsHandler(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toBe('impersonation_not_active');
  });

  it('returns database_unavailable when impersonation resolution cannot reach the database', async () => {
    integrationState.impersonationResult = { ok: false, reasonCode: 'database_unavailable' };

    const request = new Request(
      'http://localhost/iam/me/permissions?actingAsUserId=keycloak-sub-target',
      { method: 'GET' }
    );

    const response = await mePermissionsHandler(request);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'database_unavailable' });
  });

  it('maps unexpected impersonation denial reasons to instance_scope_mismatch', async () => {
    integrationState.impersonationResult = {
      ok: false,
      reasonCode: 'DENY_INSTANCE_SCOPE_MISMATCH',
    };

    const request = new Request(
      'http://localhost/iam/me/permissions?actingAsUserId=keycloak-sub-target',
      { method: 'GET' }
    );

    const response = await mePermissionsHandler(request);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'instance_scope_mismatch' });
  });

  it('treats actingAsUserId equal to current user as self request', async () => {
    integrationState.impersonationResult = { ok: false, reasonCode: 'DENY_TICKET_REQUIRED' };
    integrationState.queryHandler = (text: string, values?: readonly unknown[]) => {
      if (text.includes('SELECT DISTINCT')) {
        expect(values?.[1]).toBe('keycloak-sub-integration');
        return {
          rowCount: 1,
          rows: [
            {
              permission_key: 'content.read',
              role_id: 'cccccccc-cccc-cccc-8ccc-cccccccccccc',
              organization_id: null,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const request = new Request(
      'http://localhost/iam/me/permissions?actingAsUserId=keycloak-sub-integration',
      { method: 'GET' }
    );

    const response = await mePermissionsHandler(request);
    const payload = (await response.json()) as {
      permissions: unknown[];
      subject: {
        actorUserId: string;
        effectiveUserId: string;
        isImpersonating: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.permissions.length).toBe(1);
    expect(payload.subject).toEqual({
      actorUserId: 'keycloak-sub-integration',
      effectiveUserId: 'keycloak-sub-integration',
      isImpersonating: false,
    });
  });

  it('returns impersonation_expired when actingAsUserId session expired', async () => {
    integrationState.impersonationResult = {
      ok: false,
      reasonCode: 'DENY_IMPERSONATION_DURATION_EXCEEDED',
    };

    const request = new Request(
      'http://localhost/iam/me/permissions?actingAsUserId=keycloak-sub-target',
      { method: 'GET' }
    );

    const response = await mePermissionsHandler(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toBe('impersonation_expired');
  });

  it('resolves permissions for actingAsUserId and sets subject metadata', async () => {
    integrationState.impersonationResult = { ok: true };
    integrationState.queryHandler = (text: string, values?: readonly unknown[]) => {
      if (text.includes('SELECT DISTINCT')) {
        expect(values?.[1]).toBe('keycloak-sub-target');
        return {
          rowCount: 1,
          rows: [
            {
              permission_key: 'content.read',
              role_id: 'bbbbbbbb-bbbb-bbbb-8bbb-bbbbbbbbbbbb',
              organization_id: null,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const request = new Request(
      'http://localhost/iam/me/permissions?actingAsUserId=keycloak-sub-target',
      { method: 'GET' }
    );

    const response = await mePermissionsHandler(request);
    const payload = (await response.json()) as {
      permissions: unknown[];
      subject: {
        actorUserId: string;
        effectiveUserId: string;
        isImpersonating: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.permissions.length).toBe(1);
    expect(payload.subject).toEqual({
      actorUserId: 'keycloak-sub-integration',
      effectiveUserId: 'keycloak-sub-target',
      isImpersonating: true,
    });
  });

  it('returns database_unavailable when a stale cache entry cannot be recomputed', async () => {
    integrationState.user = {
      ...integrationState.user,
      id: 'keycloak-sub-stale-guard',
    };
    const instanceId = integrationState.user.instanceId;
    permissionSnapshotCache.set(
      {
        instanceId,
        keycloakSubject: integrationState.user.id,
      },
      [
        {
          action: 'content.read',
          resourceType: 'content',
          sourceRoleIds: ['role-stale'],
        },
      ],
      Date.now() - 300_000
    );
    integrationState.queryHandler = (text: string) => {
      if (text.includes('SELECT DISTINCT')) {
        throw new Error('db down');
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await mePermissionsHandler(new Request('http://localhost/iam/me/permissions'));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: 'database_unavailable' });

    permissionSnapshotCache.invalidate({
      instanceId,
      keycloakSubject: integrationState.user.id,
    });
  });

  it('returns database_unavailable when permission resolution fails without a stale cache entry', async () => {
    integrationState.user = {
      ...integrationState.user,
      id: 'keycloak-sub-db-failure',
    };
    integrationState.queryHandler = (text: string) => {
      if (text.includes('SELECT DISTINCT')) {
        throw new Error('db down');
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await mePermissionsHandler(new Request('http://localhost/iam/me/permissions'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'database_unavailable' });
  });
});
