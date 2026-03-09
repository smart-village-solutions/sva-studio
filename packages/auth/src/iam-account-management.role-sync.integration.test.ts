import { beforeEach, describe, expect, it, vi } from 'vitest';

type RoleRowState = {
  id: string;
  instanceId: string;
  roleKey: string;
  roleName: string;
  displayName: string;
  externalRoleName: string;
  description: string | null;
  isSystemRole: boolean;
  roleLevel: number;
  managedBy: 'studio' | 'external';
  syncState: 'synced' | 'pending' | 'failed';
  lastSyncedAt: string | null;
  lastErrorCode: string | null;
};

type IdentityRoleState = {
  id: string;
  externalName: string;
  description?: string;
  attributes: Record<string, string>;
};

type ActivityLogState = {
  eventType: string;
  result: 'success' | 'failure';
  payload: Record<string, unknown>;
};

const buildRoleId = (index: number): string => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

const roleSyncIntegrationState = vi.hoisted(() => ({
  user: {
    id: 'keycloak-role-admin',
    name: 'Integration Admin',
    roles: ['system_admin'],
    instanceId: '11111111-1111-1111-8111-111111111111',
  },
  actorAccountId: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa',
  roles: new Map<string, RoleRowState>(),
  activityLogs: [] as ActivityLogState[],
  idpRoles: new Map<string, IdentityRoleState>(),
  nextRoleIndex: 1,
  failNextRoleInsert: false,
  failNextRoleUpdateWrite: false,
  failNextRoleDeleteWrite: false,
}));

const resetRoleState = (): void => {
  roleSyncIntegrationState.roles.clear();
  roleSyncIntegrationState.activityLogs = [];
  roleSyncIntegrationState.idpRoles.clear();
  roleSyncIntegrationState.nextRoleIndex = 1;
  roleSyncIntegrationState.failNextRoleInsert = false;
  roleSyncIntegrationState.failNextRoleUpdateWrite = false;
  roleSyncIntegrationState.failNextRoleDeleteWrite = false;
};

const seedManagedRole = (overrides?: Partial<RoleRowState>): RoleRowState => {
  const role: RoleRowState = {
    id: buildRoleId(roleSyncIntegrationState.nextRoleIndex++),
    instanceId: roleSyncIntegrationState.user.instanceId,
    roleKey: 'custom_editor',
    roleName: 'custom_editor',
    displayName: 'Custom Editor',
    externalRoleName: 'custom_editor',
    description: 'Custom Editor',
    isSystemRole: false,
    roleLevel: 25,
    managedBy: 'studio',
    syncState: 'synced',
    lastSyncedAt: new Date().toISOString(),
    lastErrorCode: null,
    ...overrides,
  };
  roleSyncIntegrationState.roles.set(role.id, role);
  roleSyncIntegrationState.idpRoles.set(role.externalRoleName, {
    id: `kc-${role.externalRoleName}`,
    externalName: role.externalRoleName,
    description: role.description ?? undefined,
    attributes: {
      managed_by: role.managedBy,
      instance_id: role.instanceId,
      role_key: role.roleKey,
      display_name: role.displayName,
    },
  });
  return role;
};

const toPermissionRows = (): Array<{ id: string; permission_key: string; description: string | null }> => [];

const toRoleListRow = (role: RoleRowState) => ({
  id: role.id,
  role_key: role.roleKey,
  role_name: role.roleName,
  display_name: role.displayName,
  external_role_name: role.externalRoleName,
  description: role.description,
  is_system_role: role.isSystemRole,
  role_level: role.roleLevel,
  member_count: 0,
  sync_state: role.syncState,
  last_synced_at: role.lastSyncedAt,
  last_error_code: role.lastErrorCode,
  permission_rows: toPermissionRows(),
});

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-role-sync-integration',
      user: roleSyncIntegrationState.user,
    })
  ),
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
    }),
    getWorkspaceContext: () => ({
      workspaceId: roleSyncIntegrationState.user.instanceId,
      requestId: 'req-role-sync-integration',
      traceId: 'trace-role-sync-integration',
    }),
    withRequestContext: async (_options: unknown, handler: () => Promise<Response> | Response) => handler(),
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
          if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
            return {
              rowCount: 1,
              rows: [{ account_id: roleSyncIntegrationState.actorAccountId }],
            };
          }

          if (text.includes('DELETE FROM iam.idempotency_keys WHERE expires_at < NOW()')) {
            return { rowCount: 0, rows: [] };
          }

          if (text.includes('INSERT INTO iam.idempotency_keys')) {
            return { rowCount: 1, rows: [{ status: 'IN_PROGRESS' }] };
          }

          if (text.includes('UPDATE iam.idempotency_keys')) {
            return { rowCount: 1, rows: [] };
          }

          if (text.includes('INSERT INTO iam.roles') && text.includes('RETURNING id')) {
            if (roleSyncIntegrationState.failNextRoleInsert) {
              roleSyncIntegrationState.failNextRoleInsert = false;
              throw new Error('db_insert_failed');
            }
            const role: RoleRowState = {
              id: buildRoleId(roleSyncIntegrationState.nextRoleIndex++),
              instanceId: String(values?.[0]),
              roleKey: String(values?.[1]),
              roleName: String(values?.[2]),
              displayName: String(values?.[3]),
              externalRoleName: String(values?.[4]),
              description: (values?.[5] as string | null) ?? null,
              isSystemRole: false,
              roleLevel: Number(values?.[6]),
              managedBy: 'studio',
              syncState: 'synced',
              lastSyncedAt: new Date().toISOString(),
              lastErrorCode: null,
            };
            roleSyncIntegrationState.roles.set(role.id, role);
            return { rowCount: 1, rows: [{ id: role.id }] };
          }

          if (text.includes('FROM iam.roles r') && text.includes('r.role_key')) {
            return {
              rowCount: roleSyncIntegrationState.roles.size,
              rows: Array.from(roleSyncIntegrationState.roles.values()).map(toRoleListRow),
            };
          }

          if (text.includes('FROM iam.roles') && text.includes('external_role_name')) {
            const roleId = String(values?.[1]);
            const role = roleSyncIntegrationState.roles.get(roleId);
            return role
              ? {
                  rowCount: 1,
                  rows: [
                    {
                      id: role.id,
                      role_key: role.roleKey,
                      role_name: role.roleName,
                      display_name: role.displayName,
                      external_role_name: role.externalRoleName,
                      description: role.description,
                      is_system_role: role.isSystemRole,
                      role_level: role.roleLevel,
                      managed_by: role.managedBy,
                      sync_state: role.syncState,
                      last_synced_at: role.lastSyncedAt,
                      last_error_code: role.lastErrorCode,
                    },
                  ],
                }
              : { rowCount: 0, rows: [] };
          }

          if (text.includes('UPDATE iam.roles') && text.includes('last_error_code = $4')) {
            const role = roleSyncIntegrationState.roles.get(String(values?.[1]));
            if (role) {
              role.syncState = String(values?.[2]) as RoleRowState['syncState'];
              role.lastErrorCode = (values?.[3] as string | null) ?? null;
              if (values?.[4]) {
                role.lastSyncedAt = new Date().toISOString();
              }
            }
            return { rowCount: role ? 1 : 0, rows: [] };
          }

          if (text.includes('UPDATE iam.roles') && text.includes('display_name = $3')) {
            const role = roleSyncIntegrationState.roles.get(String(values?.[1]));
            if (!role) {
              return { rowCount: 0, rows: [] };
            }
            if (roleSyncIntegrationState.failNextRoleUpdateWrite) {
              roleSyncIntegrationState.failNextRoleUpdateWrite = false;
              throw new Error('db_update_failed');
            }
            role.displayName = String(values?.[2]);
            role.description = (values?.[3] as string | null) ?? null;
            role.roleLevel = Number(values?.[4]);
            role.syncState = 'synced';
            role.lastErrorCode = null;
            role.lastSyncedAt = new Date().toISOString();
            return { rowCount: 1, rows: [] };
          }

          if (text.includes('DELETE FROM iam.role_permissions')) {
            if (roleSyncIntegrationState.failNextRoleDeleteWrite) {
              roleSyncIntegrationState.failNextRoleDeleteWrite = false;
              throw new Error('db_delete_failed');
            }
            return { rowCount: 1, rows: [] };
          }

          if (text.includes('INSERT INTO iam.role_permissions')) {
            return { rowCount: 0, rows: [] };
          }

          if (text.includes('FROM iam.account_roles') && text.includes('COUNT(*)::int AS used')) {
            return { rowCount: 1, rows: [{ used: 0 }] };
          }

          if (text.includes('DELETE FROM iam.roles WHERE instance_id = $1::uuid AND id = $2::uuid')) {
            roleSyncIntegrationState.roles.delete(String(values?.[1]));
            return { rowCount: 1, rows: [] };
          }

          if (text.includes('INSERT INTO iam.activity_logs')) {
            const eventType = String(values?.[3]);
            const subjectId = (values?.[2] as string | null | undefined) ?? null;
            if (eventType.startsWith('role.') && subjectId) {
              throw new Error('role_audit_subject_id_must_be_null');
            }
            roleSyncIntegrationState.activityLogs.push({
              eventType,
              result: String(values?.[4]) as 'success' | 'failure',
              payload: JSON.parse(String(values?.[5] ?? '{}')) as Record<string, unknown>,
            });
            return { rowCount: 1, rows: [] };
          }

          if (text.includes('SELECT pg_notify')) {
            return { rowCount: 1, rows: [] };
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

    async syncRoles() {
      return undefined;
    }

    async listUserRoleNames(externalId: string) {
      void externalId;
      return [];
    }

    async createRole(input: { externalName: string; description?: string; attributes: Record<string, string> }) {
      roleSyncIntegrationState.idpRoles.set(input.externalName, {
        id: `kc-${input.externalName}`,
        externalName: input.externalName,
        description: input.description,
        attributes: {
          managed_by: input.attributes.managedBy,
          instance_id: input.attributes.instanceId,
          role_key: input.attributes.roleKey,
          display_name: input.attributes.displayName,
        },
      });
      return {
        id: `kc-${input.externalName}`,
        externalName: input.externalName,
        description: input.description,
        attributes: {
          managed_by: [input.attributes.managedBy],
          instance_id: [input.attributes.instanceId],
          role_key: [input.attributes.roleKey],
          display_name: [input.attributes.displayName],
        },
      };
    }

    async updateRole(externalName: string, input: { description?: string; attributes: Record<string, string> }) {
      roleSyncIntegrationState.idpRoles.set(externalName, {
        id: `kc-${externalName}`,
        externalName,
        description: input.description,
        attributes: {
          managed_by: input.attributes.managedBy,
          instance_id: input.attributes.instanceId,
          role_key: input.attributes.roleKey,
          display_name: input.attributes.displayName,
        },
      });
      return {
        id: `kc-${externalName}`,
        externalName,
        description: input.description,
        attributes: {
          managed_by: [input.attributes.managedBy],
          instance_id: [input.attributes.instanceId],
          role_key: [input.attributes.roleKey],
          display_name: [input.attributes.displayName],
        },
      };
    }

    async deleteRole(externalName: string) {
      roleSyncIntegrationState.idpRoles.delete(externalName);
      return undefined;
    }

    async getRoleByName(externalName: string) {
      const role = roleSyncIntegrationState.idpRoles.get(externalName);
      return role
        ? {
            id: role.id,
            externalName: role.externalName,
            description: role.description,
            attributes: {
              managed_by: [role.attributes.managed_by],
              instance_id: [role.attributes.instance_id],
              role_key: [role.attributes.role_key],
              display_name: [role.attributes.display_name],
            },
          }
        : undefined;
    }

    async listRoles() {
      return Array.from(roleSyncIntegrationState.idpRoles.values()).map((role) => ({
        id: role.id,
        externalName: role.externalName,
        description: role.description,
        attributes: {
          managed_by: [role.attributes.managed_by],
          instance_id: [role.attributes.instance_id],
          role_key: [role.attributes.role_key],
          display_name: [role.attributes.display_name],
        },
      }));
    }

    async createUser() {
      return { externalId: 'mock-user-id' };
    }
  },
}));

import { createRoleHandler, deleteRoleHandler, updateRoleHandler } from './iam-account-management.server';

describe('iam-account-management role sync integration', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    resetRoleState();
    roleSyncIntegrationState.user = {
      id: `keycloak-role-admin-${Date.now()}`,
      name: 'Integration Admin',
      roles: ['system_admin'],
      instanceId: '11111111-1111-1111-8111-111111111111',
    };
  });

  it('runs create, update and delete role end-to-end against db and identity provider state', async () => {
    const createResponse = await createRoleHandler(
      new Request('http://localhost/api/v1/iam/roles', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'role-sync-create-happy-path',
        },
        body: JSON.stringify({
          roleName: 'custom_editor',
          displayName: 'Custom Editor',
          description: 'Custom Editor',
          roleLevel: 25,
          permissionIds: [],
        }),
      })
    );

    const created = (await createResponse.json()) as { data: { id: string; roleKey: string; roleName: string; syncState: string } };
    expect(createResponse.status).toBe(201);
    expect(created.data.roleKey).toBe('custom_editor');
    expect(roleSyncIntegrationState.idpRoles.has('custom_editor')).toBe(true);

    const updateResponse = await updateRoleHandler(
      new Request(`http://localhost/api/v1/iam/roles/${created.data.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          displayName: 'Custom Editors',
          description: 'Updated description',
          roleLevel: 30,
          permissionIds: [],
        }),
      })
    );

    const updated = (await updateResponse.json()) as { data: { id: string; roleName: string; syncState: string } };
    expect(updateResponse.status).toBe(200);
    expect(updated.data.roleName).toBe('Custom Editors');
    expect(roleSyncIntegrationState.roles.get(created.data.id)?.displayName).toBe('Custom Editors');
    expect(roleSyncIntegrationState.idpRoles.get('custom_editor')?.attributes.display_name).toBe('Custom Editors');

    const deleteResponse = await deleteRoleHandler(
      new Request(`http://localhost/api/v1/iam/roles/${created.data.id}`, {
        method: 'DELETE',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    expect(deleteResponse.status).toBe(200);
    expect(roleSyncIntegrationState.roles.has(created.data.id)).toBe(false);
    expect(roleSyncIntegrationState.idpRoles.has('custom_editor')).toBe(false);
  });

  it('compensates Keycloak role creation when local insert fails', async () => {
    roleSyncIntegrationState.failNextRoleInsert = true;

    const response = await createRoleHandler(
      new Request('http://localhost/api/v1/iam/roles', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'role-sync-create-compensation',
        },
        body: JSON.stringify({
          roleName: 'sync_failure_role',
          displayName: 'Sync Failure Role',
          description: 'Should roll back in Keycloak',
          roleLevel: 25,
          permissionIds: [],
        }),
      })
    );

    const payload = (await response.json()) as { error: { code: string; details?: { syncError?: { code: string } } } };
    expect(response.status).toBe(409);
    expect(payload.error.details?.syncError?.code).toBe('DB_WRITE_FAILED');
    expect(Array.from(roleSyncIntegrationState.roles.values()).some((role) => role.roleKey === 'sync_failure_role')).toBe(false);
    expect(roleSyncIntegrationState.idpRoles.has('sync_failure_role')).toBe(false);
  });

  it('reverts identity provider changes when role update fails locally', async () => {
    const role = seedManagedRole();
    roleSyncIntegrationState.failNextRoleUpdateWrite = true;

    const response = await updateRoleHandler(
      new Request(`http://localhost/api/v1/iam/roles/${role.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          displayName: 'Broken Update',
          description: 'Should be compensated',
          roleLevel: 40,
          permissionIds: [],
        }),
      })
    );

    const payload = (await response.json()) as { error: { code: string; details?: { syncError?: { code: string } } } };
    expect(response.status).toBe(500);
    expect(payload.error.details?.syncError?.code).toBe('DB_WRITE_FAILED');
    expect(roleSyncIntegrationState.roles.get(role.id)?.displayName).toBe('Custom Editor');
    expect(roleSyncIntegrationState.roles.get(role.id)?.description).toBe('Custom Editor');
    expect(roleSyncIntegrationState.idpRoles.get('custom_editor')?.attributes.display_name).toBe('Custom Editor');
    expect(roleSyncIntegrationState.idpRoles.get('custom_editor')?.description).toBe('Custom Editor');
  });

  it('recreates identity provider role when delete fails locally after external deletion', async () => {
    const role = seedManagedRole();
    roleSyncIntegrationState.failNextRoleDeleteWrite = true;

    const response = await deleteRoleHandler(
      new Request(`http://localhost/api/v1/iam/roles/${role.id}`, {
        method: 'DELETE',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    const payload = (await response.json()) as { error: { code: string; details?: { syncError?: { code: string } } } };
    expect(response.status).toBe(500);
    expect(payload.error.details?.syncError?.code).toBe('DB_WRITE_FAILED');
    expect(roleSyncIntegrationState.roles.has(role.id)).toBe(true);
    expect(roleSyncIntegrationState.idpRoles.has('custom_editor')).toBe(true);
    expect(roleSyncIntegrationState.idpRoles.get('custom_editor')?.attributes.display_name).toBe('Custom Editor');
  });
});
