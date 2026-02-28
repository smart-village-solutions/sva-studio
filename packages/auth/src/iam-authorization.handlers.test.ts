import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  user: {
    id: 'keycloak-sub-1',
    name: 'Test User',
    roles: [],
    instanceId: '11111111-1111-1111-8111-111111111111',
  },
  connectError: null as Error | null,
  queryHandler: null as null | ((text: string, values?: readonly unknown[]) => unknown),
  latencyMetrics: [] as Array<{ durationMs: number; attributes?: Record<string, unknown> }>,
}));

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-1',
      user: testState.user,
    })
  ),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getWorkspaceContext: () => ({
    workspaceId: '11111111-1111-1111-8111-111111111111',
    requestId: 'req-test',
    traceId: 'trace-test',
  }),
  withRequestContext: async (
    _options: unknown,
    handler: () => Promise<Response> | Response
  ) => handler(),
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createHistogram: vi.fn(() => ({
        record: vi.fn((durationMs: number, attributes?: Record<string, unknown>) => {
          testState.latencyMetrics.push({ durationMs, attributes });
        }),
      })),
      createCounter: vi.fn(() => ({
        add: vi.fn(),
      })),
      createObservableGauge: vi.fn(() => ({
        addCallback: vi.fn(),
      })),
    })),
  },
}));

vi.mock('pg', () => ({
  Pool: class MockPool {
    async connect() {
      if (testState.connectError) {
        throw testState.connectError;
      }
      return {
        async query(text: string, values?: readonly unknown[]) {
          if (testState.queryHandler) {
            const handled = testState.queryHandler(text, values) as
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

import { authorizeHandler } from './iam-authorization.server';

describe('authorizeHandler', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    testState.connectError = null;
    testState.queryHandler = null;
    testState.latencyMetrics = [];
    testState.user = {
      id: 'keycloak-sub-1',
      name: 'Test User',
      roles: [],
      instanceId: '11111111-1111-1111-8111-111111111111',
    };
  });

  it('returns 400 for invalid request payload', async () => {
    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe('invalid_request');
  });

  it('returns denied decision when instance scope mismatches', async () => {
    testState.user = {
      ...testState.user,
      instanceId: '99999999-9999-9999-8999-999999999999',
    };

    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instanceId: '11111111-1111-1111-8111-111111111111',
        action: 'content.read',
        resource: { type: 'content', id: 'article-1' },
      }),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as {
      allowed: boolean;
      reason: string;
      requestId?: string;
      traceId?: string;
    };

    expect(response.status).toBe(200);
    expect(payload.allowed).toBe(false);
    expect(payload.reason).toBe('instance_scope_mismatch');
    expect(payload.requestId).toBe('req-test');
    expect(payload.traceId).toBe('trace-test');
    expect(testState.latencyMetrics).toHaveLength(1);
    expect(testState.latencyMetrics[0]?.attributes).toMatchObject({
      allowed: false,
      reason: 'instance_scope_mismatch',
      endpoint: '/iam/authorize',
    });
  });

  it('returns allowed decision for matching permission', async () => {
    testState.queryHandler = (text: string) => {
      if (text.includes('SELECT\n  p.permission_key')) {
        return {
          rowCount: 1,
          rows: [
            {
              permission_key: 'content.read',
              role_id: 'role-1',
              organization_id: '22222222-2222-2222-8222-222222222222',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instanceId: '11111111-1111-1111-8111-111111111111',
        action: 'content.read',
        resource: {
          type: 'content',
          id: 'article-1',
          organizationId: '22222222-2222-2222-8222-222222222222',
        },
        context: {
          organizationId: '22222222-2222-2222-8222-222222222222',
        },
      }),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { allowed: boolean; reason: string };

    expect(response.status).toBe(200);
    expect(payload.allowed).toBe(true);
    expect(payload.reason).toBe('allowed_by_rbac');
  });

  it('returns 503 when database is unavailable', async () => {
    testState.connectError = new Error('db down');

    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instanceId: '11111111-1111-1111-8111-111111111111',
        action: 'content.read',
        resource: { type: 'content', id: 'article-1' },
      }),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe('database_unavailable');
    expect(testState.latencyMetrics).toHaveLength(1);
    expect(testState.latencyMetrics[0]?.attributes).toMatchObject({
      allowed: false,
      reason: 'database_unavailable',
      endpoint: '/iam/authorize',
    });
  });

  it('reuses cached permission snapshot for repeated authorize requests', async () => {
    let permissionSelects = 0;
    testState.user = {
      ...testState.user,
      id: 'keycloak-sub-cache-consistency',
    };
    testState.queryHandler = (text: string) => {
      if (text.includes('SELECT\n  p.permission_key')) {
        permissionSelects += 1;
        return {
          rowCount: 1,
          rows: [
            {
              permission_key: 'content.read',
              role_id: 'role-cache-1',
              organization_id: '22222222-2222-2222-8222-222222222222',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const makeRequest = () =>
      new Request('http://localhost/iam/authorize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instanceId: '11111111-1111-1111-8111-111111111111',
          action: 'content.read',
          resource: {
            type: 'content',
            organizationId: '22222222-2222-2222-8222-222222222222',
          },
          context: {
            organizationId: '22222222-2222-2222-8222-222222222222',
          },
        }),
      });

    const first = await authorizeHandler(makeRequest());
    const second = await authorizeHandler(makeRequest());
    const firstPayload = (await first.json()) as { allowed: boolean; reason: string };
    const secondPayload = (await second.json()) as { allowed: boolean; reason: string };

    expect(firstPayload).toMatchObject({ allowed: true, reason: 'allowed_by_rbac' });
    expect(secondPayload).toMatchObject({ allowed: true, reason: 'allowed_by_rbac' });
    expect(permissionSelects).toBe(1);
  });
});
