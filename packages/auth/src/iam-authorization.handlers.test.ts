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
  impersonationResult: { ok: true } as { ok: true } | { ok: false; reasonCode: string },
}));

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-1',
      user: testState.user,
    })
  ),
}));

vi.mock('./iam-governance.server', () => ({
  resolveImpersonationSubject: vi.fn(async () => testState.impersonationResult),
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
    testState.impersonationResult = { ok: true };
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
      if (text.includes('p.permission_key')) {
        return {
          rowCount: 1,
          rows: [
            {
              permission_key: 'content.read',
              action: 'content.read',
              resource_type: 'content',
              effect: 'allow',
              scope: {},
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
      if (text.includes('p.permission_key')) {
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

  it('includes active delegations in permission snapshot query', async () => {
    let usedDelegationJoin = false;
    testState.queryHandler = (text: string) => {
      if (text.includes('iam.delegations')) {
        usedDelegationJoin = true;
      }
      if (text.includes('p.permission_key')) {
        return {
          rowCount: 1,
          rows: [
            {
              permission_key: 'content.read',
              action: 'content.read',
              resource_type: 'content',
              role_id: 'role-delegated-1',
              organization_id: null,
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
        resource: { type: 'content', id: 'article-1' },
      }),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { allowed: boolean };
    expect(response.status).toBe(200);
    expect(payload.allowed).toBe(true);
    expect(usedDelegationJoin).toBe(true);
  });

  it('uses source alias for organization-scoped membership filter in permission query', async () => {
    testState.user = {
      ...testState.user,
      id: 'keycloak-sub-alias-check',
    };

    let permissionQuery = '';
    testState.queryHandler = (text: string) => {
      if (text.includes('p.permission_key')) {
        permissionQuery = text;
        return {
          rowCount: 1,
          rows: [
            {
              permission_key: 'content.read',
              action: 'content.read',
              resource_type: 'content',
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
      }),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { allowed: boolean };

    expect(response.status).toBe(200);
    expect(payload.allowed).toBe(true);
    expect(permissionQuery).toContain('ao.instance_id = source.instance_id');
    expect(permissionQuery).toContain('ao.account_id = source.account_id');
    expect(permissionQuery).not.toContain('ao.instance_id = ar.instance_id');
  });

  it('returns denied decision when a structured deny permission blocks the active organization', async () => {
    testState.user = {
      ...testState.user,
      id: 'keycloak-sub-deny-1',
    };

    testState.queryHandler = (text: string) => {
      if (text.includes('WITH target_organization AS')) {
        return {
          rowCount: 2,
          rows: [
            {
              permission_key: 'content.read',
              action: 'content.read',
              resource_type: 'content',
              effect: 'allow',
              scope: {},
              role_id: 'role-parent-1',
              organization_id: '22222222-2222-2222-8222-222222222222',
            },
            {
              permission_key: 'content.read',
              action: 'content.read',
              resource_type: 'content',
              effect: 'deny',
              scope: { restrictedOrganizationIds: ['22222222-2222-2222-8222-222222222222'] },
              role_id: 'role-child-1',
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
          attributes: {
            organizationHierarchy: [
              '11111111-1111-1111-8111-111111111111',
              '22222222-2222-2222-8222-222222222222',
            ],
          },
        },
      }),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { allowed: boolean; reason: string };

    expect(response.status).toBe(200);
    expect(payload.allowed).toBe(false);
    expect(payload.reason).toBe('hierarchy_restriction');
  });

  it('denies acting-as authorize when impersonation session is not active', async () => {
    testState.impersonationResult = { ok: false, reasonCode: 'DENY_TICKET_REQUIRED' };

    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instanceId: '11111111-1111-1111-8111-111111111111',
        action: 'content.read',
        resource: { type: 'content', id: 'article-1' },
        context: {
          actingAsUserId: 'target-sub-1',
        },
      }),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { allowed: boolean; reason: string; diagnostics?: { reason_code?: string } };

    expect(response.status).toBe(200);
    expect(payload.allowed).toBe(false);
    expect(payload.reason).toBe('context_attribute_missing');
    expect(payload.diagnostics?.reason_code).toBe('DENY_TICKET_REQUIRED');
  });
});
