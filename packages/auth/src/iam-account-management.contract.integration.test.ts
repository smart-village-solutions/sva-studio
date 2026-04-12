import { beforeEach, describe, expect, it, vi } from 'vitest';

type SessionUser = {
  id: string;
  name: string;
  roles: string[];
  instanceId: string;
};

type RoleAssignment = {
  roleId: string;
  roleKey: string;
  roleName: string;
  roleLevel: number;
};

type UserRecord = {
  id: string;
  keycloakSubject: string;
  displayName: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string | null;
  department: string | null;
  status: 'active' | 'inactive' | 'pending';
  roleIds: string[];
};

type RoleRecord = {
  id: string;
  roleKey: string;
  roleName: string;
  displayName: string;
  externalRoleName: string;
  roleLevel: number;
  isSystemRole: boolean;
  managedBy: 'studio' | 'external';
  description: string | null;
};

const INSTANCE_ID = 'de-musterhausen';
const FOREIGN_INSTANCE_ID = '22222222-2222-2222-8222-222222222222';
const ACTOR_SUBJECT = 'keycloak-sub-admin';
const ACTOR_ACCOUNT_ID = 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa';
const TARGET_USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TARGET_SUBJECT = 'keycloak-sub-target';
const ROLE_SYSTEM_ADMIN_ID = '00000000-0000-4000-8000-000000000100';
const ROLE_APP_MANAGER_ID = '00000000-0000-4000-8000-000000000080';
const ROLE_EDITOR_ID = '00000000-0000-4000-8000-000000000040';

const buildRoleCatalog = (): Map<string, RoleRecord> =>
  new Map<string, RoleRecord>([
    [
      ROLE_SYSTEM_ADMIN_ID,
      {
        id: ROLE_SYSTEM_ADMIN_ID,
        roleKey: 'system_admin',
        roleName: 'system_admin',
        displayName: 'System Admin',
        externalRoleName: 'system_admin',
        roleLevel: 100,
        isSystemRole: true,
        managedBy: 'studio',
        description: 'Global administrator',
      },
    ],
    [
      ROLE_APP_MANAGER_ID,
      {
        id: ROLE_APP_MANAGER_ID,
        roleKey: 'app_manager',
        roleName: 'app_manager',
        displayName: 'App',
        externalRoleName: 'app_manager',
        roleLevel: 80,
        isSystemRole: false,
        managedBy: 'studio',
        description: 'App manager',
      },
    ],
    [
      ROLE_EDITOR_ID,
      {
        id: ROLE_EDITOR_ID,
        roleKey: 'editor',
        roleName: 'editor',
        displayName: 'Editor',
        externalRoleName: 'editor',
        roleLevel: 40,
        isSystemRole: false,
        managedBy: 'studio',
        description: 'Editor',
      },
    ],
  ]);

const buildTargetUser = (): UserRecord => ({
  id: TARGET_USER_ID,
  keycloakSubject: TARGET_SUBJECT,
  displayName: 'Target User',
  email: 'target@example.test',
  firstName: 'Target',
  lastName: 'User',
  position: 'Editor',
  department: 'Content',
  status: 'active',
  roleIds: [ROLE_EDITOR_ID],
});

const contractState = vi.hoisted(() => {
  const instanceId = 'de-musterhausen';
  const actorSubject = 'keycloak-sub-admin';
  const actorAccountId = 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa';
  const targetUserId = 'bbbbbbbb-bbbb-bbbb-8bbb-bbbbbbbbbbbb';
  const targetSubject = 'keycloak-sub-target';
  const roleSystemAdminId = '00000000-0000-4000-8000-000000000100';
  const roleAppManagerId = '00000000-0000-4000-8000-000000000080';
  const roleEditorId = '00000000-0000-4000-8000-000000000040';

  return {
    user: {
      id: actorSubject,
      name: 'Integration Admin',
      roles: ['system_admin'],
      instanceId,
    } satisfies SessionUser,
    actorAccountId,
    targetUser: {
      id: targetUserId,
      keycloakSubject: targetSubject,
      displayName: 'Target User',
      email: 'target@example.test',
      firstName: 'Target',
      lastName: 'User',
      position: 'Editor',
      department: 'Content',
      status: 'active',
      roleIds: [roleEditorId],
    } satisfies UserRecord,
    roleCatalog: new Map<string, RoleRecord>([
      [
        roleSystemAdminId,
        {
          id: roleSystemAdminId,
          roleKey: 'system_admin',
          roleName: 'system_admin',
          displayName: 'System Admin',
          externalRoleName: 'system_admin',
          roleLevel: 100,
          isSystemRole: true,
          managedBy: 'studio',
          description: 'Global administrator',
        },
      ],
      [
        roleAppManagerId,
        {
          id: roleAppManagerId,
          roleKey: 'app_manager',
          roleName: 'app_manager',
          displayName: 'App',
          externalRoleName: 'app_manager',
          roleLevel: 80,
          isSystemRole: false,
          managedBy: 'studio',
          description: 'App manager',
        },
      ],
      [
        roleEditorId,
        {
          id: roleEditorId,
          roleKey: 'editor',
          roleName: 'editor',
          displayName: 'Editor',
          externalRoleName: 'editor',
          roleLevel: 40,
          isSystemRole: false,
          managedBy: 'studio',
          description: 'Editor',
        },
      ],
    ]),
    syncedRoleNamesBySubject: new Map<string, string[]>([[targetSubject, ['editor']]]),
    lastSyncedRoles: [] as string[],
    lastUpdatedUserPayload: null as null | {
      email?: string;
      firstName?: string;
      lastName?: string;
      enabled?: boolean;
      attributes?: Readonly<Record<string, string | readonly string[]>>;
    },
    instanceById: new Map([
      [
        instanceId,
        {
          id: instanceId,
          authRealm: instanceId,
          authClientId: 'sva-studio',
          tenantAdminClient: {
            clientId: 'sva-studio-admin',
            secretConfigured: true,
          },
        },
      ],
    ]),
    tenantSecret: 'tenant-secret',
  };
});

const resetContractState = (): void => {
  contractState.user = {
    id: ACTOR_SUBJECT,
    name: 'Integration Admin',
    roles: ['system_admin'],
    instanceId: INSTANCE_ID,
  };
  contractState.actorAccountId = ACTOR_ACCOUNT_ID;
  contractState.targetUser = buildTargetUser();
  contractState.roleCatalog = buildRoleCatalog();
  contractState.syncedRoleNamesBySubject = new Map<string, string[]>([[TARGET_SUBJECT, ['editor']]]);
  contractState.lastSyncedRoles = [];
  contractState.lastUpdatedUserPayload = null;
};

const mapUserRoles = (roleIds: readonly string[]): RoleAssignment[] =>
  roleIds
    .map((roleId) => contractState.roleCatalog.get(roleId))
    .filter((role): role is RoleRecord => role !== undefined)
    .map((role) => ({
      roleId: role.id,
      roleKey: role.roleKey,
      roleName: role.displayName,
      roleLevel: role.roleLevel,
    }));

const toUserListRow = (user: UserRecord) => ({
  id: user.id,
  keycloak_subject: user.keycloakSubject,
  display_name_ciphertext: user.displayName,
  first_name_ciphertext: user.firstName,
  last_name_ciphertext: user.lastName,
  email_ciphertext: user.email,
  position: user.position,
  department: user.department,
  status: user.status,
  last_login_at: '2026-03-10T07:00:00.000Z',
  role_rows: mapUserRoles(user.roleIds).map((role) => ({
    id: role.roleId,
    role_key: role.roleKey,
    role_name: role.roleKey,
    display_name: role.roleName,
    role_level: role.roleLevel,
    is_system_role: role.roleKey === 'system_admin',
  })),
});

const toUserDetailRow = (user: UserRecord) => ({
  ...toUserListRow(user),
  username_ciphertext: user.email,
  phone_ciphertext: null,
  preferred_language: 'de',
  timezone: 'Europe/Berlin',
  avatar_url: null,
  notes: null,
  permission_rows: [],
});

const toRoleListRow = (role: RoleRecord) => ({
  id: role.id,
  role_key: role.roleKey,
  role_name: role.roleName,
  display_name: role.displayName,
  external_role_name: role.externalRoleName,
  managed_by: role.managedBy,
  description: role.description,
  is_system_role: role.isSystemRole,
  role_level: role.roleLevel,
  member_count: contractState.targetUser.roleIds.includes(role.id) ? 1 : 0,
  sync_state: 'synced',
  last_synced_at: '2026-03-10T07:00:00.000Z',
  last_error_code: null,
  permission_rows: [],
});

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-contract-integration',
      user: contractState.user,
    })
  ),
}));

vi.mock('@sva/data/server', () => ({
  loadInstanceById: vi.fn(async (instanceId: string) => contractState.instanceById.get(instanceId) ?? null),
}));

vi.mock('./config-tenant-secret.js', () => ({
  resolveTenantAuthClientSecret: vi.fn(async () => ({
    configured: true,
    readable: true,
    secret: contractState.tenantSecret,
    source: 'tenant',
  })),
  resolveTenantAdminClientSecret: vi.fn(async () => ({
    configured: true,
    readable: true,
    secret: contractState.tenantSecret,
    source: 'tenant',
  })),
}));

vi.mock('@sva/sdk/server', async () => {
  const actual = await vi.importActual<typeof import('@sva/sdk/server')>('@sva/sdk/server');
  return {
    ...actual,
    createSdkLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      isLevelEnabled: vi.fn(() => false),
    }),
    getWorkspaceContext: () => ({
      workspaceId: contractState.user.instanceId,
      requestId: 'req-iam-contract',
      traceId: 'trace-iam-contract',
    }),
    withRequestContext: async (_options: unknown, handler: () => Promise<Response> | Response) => handler(),
  };
});

vi.mock('./keycloak-admin-client', () => {
  class MockKeycloakAdminClient {
    async listUserRoleNames(keycloakSubject: string): Promise<readonly string[]> {
      return contractState.syncedRoleNamesBySubject.get(keycloakSubject) ?? [];
    }

    async updateUser(
      _keycloakSubject: string,
      payload: {
        email?: string;
        firstName?: string;
        lastName?: string;
        enabled?: boolean;
        attributes?: Readonly<Record<string, string | readonly string[]>>;
      }
    ): Promise<void> {
      contractState.lastUpdatedUserPayload = payload;
    }

    async getUserAttributes(): Promise<Readonly<Record<string, readonly string[]>>> {
      return {};
    }

    async syncRoles(keycloakSubject: string, roleNames: string[]): Promise<void> {
      contractState.lastSyncedRoles = [...roleNames];
      contractState.syncedRoleNamesBySubject.set(keycloakSubject, [...roleNames]);
    }

    async deactivateUser(): Promise<void> {
      return undefined;
    }

    getCircuitBreakerState(): number {
      return 0;
    }
  }

  class KeycloakAdminRequestError extends Error {}
  class KeycloakAdminUnavailableError extends Error {}

  return {
    KeycloakAdminClient: MockKeycloakAdminClient,
    KeycloakAdminRequestError,
    KeycloakAdminUnavailableError,
    getKeycloakAdminClientConfigFromEnv: () => ({
      baseUrl: 'http://localhost:8080',
      realm: 'sva',
      clientId: 'admin-cli',
      clientSecret: 'secret',
    }),
  };
});

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
          if (text.includes("to_regclass('iam.account_permissions')")) {
            return {
              rowCount: 1,
              rows: [
                {
                  account_permissions_exists: true,
                  permissions_action_exists: true,
                  permissions_resource_type_exists: true,
                  permissions_resource_id_exists: true,
                  permissions_effect_exists: true,
                  permissions_scope_exists: true,
                },
              ],
            };
          }

          if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
            const instanceId = String(values?.[0]);
            const subject = String(values?.[1]);
            if (instanceId === INSTANCE_ID && subject === ACTOR_SUBJECT) {
              return { rowCount: 1, rows: [{ account_id: contractState.actorAccountId }] };
            }
            return { rowCount: 0, rows: [] };
          }

          if (text.includes('SELECT COALESCE(MAX(r.role_level), 0)::int AS max_role_level')) {
            return { rowCount: 1, rows: [{ max_role_level: 0 }] };
          }

          if (text.includes('COUNT(DISTINCT a.id)::int AS total')) {
            return { rowCount: 1, rows: [{ total: 1 }] };
          }

          if (text.includes('ORDER BY a.created_at DESC')) {
            return { rowCount: 1, rows: [toUserListRow(contractState.targetUser)] };
          }

          if (text.includes('permission_rows') && text.includes('FROM iam.accounts a')) {
            const userId = String(values?.[1]);
            if (userId !== contractState.targetUser.id) {
              return { rowCount: 0, rows: [] };
            }
            return { rowCount: 1, rows: [toUserDetailRow(contractState.targetUser)] };
          }

          if (
            text.includes('SELECT id, role_key, role_name, display_name, external_role_name, role_level, is_system_role') &&
            text.includes('id = ANY($2::uuid[])')
          ) {
            const roleIds = (values?.[1] as readonly string[]) ?? [];
            const rows = roleIds
              .map((roleId) => contractState.roleCatalog.get(roleId))
              .filter((role): role is RoleRecord => role !== undefined)
              .map((role) => ({
                id: role.id,
                role_key: role.roleKey,
                role_name: role.roleName,
                display_name: role.displayName,
                external_role_name: role.externalRoleName,
                role_level: role.roleLevel,
                is_system_role: role.isSystemRole,
              }));
            return { rowCount: rows.length, rows };
          }

          if (
            text.includes('SELECT id, role_key, role_name, display_name, external_role_name, role_level, is_system_role') &&
            text.includes('COALESCE(external_role_name, role_key) = ANY($2::text[])')
          ) {
            const externalRoleNames = new Set(((values?.[1] as readonly string[]) ?? []).map(String));
            const rows = [...contractState.roleCatalog.values()]
              .filter((role) => externalRoleNames.has(role.externalRoleName))
              .map((role) => ({
                id: role.id,
                role_key: role.roleKey,
                role_name: role.roleName,
                display_name: role.displayName,
                external_role_name: role.externalRoleName,
                role_level: role.roleLevel,
                is_system_role: role.isSystemRole,
              }));
            return { rowCount: rows.length, rows };
          }

          if (text.includes('DELETE FROM iam.account_roles WHERE instance_id = $1::uuid AND account_id = $2::uuid;')) {
            const accountId = String(values?.[1]);
            if (accountId === contractState.targetUser.id) {
              contractState.targetUser.roleIds = [];
            }
            return { rowCount: 1, rows: [] };
          }

          if (text.includes('INSERT INTO iam.account_roles (')) {
            const accountId = String(values?.[1]);
            const roleIds = ((values?.[3] as readonly string[]) ?? []).map(String);
            if (accountId === contractState.targetUser.id) {
              contractState.targetUser.roleIds = [...roleIds];
            }
            return { rowCount: roleIds.length, rows: [] };
          }

          if (text.includes('UPDATE iam.accounts') && text.includes('email_ciphertext = COALESCE($3, email_ciphertext)')) {
            const userId = String(values?.[0]);
            if (userId === contractState.targetUser.id) {
              contractState.targetUser.email = (values?.[2] as string | null) ?? contractState.targetUser.email;
              contractState.targetUser.firstName =
                (values?.[4] as string | null) ?? contractState.targetUser.firstName;
              contractState.targetUser.lastName =
                (values?.[5] as string | null) ?? contractState.targetUser.lastName;
              contractState.targetUser.status =
                ((values?.[12] as UserRecord['status'] | null) ?? contractState.targetUser.status);
            }
            return { rowCount: 1, rows: [] };
          }

          if (text.includes('INSERT INTO iam.activity_logs')) {
            return { rowCount: 1, rows: [] };
          }

          if (text.includes("SELECT pg_notify($1, $2);")) {
            return { rowCount: 1, rows: [] };
          }

          if (text.includes('FROM iam.roles r') && text.includes('COUNT(DISTINCT ar.account_id)::int AS member_count')) {
            const rows = [...contractState.roleCatalog.values()]
              .sort((left, right) => right.roleLevel - left.roleLevel)
              .map(toRoleListRow);
            return { rowCount: rows.length, rows };
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
  getUserHandler,
  listRolesHandler,
  listUsersHandler,
  updateUserHandler,
} from './iam-account-management.server';

describe('iam-account-management stable contract integration', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    process.env.KEYCLOAK_BASE_URL = 'http://localhost:8080';
    process.env.KEYCLOAK_ADMIN_BASE_URL = 'http://localhost:8080';
    process.env.KEYCLOAK_REALM = 'sva';
    process.env.KEYCLOAK_CLIENT_ID = 'admin-cli';
    process.env.KEYCLOAK_CLIENT_SECRET = 'secret';
    process.env.NODE_ENV = 'test';
    resetContractState();
  });

  it('returns stable IAM-v1 list envelope for list users', async () => {
    const response = await listUsersHandler(
      new Request(`http://localhost/api/v1/iam/users?instanceId=${INSTANCE_ID}&page=1&pageSize=25`, {
        method: 'GET',
      })
    );

    const payload = (await response.json()) as {
      requestId: string;
      data: Array<{ id: string }>;
      pagination: { page: number; pageSize: number; total: number };
    };

    expect(response.status).toBe(200);
    expect(payload.requestId).toBe('req-iam-contract');
    expect(payload.pagination).toEqual({ page: 1, pageSize: 25, total: 1 });
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.id).toBe(TARGET_USER_ID);
  });

  it('returns stable IAM-v1 error envelope for get user in foreign tenant', async () => {
    const response = await getUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${TARGET_USER_ID}?instanceId=${FOREIGN_INSTANCE_ID}`, {
        method: 'GET',
      })
    );

    const payload = (await response.json()) as {
      requestId: string;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(403);
    expect(payload.requestId).toBe('req-iam-contract');
    expect(payload.error).toEqual(
      expect.objectContaining({
        code: 'forbidden',
        message: 'Akteur-Account nicht gefunden.',
      })
    );
  });

  it('returns stable IAM-v1 list envelope for list roles', async () => {
    const response = await listRolesHandler(
      new Request(`http://localhost/api/v1/iam/roles?instanceId=${INSTANCE_ID}`, {
        method: 'GET',
      })
    );

    const payload = (await response.json()) as {
      requestId: string;
      data: Array<{ roleKey: string }>;
      pagination: { page: number; pageSize: number; total: number };
    };

    expect(response.status).toBe(200);
    expect(payload.requestId).toBe('req-iam-contract');
    expect(payload.pagination.total).toBe(3);
    expect(payload.data.map((entry) => entry.roleKey)).toEqual(['system_admin', 'app_manager', 'editor']);
  });

  it('allows session system_admin to update user roles without persisted actor roles', async () => {
    const response = await updateUserHandler(
      new Request(`http://localhost:3000/api/v1/iam/users/${TARGET_USER_ID}?instanceId=${INSTANCE_ID}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost:3000',
          'x-forwarded-host': 'localhost:3000',
          'x-forwarded-proto': 'http',
        },
        body: JSON.stringify({
          roleIds: [ROLE_APP_MANAGER_ID],
        }),
      })
    );

    const payload = (await response.json()) as {
      requestId: string;
      data: { id: string; roles: Array<{ roleKey: string }> };
    };

    expect(response.status).toBe(200);
    expect(payload.requestId).toBe('req-iam-contract');
    expect(payload.data.id).toBe(TARGET_USER_ID);
    expect(payload.data.roles.map((role) => role.roleKey)).toEqual(['app_manager']);
    expect(contractState.lastSyncedRoles).toEqual(['app_manager']);
  });
});
