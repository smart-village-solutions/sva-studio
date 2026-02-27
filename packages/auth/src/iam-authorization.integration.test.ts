import { beforeEach, describe, expect, it, vi } from 'vitest';

const integrationState = vi.hoisted(() => ({
  user: {
    id: 'keycloak-sub-integration',
    name: 'Integration User',
    roles: [],
    instanceId: '11111111-1111-1111-8111-111111111111',
  },
  queryHandler: null as null | ((text: string, values?: readonly unknown[]) => unknown),
}));

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-integration',
      user: integrationState.user,
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
    workspaceId: integrationState.user.instanceId,
    requestId: 'req-integration',
    traceId: 'trace-integration',
  }),
  withRequestContext: async (
    _options: unknown,
    handler: () => Promise<Response> | Response
  ) => handler(),
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

import { authorizeHandler, mePermissionsHandler } from './iam-authorization.server';

describe('IAM authorization integration denials', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    integrationState.user = {
      id: 'keycloak-sub-integration',
      name: 'Integration User',
      roles: [],
      instanceId: '11111111-1111-1111-8111-111111111111',
    };
    integrationState.queryHandler = null;
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

  it('denies authorize for cross-instance request', async () => {
    integrationState.user = {
      ...integrationState.user,
      instanceId: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa',
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
        instanceId: '11111111-1111-1111-8111-111111111111',
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
      permissions: unknown[];
    };

    expect(response.status).toBe(200);
    expect(payload.requestId).toBe('req-integration');
    expect(payload.traceId).toBe('trace-integration');
    expect(payload.permissions.length).toBe(1);
  });
});
