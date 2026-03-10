import { beforeEach, describe, expect, it, vi } from 'vitest';

const integrationState = vi.hoisted(() => ({
  user: {
    id: 'keycloak-sub-admin',
    name: 'Integration Admin',
    roles: ['system_admin'],
    instanceId: '11111111-1111-1111-8111-111111111111',
  },
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
    requestId: 'req-iam-integration',
    traceId: 'trace-iam-integration',
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
  withRequestContext: async (_options: unknown, handler: () => Promise<Response> | Response) => handler(),
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
          if (text.includes('FROM iam.accounts a') && text.includes('WHERE a.keycloak_subject = $2')) {
            const instanceId = values?.[0];
            const keycloakSubject = values?.[1];
            if (
              instanceId === '11111111-1111-1111-8111-111111111111' &&
              keycloakSubject === 'keycloak-sub-admin'
            ) {
              return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
            }
            return { rowCount: 0, rows: [] };
          }

          // Defensive default: prevent accidental data leakage in tests.
          return { rowCount: 0, rows: [] };
        },
        release() {
          return undefined;
        },
      };
    }
  },
}));

import { getUserHandler, listUsersHandler } from './iam-account-management.server';

describe('iam-account-management tenant isolation integration', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    integrationState.user = {
      id: 'keycloak-sub-admin',
      name: 'Integration Admin',
      roles: ['system_admin'],
      instanceId: '11111111-1111-1111-8111-111111111111',
    };
  });

  it('returns 403 for list users when instanceId points to a foreign tenant', async () => {
    const response = await listUsersHandler(
      new Request('http://localhost/api/v1/iam/users?instanceId=22222222-2222-2222-8222-222222222222', {
        method: 'GET',
      })
    );

    const payload = (await response.json()) as { error: { code: string; message: string } };
    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('forbidden');
    expect(payload.error.message).toBe('Akteur-Account nicht gefunden.');
  });

  it('returns 200 for list users when instanceId matches own tenant', async () => {
    const response = await listUsersHandler(
      new Request('http://localhost/api/v1/iam/users?instanceId=11111111-1111-1111-8111-111111111111', {
        method: 'GET',
      })
    );

    const payload = (await response.json()) as {
      data?: unknown[];
      error?: { code: string; message: string };
    };
    expect(response.status).toBe(200);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.error).toBeUndefined();
  });

  it('returns 403 for get user when instanceId points to a foreign tenant', async () => {
    const response = await getUserHandler(
      new Request(
        'http://localhost/api/v1/iam/users/aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa?instanceId=22222222-2222-2222-8222-222222222222',
        {
          method: 'GET',
        }
      )
    );

    const payload = (await response.json()) as { error: { code: string; message: string } };
    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('forbidden');
    expect(payload.error.message).toBe('Akteur-Account nicht gefunden.');
  });
});
