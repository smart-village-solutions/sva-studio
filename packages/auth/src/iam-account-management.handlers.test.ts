import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: {
    id: 'keycloak-admin-1',
    name: 'Admin User',
    roles: ['system_admin'],
    instanceId: '11111111-1111-1111-8111-111111111111',
  },
  queryHandler: null as null | ((text: string, values?: readonly unknown[]) => { rowCount: number; rows: unknown[] }),
  createRoleImpl: null as null | ((input: {
    externalName: string;
    description?: string;
    attributes: Record<string, string>;
  }) => Promise<unknown> | unknown),
  updateRoleImpl: null as null | ((externalName: string, input: {
    description?: string;
    attributes: Record<string, string>;
  }) => Promise<unknown> | unknown),
  deleteRoleImpl: null as null | ((externalName: string) => Promise<unknown> | unknown),
  getRoleByNameImpl: null as null | ((externalName: string) => Promise<unknown> | unknown),
  listRolesImpl: null as null | (() => Promise<unknown> | unknown),
  syncRolesImpl: null as null | ((keycloakSubject: string, roleNames: readonly string[]) => Promise<unknown> | unknown),
  syncRolesCalls: [] as Array<{ keycloakSubject: string; roleNames: readonly string[] }>,
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
  redactObject: (value: Record<string, unknown>) => value,
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
  KeycloakAdminRequestError: class MockKeycloakAdminRequestError extends Error {
    statusCode: number;
    code: string;
    retryable: boolean;

    constructor(input: { message: string; statusCode: number; code: string; retryable: boolean }) {
      super(input.message);
      this.statusCode = input.statusCode;
      this.code = input.code;
      this.retryable = input.retryable;
    }
  },
  KeycloakAdminUnavailableError: class MockKeycloakAdminUnavailableError extends Error {},
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

    async syncRoles(keycloakSubject: string, roleNames: readonly string[]) {
      state.syncRolesCalls.push({
        keycloakSubject,
        roleNames: [...roleNames],
      });
      if (state.syncRolesImpl) {
        return state.syncRolesImpl(keycloakSubject, roleNames);
      }
      return undefined;
    }

    async createRole(input: { externalName: string; description?: string; attributes: Record<string, string> }) {
      if (state.createRoleImpl) {
        return state.createRoleImpl(input);
      }
      return {
        id: `kc-${input.externalName}`,
        externalName: input.externalName,
        description: input.description,
        attributes: input.attributes,
      };
    }

    async updateRole(externalName: string, input: { description?: string; attributes: Record<string, string> }) {
      if (state.updateRoleImpl) {
        return state.updateRoleImpl(externalName, input);
      }
      return {
        id: `kc-${externalName}`,
        externalName,
        description: input.description,
        attributes: input.attributes,
      };
    }

    async deleteRole(externalName: string) {
      if (state.deleteRoleImpl) {
        return state.deleteRoleImpl(externalName);
      }
      return undefined;
    }

    async getRoleByName(externalName: string) {
      if (state.getRoleByNameImpl) {
        return state.getRoleByNameImpl(externalName);
      }
      return { id: `kc-${externalName}`, externalName };
    }

    async listRoles() {
      if (state.listRolesImpl) {
        return state.listRolesImpl();
      }
      return [];
    }

    async createUser() {
      return { externalId: 'mock-user-id' };
    }
  },
}));

import {
  createRoleHandler,
  createUserHandler,
  deactivateUserHandler,
  deleteRoleHandler,
  getIamFeatureFlags,
  getUserHandler,
  listRolesHandler,
  listUsersHandler,
  reconcileHandler,
  updateRoleHandler,
  updateUserHandler,
} from './iam-account-management.server';
import { KeycloakAdminRequestError } from './keycloak-admin-client';

const targetUserId = 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb';
const targetRoleId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

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
      role_key: 'editor',
      role_name: 'editor',
      display_name: 'editor',
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
    delete process.env.IAM_PII_ALLOW_PLAINTEXT_FALLBACK;
    delete process.env.IAM_PII_ACTIVE_KEY_ID;
    delete process.env.IAM_PII_KEYRING_JSON;

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
    state.createRoleImpl = null;
    state.updateRoleImpl = null;
    state.deleteRoleImpl = null;
    state.getRoleByNameImpl = null;
    state.listRolesImpl = null;
    state.syncRolesImpl = null;
    state.syncRolesCalls = [];
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
    state.queryHandler = (text) => {
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

    state.queryHandler = (text) => {
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

  it('lists roles on happy path', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.roles r')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_name: 'editor',
              description: 'Editor role',
              is_system_role: false,
              role_level: 20,
              member_count: 3,
              permission_rows: [{ id: 'perm-1', permission_key: 'content.read', description: 'read content' }],
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await listRolesHandler(new Request('http://localhost/api/v1/iam/roles', { method: 'GET' }));
    const payload = (await response.json()) as {
      data: Array<{ id: string; roleName: string; permissions: Array<{ permissionKey: string }> }>;
    };

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.id).toBe(targetRoleId);
    expect(payload.data[0]?.roleName).toBe('editor');
    expect(payload.data[0]?.permissions[0]?.permissionKey).toBe('content.read');
  });

  it('rejects createRole without CSRF header', async () => {
    const response = await createRoleHandler(
      new Request('http://localhost/api/v1/iam/roles', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ roleName: 'custom_role', roleLevel: 20, permissionIds: [] }),
      })
    );

    const payload = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('csrf_validation_failed');
  });

  it('creates a role successfully with idempotency key', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('INSERT INTO iam.idempotency_keys') && text.includes('ON CONFLICT')) {
        return { rowCount: 1, rows: [{ status: 'IN_PROGRESS' }] };
      }

      if (text.includes('INSERT INTO iam.roles') && text.includes('RETURNING id')) {
        return { rowCount: 1, rows: [{ id: targetRoleId }] };
      }

      if (text.includes('FROM iam.roles r') && text.includes('r.role_key')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'custom_editor',
              role_name: 'custom_editor',
              display_name: 'custom_editor',
              external_role_name: 'custom_editor',
              description: 'Custom Editor',
              is_system_role: false,
              role_level: 25,
              managed_by: 'studio',
              member_count: 0,
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
              permission_rows: [],
            },
          ],
        };
      }

      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('SELECT pg_notify')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('UPDATE iam.idempotency_keys')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await createRoleHandler(
      new Request('http://localhost/api/v1/iam/roles', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'role-create-1',
        },
        body: JSON.stringify({
          roleName: 'custom_editor',
          description: 'Custom Editor',
          roleLevel: 25,
          permissionIds: [],
        }),
      })
    );

    const payload = (await response.json()) as {
      data: { id: string; roleKey: string; roleName: string; syncState: string; managedBy: string };
    };
    expect(response.status).toBe(201);
    expect(payload.data.id).toBe(targetRoleId);
    expect(payload.data.roleKey).toBe('custom_editor');
    expect(payload.data.roleName).toBe('custom_editor');
    expect(payload.data.managedBy).toBe('studio');
    expect(payload.data.syncState).toBe('synced');
  });

  it('maps Keycloak timeout on createRole to failed sync state', async () => {
    state.createRoleImpl = () => {
      throw new KeycloakAdminRequestError({
        message: 'timeout',
        statusCode: 504,
        code: 'read_timeout',
        retryable: true,
      });
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('INSERT INTO iam.idempotency_keys') && text.includes('ON CONFLICT')) {
        return { rowCount: 1, rows: [{ status: 'IN_PROGRESS' }] };
      }
      if (text.includes('UPDATE iam.idempotency_keys')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await createRoleHandler(
      new Request('http://localhost/api/v1/iam/roles', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'role-create-timeout',
        },
        body: JSON.stringify({
          roleName: 'custom_editor',
          description: 'Custom Editor',
          roleLevel: 25,
          permissionIds: [],
        }),
      })
    );

    const payload = (await response.json()) as { error: { code: string; details?: { syncError?: { code: string } } } };
    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('keycloak_unavailable');
    expect(payload.error.details?.syncError?.code).toBe('IDP_TIMEOUT');
  });

  it('returns a specific setup hint when Keycloak denies role writes', async () => {
    state.createRoleImpl = () => {
      throw new KeycloakAdminRequestError({
        message: 'forbidden',
        statusCode: 403,
        code: 'forbidden',
        retryable: false,
      });
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('INSERT INTO iam.idempotency_keys') && text.includes('ON CONFLICT')) {
        return { rowCount: 1, rows: [{ status: 'IN_PROGRESS' }] };
      }
      if (text.includes('UPDATE iam.idempotency_keys')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await createRoleHandler(
      new Request('http://localhost/api/v1/iam/roles', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'role-create-forbidden',
        },
        body: JSON.stringify({
          roleName: 'custom_editor',
          description: 'Custom Editor',
          roleLevel: 25,
          permissionIds: [],
        }),
      })
    );

    const payload = (await response.json()) as {
      error: { code: string; message: string; details?: { syncError?: { code: string } } };
    };
    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('keycloak_unavailable');
    expect(payload.error.message).toContain('manage-realm');
    expect(payload.error.details?.syncError?.code).toBe('IDP_FORBIDDEN');
  });

  it('updates a role successfully', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes('external_role_name')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'custom_editor',
              role_name: 'custom_editor',
              display_name: 'Custom Editor',
              external_role_name: 'custom_editor',
              description: 'Custom Editor',
              is_system_role: false,
              role_level: 25,
              managed_by: 'studio',
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
            },
          ],
        };
      }

      if (text.includes('UPDATE iam.roles') || text.includes('DELETE FROM iam.role_permissions') || text.includes('INSERT INTO iam.role_permissions')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('FROM iam.roles r') && text.includes('r.role_key')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'custom_editor',
              role_name: 'custom_editor',
              display_name: 'Custom Editor',
              external_role_name: 'custom_editor',
              description: 'Updated',
              is_system_role: false,
              role_level: 30,
              managed_by: 'studio',
              member_count: 0,
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
              permission_rows: [],
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await updateRoleHandler(
      new Request(`http://localhost/api/v1/iam/roles/${targetRoleId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          displayName: 'Custom Editor',
          description: 'Updated',
          roleLevel: 30,
          permissionIds: [],
        }),
      })
    );

    const payload = (await response.json()) as { data: { id: string; roleKey: string; syncState: string } };
    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(targetRoleId);
    expect(payload.data.roleKey).toBe('custom_editor');
    expect(payload.data.syncState).toBe('synced');
  });

  it('rejects updates for externally managed roles', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes('external_role_name')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'mainserver_editor',
              role_name: 'mainserver_editor',
              display_name: 'Editor',
              external_role_name: 'Editor',
              description: 'Mainserver-Rolle',
              is_system_role: false,
              role_level: 40,
              managed_by: 'external',
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await updateRoleHandler(
      new Request(`http://localhost/api/v1/iam/roles/${targetRoleId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          displayName: 'Editors',
        }),
      })
    );

    const payload = (await response.json()) as { error: { code: string; message: string } };
    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('conflict');
    expect(payload.error.message).toContain('Extern verwaltete Rollen');
  });

  it('marks role update as DB write failure after successful Keycloak sync', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes('external_role_name')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'custom_editor',
              role_name: 'custom_editor',
              display_name: 'Custom Editor',
              external_role_name: 'custom_editor',
              description: 'Custom Editor',
              is_system_role: false,
              role_level: 25,
              managed_by: 'studio',
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
            },
          ],
        };
      }

      if (text.includes('UPDATE iam.roles') && text.includes('display_name = $3')) {
        throw new Error('db_write_failed');
      }

      if (text.includes('UPDATE iam.roles') || text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await updateRoleHandler(
      new Request(`http://localhost/api/v1/iam/roles/${targetRoleId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          displayName: 'Custom Editor',
          description: 'Updated',
          roleLevel: 30,
          permissionIds: [],
        }),
      })
    );

    const payload = (await response.json()) as { error: { code: string; details?: { syncError?: { code: string } } } };
    expect(response.status).toBe(500);
    expect(payload.error.code).toBe('internal_error');
    expect(payload.error.details?.syncError?.code).toBe('DB_WRITE_FAILED');
  });

  it('rejects deleteRole when role has dependencies', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes('external_role_name')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'custom_editor',
              role_name: 'custom_editor',
              display_name: 'Custom Editor',
              external_role_name: 'custom_editor',
              description: 'Custom Editor',
              is_system_role: false,
              role_level: 25,
              managed_by: 'studio',
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
            },
          ],
        };
      }

      if (text.includes('FROM iam.account_roles')) {
        return { rowCount: 1, rows: [{ used: 2 }] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await deleteRoleHandler(
      new Request(`http://localhost/api/v1/iam/roles/${targetRoleId}`, {
        method: 'DELETE',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    const payload = (await response.json()) as { error: { code: string; message: string } };
    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('conflict');
    expect(payload.error.message).toContain('verwendet');
  });

  it('deletes a role successfully when no dependencies exist', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes('external_role_name')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'custom_editor',
              role_name: 'custom_editor',
              display_name: 'Custom Editor',
              external_role_name: 'custom_editor',
              description: 'Custom Editor',
              is_system_role: false,
              role_level: 25,
              managed_by: 'studio',
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
            },
          ],
        };
      }

      if (text.includes('FROM iam.account_roles')) {
        return { rowCount: 1, rows: [{ used: 0 }] };
      }

      if (text.includes('DELETE FROM iam.role_permissions') || text.includes('DELETE FROM iam.roles')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await deleteRoleHandler(
      new Request(`http://localhost/api/v1/iam/roles/${targetRoleId}`, {
        method: 'DELETE',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    const payload = (await response.json()) as { data: { id: string } };
    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(targetRoleId);
  });

  it('rejects deletes for externally managed roles', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes('external_role_name')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'mainserver_editor',
              role_name: 'mainserver_editor',
              display_name: 'Editor',
              external_role_name: 'Editor',
              description: 'Mainserver-Rolle',
              is_system_role: false,
              role_level: 40,
              managed_by: 'external',
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await deleteRoleHandler(
      new Request(`http://localhost/api/v1/iam/roles/${targetRoleId}`, {
        method: 'DELETE',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    const payload = (await response.json()) as { error: { code: string; message: string } };
    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('conflict');
    expect(payload.error.message).toContain('Extern verwaltete Rollen');
  });

  it('surfaces compensation failure when deleteRole cannot restore Keycloak state', async () => {
    state.createRoleImpl = () => {
      throw new Error('compensation_failed');
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes('external_role_name')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'custom_editor',
              role_name: 'custom_editor',
              display_name: 'Custom Editor',
              external_role_name: 'custom_editor',
              description: 'Custom Editor',
              is_system_role: false,
              role_level: 25,
              managed_by: 'studio',
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
            },
          ],
        };
      }

      if (text.includes('FROM iam.account_roles')) {
        return { rowCount: 1, rows: [{ used: 0 }] };
      }

      if (text.includes('DELETE FROM iam.role_permissions')) {
        throw new Error('db_delete_failed');
      }

      if (text.includes('UPDATE iam.roles') || text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await deleteRoleHandler(
      new Request(`http://localhost/api/v1/iam/roles/${targetRoleId}`, {
        method: 'DELETE',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    const payload = (await response.json()) as { error: { code: string; details?: { syncError?: { code: string } } } };
    expect(response.status).toBe(500);
    expect(payload.error.code).toBe('internal_error');
    expect(payload.error.details?.syncError?.code).toBe('COMPENSATION_FAILED');
  });

  it('reports orphaned studio-managed Keycloak roles during reconcile without deleting them', async () => {
    state.listRolesImpl = () => [
      {
        id: 'kc-custom_editor',
        externalName: 'custom_editor',
        description: 'Custom Editor',
        attributes: {
          managed_by: ['studio'],
          instance_id: ['11111111-1111-1111-8111-111111111111'],
          role_key: ['custom_editor'],
          display_name: ['Custom Editor'],
        },
      },
    ];
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('FROM iam.roles') && text.includes("managed_by = 'studio'")) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await reconcileHandler(
      new Request('http://localhost/api/v1/iam/admin/reconcile', {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    const payload = (await response.json()) as {
      data: {
        checkedCount: number;
        correctedCount: number;
        failedCount: number;
        requiresManualActionCount: number;
        roles: Array<{ action: string; status: string; errorCode?: string; externalRoleName: string }>;
      };
    };
    expect(response.status).toBe(200);
    expect(payload.data.checkedCount).toBe(0);
    expect(payload.data.correctedCount).toBe(0);
    expect(payload.data.failedCount).toBe(0);
    expect(payload.data.requiresManualActionCount).toBe(1);
    expect(payload.data.roles).toEqual([
      {
        action: 'report',
        status: 'requires_manual_action',
        errorCode: 'REQUIRES_MANUAL_ACTION',
        externalRoleName: 'custom_editor',
        roleKey: 'custom_editor',
      },
    ]);
  });

  it('recreates missing Keycloak roles during reconcile', async () => {
    state.listRolesImpl = () => [];
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('FROM iam.roles') && text.includes("managed_by = 'studio'")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'custom_editor',
              role_name: 'custom_editor',
              display_name: 'Custom Editor',
              external_role_name: 'custom_editor',
              description: 'Custom Editor',
              is_system_role: false,
              role_level: 25,
              managed_by: 'studio',
              sync_state: 'failed',
              last_synced_at: null,
              last_error_code: 'IDP_NOT_FOUND',
            },
          ],
        };
      }
      if (text.includes('UPDATE iam.roles') || text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await reconcileHandler(
      new Request('http://localhost/api/v1/iam/admin/reconcile', {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    const payload = (await response.json()) as {
      data: {
        correctedCount: number;
        failedCount: number;
        requiresManualActionCount: number;
        roles: Array<{ action: string; status: string; roleId?: string; roleKey?: string; externalRoleName: string }>;
      };
    };
    expect(response.status).toBe(200);
    expect(payload.data.correctedCount).toBe(1);
    expect(payload.data.failedCount).toBe(0);
    expect(payload.data.requiresManualActionCount).toBe(0);
    expect(payload.data.roles).toEqual([
      {
        action: 'create',
        status: 'corrected',
        roleId: targetRoleId,
        roleKey: 'custom_editor',
        externalRoleName: 'custom_editor',
      },
    ]);
  });

  it('updates stale Keycloak role metadata during reconcile', async () => {
    state.listRolesImpl = () => [
      {
        id: 'kc-custom_editor',
        externalName: 'custom_editor',
        description: 'Old description',
        attributes: {
          managed_by: ['studio'],
          instance_id: ['11111111-1111-1111-8111-111111111111'],
          role_key: ['custom_editor'],
          display_name: ['Old Name'],
        },
      },
    ];
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('FROM iam.roles') && text.includes("managed_by = 'studio'")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'custom_editor',
              role_name: 'custom_editor',
              display_name: 'Custom Editor',
              external_role_name: 'custom_editor',
              description: 'Current description',
              is_system_role: false,
              role_level: 25,
              managed_by: 'studio',
              sync_state: 'failed',
              last_synced_at: null,
              last_error_code: 'IDP_TIMEOUT',
            },
          ],
        };
      }
      if (text.includes('UPDATE iam.roles') || text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await reconcileHandler(
      new Request('http://localhost/api/v1/iam/admin/reconcile', {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    const payload = (await response.json()) as {
      data: {
        correctedCount: number;
        roles: Array<{ action: string; status: string; roleId?: string; roleKey?: string; externalRoleName: string }>;
      };
    };
    expect(response.status).toBe(200);
    expect(payload.data.correctedCount).toBe(1);
    expect(payload.data.roles).toEqual([
      {
        action: 'update',
        status: 'corrected',
        roleId: targetRoleId,
        roleKey: 'custom_editor',
        externalRoleName: 'custom_editor',
      },
    ]);
  });

  it('rejects reconcile requests without CSRF headers', async () => {
    const response = await reconcileHandler(
      new Request('http://localhost/api/v1/iam/admin/reconcile', {
        method: 'POST',
      })
    );

    const payload = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('csrf_validation_failed');
  });

  it('creates a user successfully on happy path', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('INSERT INTO iam.idempotency_keys') && text.includes('ON CONFLICT')) {
        return { rowCount: 1, rows: [{ status: 'IN_PROGRESS' }] };
      }

      if (text.includes('INSERT INTO iam.accounts')) {
        return { rowCount: 1, rows: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }] };
      }

      if (text.includes('INSERT INTO iam.instance_memberships')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('DELETE FROM iam.account_roles')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('INSERT INTO iam.activity_log')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('SELECT pg_notify')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('UPDATE iam.idempotency_keys')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await createUserHandler(
      new Request('http://localhost/api/v1/iam/users', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'user-create-1',
        },
        body: JSON.stringify({
          email: 'new.user@example.com',
          firstName: 'New',
          lastName: 'User',
          roleIds: [],
        }),
      })
    );

    const payload = (await response.json()) as { data: { email: string; keycloakSubject: string } };
    expect(response.status).toBe(201);
    expect(payload.data.email).toBe('new.user@example.com');
    expect(payload.data.keycloakSubject).toBe('mock-user-id');
  });

  it('syncs external role names when creating a user', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('SELECT id, role_key, role_name, display_name, external_role_name')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'mainserver_admin',
              role_name: 'mainserver_admin',
              display_name: 'Admin',
              external_role_name: 'Admin',
              role_level: 90,
              is_system_role: false,
            },
          ],
        };
      }

      if (text.includes('INSERT INTO iam.idempotency_keys') && text.includes('ON CONFLICT')) {
        return { rowCount: 1, rows: [{ status: 'IN_PROGRESS' }] };
      }

      if (text.includes('INSERT INTO iam.accounts')) {
        return { rowCount: 1, rows: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }] };
      }

      if (text.includes('INSERT INTO iam.instance_memberships')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('SELECT pg_notify') || text.includes('UPDATE iam.idempotency_keys')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await createUserHandler(
      new Request('http://localhost/api/v1/iam/users', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'user-create-external-role',
        },
        body: JSON.stringify({
          email: 'external.role@example.com',
          firstName: 'External',
          lastName: 'Role',
          roleIds: [targetRoleId],
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(state.syncRolesCalls).toEqual([
      {
        keycloakSubject: 'mock-user-id',
        roleNames: ['Admin'],
      },
    ]);
  });

  it('returns idempotent replay response for createUser', async () => {
    let payloadHash = '';

    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('INSERT INTO iam.idempotency_keys') && text.includes('ON CONFLICT')) {
        payloadHash = String(values?.[4] ?? '');
        return { rowCount: 0, rows: [] };
      }

      if (text.includes('SELECT status, payload_hash, response_status, response_body')) {
        return {
          rowCount: 1,
          rows: [
            {
              status: 'COMPLETED',
              payload_hash: payloadHash,
              response_status: 201,
              response_body: {
                data: {
                  id: 'replayed-user',
                  email: 'new.user@example.com',
                },
              },
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await createUserHandler(
      new Request('http://localhost/api/v1/iam/users', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'user-create-replay',
        },
        body: JSON.stringify({
          email: 'new.user@example.com',
          firstName: 'Replay',
          lastName: 'User',
          roleIds: [],
        }),
      })
    );

    const payload = (await response.json()) as { data: { id: string; email: string } };
    expect(response.status).toBe(201);
    expect(payload.data.id).toBe('replayed-user');
    expect(payload.data.email).toBe('new.user@example.com');
  });

  it('syncs external role names when updating a user', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('SELECT id, role_key, role_name, display_name, external_role_name')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'mainserver_admin',
              role_name: 'mainserver_admin',
              display_name: 'Admin',
              external_role_name: 'Admin',
              role_level: 90,
              is_system_role: false,
            },
          ],
        };
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
          roleIds: [targetRoleId],
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(state.syncRolesCalls).toEqual([
      {
        keycloakSubject: 'keycloak-target-2',
        roleNames: ['Admin'],
      },
    ]);
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
