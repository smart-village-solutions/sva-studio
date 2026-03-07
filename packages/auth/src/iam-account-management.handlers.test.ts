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

vi.mock('./keycloak-admin-client', () => ({
  getKeycloakAdminClientConfigFromEnv: () => ({
    baseUrl: 'http://keycloak.local',
    realm: 'test',
    clientId: 'client',
    clientSecret: 'secret',
  }),
  KeycloakAdminClient: class MockKeycloakAdminClient {
    getCircuitBreakerState() {
      return 0;
    }

    async updateUser() {
      return undefined;
    }

    async deactivateUser() {
      return undefined;
    }

    async syncRoles() {
      return undefined;
    }

    async createUser() {
      return { id: 'mock-user-id' };
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

const targetUserId = 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb';

const buildUserDetailRow = (status: 'active' | 'inactive' = 'active') => ({
  id: targetUserId,
  keycloak_subject: 'keycloak-target-2',
  display_name_ciphertext: 'Target User',
  email_ciphertext: 'target@example.com',
  first_name_ciphertext: 'Target',
  last_name_ciphertext: 'User',
  phone_ciphertext: null,
  position: null,
  department: null,
  preferred_language: null,
  timezone: null,
  avatar_url: null,
  notes: null,
  status,
  last_login_at: null,
  role_rows: [
    {
      id: 'role-editor',
      role_name: 'editor',
      role_level: 10,
      is_system_role: false,
    },
  ],
  permission_rows: [{ permission_key: 'content.read' }],
});

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

  it('updates a user successfully on happy path', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 1, rows: [buildUserDetailRow('active')] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await updateUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          firstName: 'Updated',
          lastName: 'Name',
          status: 'active',
        }),
      })
    );

    const payload = (await response.json()) as { data: { id: string; status: string } };
    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(targetUserId);
    expect(payload.data.status).toBe('active');
  });

  it('deactivates a user successfully on happy path', async () => {
    let userStatus: 'active' | 'inactive' = 'active';

    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('SELECT EXISTS (')) {
        return { rowCount: 1, rows: [{ has_role: false }] };
      }

      if (text.includes("SET\n  status = 'inactive'")) {
        userStatus = 'inactive';
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 1, rows: [buildUserDetailRow(userStatus)] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await deactivateUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, {
        method: 'DELETE',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    const payload = (await response.json()) as { data: { id: string; status: string } };
    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(targetUserId);
    expect(payload.data.status).toBe('inactive');
  });

  it('rejects deactivation when target user exceeds actor role level', async () => {
    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 10 }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetUserId,
              keycloak_subject: 'keycloak-target-1',
              display_name_ciphertext: 'Target User',
              email_ciphertext: 'target@example.com',
              first_name_ciphertext: 'Target',
              last_name_ciphertext: 'User',
              phone_ciphertext: null,
              position: null,
              department: null,
              preferred_language: null,
              timezone: null,
              avatar_url: null,
              notes: null,
              status: 'active',
              last_login_at: null,
              role_rows: [
                {
                  id: 'role-system-admin',
                  role_name: 'system_admin',
                  role_level: 90,
                  is_system_role: true,
                },
              ],
              permission_rows: [],
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await deactivateUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, {
        method: 'DELETE',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    const payload = (await response.json()) as { error: { code: string; message: string } };
    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('forbidden');
    expect(payload.error.message).toContain('Berechtigungsstufe');
  });

  it('fails closed when PII encryption is required but not configured', async () => {
    process.env.IAM_PII_ALLOW_PLAINTEXT_FALLBACK = 'false';
    delete process.env.IAM_PII_ACTIVE_KEY_ID;
    delete process.env.IAM_PII_KEYRING_JSON;

    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetUserId,
              keycloak_subject: 'keycloak-target-2',
              display_name_ciphertext: 'Target User',
              email_ciphertext: 'target@example.com',
              first_name_ciphertext: 'Target',
              last_name_ciphertext: 'User',
              phone_ciphertext: null,
              position: null,
              department: null,
              preferred_language: null,
              timezone: null,
              avatar_url: null,
              notes: null,
              status: 'active',
              last_login_at: null,
              role_rows: [
                {
                  id: 'role-editor',
                  role_name: 'editor',
                  role_level: 10,
                  is_system_role: false,
                },
              ],
              permission_rows: [],
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await updateUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          firstName: 'Updated',
        }),
      })
    );

    const payload = (await response.json()) as { error: { code: string; message: string } };
    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('internal_error');
    expect(payload.error.message).toContain('PII-Verschlüsselung');
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
