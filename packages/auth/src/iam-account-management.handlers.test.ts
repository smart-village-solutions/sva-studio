import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: {
    id: 'keycloak-admin-1',
    name: 'Admin User',
    roles: ['system_admin'],
    instanceId: '11111111-1111-1111-8111-111111111111',
  },
  queryHandler: null as null | ((text: string, values?: readonly unknown[]) => { rowCount: number; rows: unknown[] }),
}));

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-handler-test',
      user: state.user,
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
    workspaceId: state.user.instanceId,
    requestId: 'req-iam-handler',
    traceId: 'trace-iam-handler',
  }),
  withRequestContext: async (_opts: unknown, handler: () => Promise<Response> | Response) => handler(),
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
          if (state.queryHandler) {
            const handled = state.queryHandler(text, values);
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

import {
  createUserHandler,
  deactivateUserHandler,
  getIamFeatureFlags,
  getUserHandler,
  listUsersHandler,
  updateUserHandler,
} from './iam-account-management.server';

describe('iam-account-management handlers (guards)', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    delete process.env.IAM_UI_ENABLED;
    delete process.env.IAM_ADMIN_ENABLED;
    delete process.env.IAM_BULK_ENABLED;

    state.user = {
      id: `keycloak-admin-${Date.now()}`,
      name: 'Admin User',
      roles: ['system_admin'],
      instanceId: '11111111-1111-1111-8111-111111111111',
    };

    state.queryHandler = (text, values) => {
      if (text.includes('FROM iam.accounts a') && text.includes('WHERE a.keycloak_subject = $2')) {
        const instanceId = values?.[0];
        const keycloakSubject = values?.[1];
        if (
          instanceId === '11111111-1111-1111-8111-111111111111' &&
          typeof keycloakSubject === 'string' &&
          keycloakSubject.startsWith('keycloak-admin-')
        ) {
          return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
        }
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };
  });

  it('denies listUsers for non-admin role', async () => {
    state.user = {
      ...state.user,
      roles: ['member'],
    };

    const response = await listUsersHandler(new Request('http://localhost/api/v1/iam/users', { method: 'GET' }));
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('forbidden');
  });

  it('rejects invalid status filter on listUsers', async () => {
    const response = await listUsersHandler(
      new Request('http://localhost/api/v1/iam/users?status=unknown', { method: 'GET' })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_request');
  });

  it('rejects getUser for invalid user id path segment', async () => {
    const response = await getUserHandler(new Request('http://localhost/api/v1/iam/users/not-a-uuid', { method: 'GET' }));
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_request');
  });

  it('rejects createUser without CSRF header', async () => {
    const response = await createUserHandler(
      new Request('http://localhost/api/v1/iam/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'new.user@example.com' }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('csrf_validation_failed');
  });

  it('rejects createUser without idempotency key', async () => {
    const response = await createUserHandler(
      new Request('http://localhost/api/v1/iam/users', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({ email: 'new.user@example.com' }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('idempotency_key_required');
  });

  it('rejects updateUser for invalid user id', async () => {
    const response = await updateUserHandler(
      new Request('http://localhost/api/v1/iam/users/not-a-uuid', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({ firstName: 'Max' }),
      })
    );

    const payload = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_request');
  });

  it('rejects deactivateUser for invalid user id', async () => {
    const response = await deactivateUserHandler(
      new Request('http://localhost/api/v1/iam/users/not-a-uuid', {
        method: 'DELETE',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    const payload = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_request');
  });
});

describe('getIamFeatureFlags', () => {
  it('uses secure defaults when env vars are missing', () => {
    delete process.env.IAM_UI_ENABLED;
    delete process.env.IAM_ADMIN_ENABLED;
    delete process.env.IAM_BULK_ENABLED;

    expect(getIamFeatureFlags()).toEqual({
      iamUiEnabled: true,
      iamAdminEnabled: true,
      iamBulkEnabled: true,
    });
  });

  it('derives dependent flags from parent flags', () => {
    process.env.IAM_UI_ENABLED = 'false';
    process.env.IAM_ADMIN_ENABLED = 'true';
    process.env.IAM_BULK_ENABLED = 'true';

    expect(getIamFeatureFlags()).toEqual({
      iamUiEnabled: false,
      iamAdminEnabled: false,
      iamBulkEnabled: false,
    });
  });
});
