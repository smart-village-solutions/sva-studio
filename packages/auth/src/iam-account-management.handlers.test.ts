import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    isLevelEnabled: vi.fn((level: string) => level === 'debug'),
  },
  workspaceContext: {
    workspaceId: 'de-musterhausen',
    requestId: 'req-iam-handler',
    traceId: 'trace-iam-handler',
  } as { workspaceId?: string; requestId?: string; traceId?: string },
  instanceConfig: {
    canonicalAuthHost: 'studio.smart-village.app',
    parentDomain: 'studio.smart-village.app',
  } as { canonicalAuthHost: string; parentDomain: string } | null,
  instanceByHostname: null as null | {
    instanceId: string;
    primaryHostname: string;
    status: string;
    authRealm: string;
    authClientId: string;
    authIssuerUrl?: string;
    tenantAdminClient?: {
      clientId: string;
      secretConfigured: boolean;
    };
  },
  instanceById: {
    instanceId: 'de-musterhausen',
    primaryHostname: 'de-musterhausen.studio.smart-village.app',
    status: 'active',
    authRealm: 'test',
    authClientId: 'client',
    tenantAdminClient: {
      clientId: 'client-admin',
      secretConfigured: true,
    },
  } as null | {
    instanceId: string;
    primaryHostname: string;
    status: string;
    authRealm: string;
    authClientId: string;
    authIssuerUrl?: string;
    tenantAdminClient?: {
      clientId: string;
      secretConfigured: boolean;
    };
  },
  middlewareError: null as unknown,
  user: {
    id: 'keycloak-admin-1',
    name: 'Admin User',
    roles: ['system_admin'],
    instanceId: 'de-musterhausen',
  },
  queryHandler: null as null | ((text: string, values?: readonly unknown[]) => { rowCount: number; rows: unknown[] }),
  redisAvailable: true,
  permissionCacheHealth: {
    status: 'ready',
    coldStart: false,
    lastRedisLatencyMs: 12,
    recomputePerMinute: 0,
    consecutiveRedisFailures: 0,
  } as {
    status: 'ready' | 'degraded' | 'failed';
    coldStart: boolean;
    lastRedisLatencyMs: number;
    recomputePerMinute: number;
    consecutiveRedisFailures: number;
  },
  keycloakConfigAvailable: true,
  runtimeAuthRealm: 'svs-intern-studio-staging',
  runtimeAuthIssuer: null as null | string,
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
  listUsersImpl: null as null | ((query?: {
    first?: number;
    max?: number;
    search?: string;
    email?: string;
    username?: string;
    enabled?: boolean;
  }) => Promise<unknown> | unknown),
  listUserRoleNamesImpl: null as null | ((externalId: string) => Promise<unknown> | unknown),
  getUserAttributesImpl: null as
    | null
    | ((externalId: string, attributeNames?: readonly string[]) => Promise<unknown> | unknown),
  createUserImpl: null as null | ((input: {
    email: string;
    firstName?: string;
    lastName?: string;
    enabled: boolean;
  }) => Promise<unknown> | unknown),
  updateUserImpl: null as
    | null
    | ((externalId: string, input: {
        username?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        enabled?: boolean;
        attributes?: Readonly<Record<string, string | readonly string[]>>;
      }) => Promise<unknown> | unknown),
  updateUserCalls: [] as Array<{
    externalId: string;
    input: {
      username?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      enabled?: boolean;
      attributes?: Readonly<Record<string, string | readonly string[]>>;
    };
  }>,
  deactivateUserCalls: [] as string[],
  syncRolesImpl: null as null | ((keycloakSubject: string, roleNames: readonly string[]) => Promise<unknown> | unknown),
  syncRolesCalls: [] as Array<{ keycloakSubject: string; roleNames: readonly string[] }>,
  timelineEvents: [] as Array<Record<string, unknown>>,
  timelineError: null as Error | null,
}));

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) => {
    if (state.middlewareError) {
      throw state.middlewareError;
    }

    return handler({
      sessionId: 'session-handler-test',
      user: state.user,
    });
  }),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
  getInstanceConfig: () => state.instanceConfig,
  isCanonicalAuthHost: (host: string) => {
    const canonicalAuthHost = state.instanceConfig?.canonicalAuthHost;
    if (!canonicalAuthHost) {
      return true;
    }

    return host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '') === canonicalAuthHost;
  },
  redactObject: (value: Record<string, unknown>) => value,
  getWorkspaceContext: () => state.workspaceContext,
  toJsonErrorResponse: (status: number, code: string, publicMessage?: string, options?: { requestId?: string }) =>
    new Response(
      JSON.stringify({
        error: code,
        ...(publicMessage ? { message: publicMessage } : {}),
        ...(options?.requestId ? { requestId: options.requestId } : {}),
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    ),
  withRequestContext: async (_opts: unknown, handler: () => Promise<Response> | Response) => handler(),
}));

vi.mock('@sva/data/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/data/server')>();
  return {
    ...actual,
    loadInstanceByHostname: vi.fn(async () => state.instanceByHostname),
    loadInstanceById: vi.fn(async () => state.instanceById),
  };
});

vi.mock('./config-tenant-secret.js', () => ({
  resolveTenantAdminClientSecret: vi.fn(async () => ({
    configured: true,
    readable: true,
    secret: 'tenant-admin-secret',
    source: 'tenant',
  })),
  resolveTenantAuthClientSecret: vi.fn(async () => ({
    configured: true,
    readable: true,
    secret: 'tenant-secret',
    source: 'tenant',
  })),
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

vi.mock('./redis.server', () => ({
  getLastRedisError: vi.fn(() => (state.redisAvailable ? null : 'Redis ping failed')),
  isRedisAvailable: vi.fn(async () => state.redisAvailable),
}));

vi.mock('./config.js', () => ({
  resolveAuthConfigForRequest: vi.fn(async () => ({
    authRealm: state.runtimeAuthRealm,
    issuer: state.runtimeAuthIssuer ?? `https://keycloak.local/realms/${state.runtimeAuthRealm}`,
  })),
}));

vi.mock('./iam-authorization/shared', () => ({
  getPermissionCacheHealth: vi.fn(() => state.permissionCacheHealth),
}));

vi.mock('./iam-account-management/user-timeline-query', () => ({
  resolveUserTimeline: vi.fn(async () => {
    if (state.timelineError) {
      throw state.timelineError;
    }
    return state.timelineEvents;
  }),
}));

vi.mock('pg', () => ({
  Pool: class MockPool {
    async connect() {
      return {
        async query(text: string, values?: readonly unknown[]) {
          const isUserDetailSchemaSupportQuery =
            text.includes("to_regclass('iam.account_permissions')") &&
            text.includes('permissions_action_exists') &&
            text.includes('permissions_scope_exists');

          if (state.queryHandler) {
            const handled = state.queryHandler(text, values);
            if (handled && (!isUserDetailSchemaSupportQuery || handled.rowCount > 0)) {
              return handled;
            }
          }

          if (isUserDetailSchemaSupportQuery) {
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
  getKeycloakAdminClientConfigFromEnv: () => {
    if (!state.keycloakConfigAvailable) {
      throw new Error('Missing Keycloak config');
    }
    return {
      baseUrl: 'http://keycloak.local',
      realm: 'test',
      clientId: 'client',
      clientSecret: 'secret',
    };
  },
  KeycloakAdminClient: class MockKeycloakAdminClient {
    getCircuitBreakerState() {
      return 0;
    }

    async updateUser(externalId: string, input: {
      username?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      enabled?: boolean;
      attributes?: Readonly<Record<string, string | readonly string[]>>;
    }) {
      state.updateUserCalls.push({
        externalId,
        input,
      });
      if (state.updateUserImpl) {
        return state.updateUserImpl(externalId, input);
      }
      return undefined;
    }

    async deactivateUser(keycloakSubject: string) {
      state.deactivateUserCalls.push(keycloakSubject);
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

    async listUsers(query?: {
      first?: number;
      max?: number;
      search?: string;
      email?: string;
      username?: string;
      enabled?: boolean;
    }) {
      if (state.listUsersImpl) {
        return state.listUsersImpl(query);
      }
      return [];
    }

    async listUserRoleNames(externalId: string) {
      if (state.listUserRoleNamesImpl) {
        return state.listUserRoleNamesImpl(externalId);
      }
      return [];
    }

    async getUserAttributes(externalId: string, attributeNames?: readonly string[]) {
      if (state.getUserAttributesImpl) {
        return state.getUserAttributesImpl(externalId, attributeNames);
      }
      return {};
    }

    async createUser(input: { email: string; firstName?: string; lastName?: string; enabled: boolean }) {
      if (state.createUserImpl) {
        return state.createUserImpl(input);
      }
      return { externalId: 'mock-user-id' };
    }
  },
}));

import {
  bulkDeactivateUsersHandler,
  createGroupHandler,
  createRoleHandler,
  createUserHandler,
  deactivateUserHandler,
  deleteGroupHandler,
  deleteRoleHandler,
  getIamFeatureFlags,
  getGroupHandler,
  getMyProfileHandler,
  getUserHandler,
  getUserTimelineHandler,
  healthLiveHandler,
  listGroupsHandler,
  listRolesHandler,
  listUsersHandler,
  reconcileHandler,
  syncUsersFromKeycloakHandler,
  updateGroupHandler,
  updateMyProfileHandler,
  updateRoleHandler,
  updateUserHandler,
} from './iam-account-management.server';
import { toPayloadHash } from './iam-account-management/api-helpers';
import { KeycloakAdminRequestError } from './keycloak-admin-client';

const targetUserId = 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb';
const targetRoleId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const targetGroupId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const buildUserDetailRow = (status: 'active' | 'inactive' = 'active') => ({
  id: targetUserId,
  keycloak_subject: 'keycloak-target-2',
  username_ciphertext: 'target.user',
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

const buildBulkUserRow = (input?: {
  id?: string;
  keycloakSubject?: string;
  status?: 'active' | 'inactive' | 'pending';
  roleRows?: Array<{
    id: string;
    role_key: string;
    role_name: string;
    display_name: string | null;
    role_level: number;
  }>;
}) => ({
  id: input?.id ?? targetUserId,
  keycloak_subject: input?.keycloakSubject ?? 'keycloak-target-2',
  status: input?.status ?? 'active',
  role_rows:
    input?.roleRows ?? [
      {
        id: 'role-editor',
        role_key: 'editor',
        role_name: 'editor',
        display_name: 'editor',
        role_level: 10,
      },
    ],
});

describe('iam-account-management handlers (guards)', () => {
  beforeEach(() => {
    state.logger.debug.mockClear();
    state.logger.info.mockClear();
    state.logger.warn.mockClear();
    state.logger.error.mockClear();
    state.logger.isLevelEnabled.mockClear();
    state.logger.isLevelEnabled.mockImplementation((level: string) => level === 'debug');
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
      instanceId: 'de-musterhausen',
    };
    state.workspaceContext = {
      workspaceId: state.user.instanceId,
      requestId: 'req-iam-handler',
      traceId: 'trace-iam-handler',
    };
    state.middlewareError = null;

    state.queryHandler = (text, values) => {
      if (text.includes('FROM iam.accounts a') && text.includes('WHERE a.keycloak_subject = $2')) {
        const instanceId = values?.[0];
        const keycloakSubject = values?.[1];
        if (
          instanceId === 'de-musterhausen' &&
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
    state.listUsersImpl = null;
    state.listUserRoleNamesImpl = null;
    state.getUserAttributesImpl = null;
    state.createUserImpl = null;
    state.updateUserImpl = null;
    state.updateUserCalls = [];
    state.redisAvailable = true;
    state.permissionCacheHealth = {
      status: 'ready',
      coldStart: false,
      lastRedisLatencyMs: 12,
      recomputePerMinute: 0,
      consecutiveRedisFailures: 0,
    };
    state.instanceById = {
      instanceId: 'de-musterhausen',
      primaryHostname: 'de-musterhausen.studio.smart-village.app',
      status: 'active',
      authRealm: 'test',
      authClientId: 'client',
      tenantAdminClient: {
        clientId: 'client-admin',
        secretConfigured: true,
      },
    };
    state.keycloakConfigAvailable = true;
    state.runtimeAuthRealm = 'svs-intern-studio-staging';
    state.runtimeAuthIssuer = null;
    process.env.KEYCLOAK_ADMIN_BASE_URL = 'http://keycloak.local';
    process.env.KEYCLOAK_ADMIN_REALM = 'svs-intern-studio-staging';
    process.env.KEYCLOAK_ADMIN_CLIENT_ID = 'platform-admin-client';
    process.env.SVA_AUTH_ISSUER = 'https://keycloak.local/realms/svs-intern-studio-staging';
    state.deactivateUserCalls = [];
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

  it('returns a flat json 500 and logs request plus trace ids when auth middleware throws', async () => {
    state.middlewareError = new Error('boom');

    const response = await listUsersHandler(new Request('http://localhost/api/v1/iam/users', { method: 'GET' }));
    const payload = (await response.json()) as { error: string; message?: string; requestId?: string };

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: 'internal_error',
      message: 'Unbehandelter IAM-Fehler.',
      requestId: 'req-iam-handler',
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM request failed unexpectedly',
      expect.objectContaining({
        request_id: 'req-iam-handler',
        trace_id: 'trace-iam-handler',
        error_type: 'Error',
        error_message: 'boom',
      })
    );
  });

  it('logs undefined correlation ids without logger follow-up failures when request context is missing', async () => {
    state.middlewareError = 'boom';
    state.workspaceContext = {};

    const response = await listUsersHandler(new Request('http://localhost/api/v1/iam/users', { method: 'GET' }));
    const payload = (await response.json()) as { error: string; message?: string; requestId?: string };

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: 'internal_error',
      message: 'Unbehandelter IAM-Fehler.',
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM request failed unexpectedly',
      expect.objectContaining({
        request_id: undefined,
        trace_id: undefined,
        error_type: 'string',
        error_message: 'boom',
      })
    );
  });

  it('rejects listUsers when iam admin features are disabled', async () => {
    process.env.IAM_ADMIN_ENABLED = 'false';

    const response = await listUsersHandler(new Request('http://localhost/api/v1/iam/users', { method: 'GET' }));
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('feature_disabled');
  });

  it('rejects invalid status filter on listUsers', async () => {
    const response = await listUsersHandler(
      new Request('http://localhost/api/v1/iam/users?status=unknown', { method: 'GET' })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_request');
  });

  it('returns database_unavailable when listing users fails', async () => {
    state.queryHandler = () => {
      throw new Error('db unavailable');
    };

    const response = await listUsersHandler(new Request('http://localhost/api/v1/iam/users', { method: 'GET' }));
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('database_unavailable');
  });

  it('jit-provisions the actor account for listUsers when only a keycloak identity exists', async () => {
    let actorLookupCount = 0;
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a') && text.includes('WHERE a.keycloak_subject = $2')) {
        actorLookupCount += 1;
        if (actorLookupCount === 1) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('INSERT INTO iam.accounts') && text.includes("VALUES ($1, $2, 'pending')")) {
        return {
          rowCount: 1,
          rows: [{ id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa', created: true }],
        };
      }
      if (text.includes('INSERT INTO iam.instance_memberships')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('event_type') && text.includes('user.jit_provisioned')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('SELECT COUNT(DISTINCT a.id)::int AS total')) {
        return { rowCount: 1, rows: [{ total: 0 }] };
      }
      if (text.includes('ORDER BY a.created_at DESC')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await listUsersHandler(new Request('http://localhost/api/v1/iam/users', { method: 'GET' }));
    const payload = (await response.json()) as { data: unknown[]; pagination: { total: number } };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([]);
    expect(payload.pagination.total).toBe(0);
  });

  it('imports matching keycloak users and reports created, updated and skipped counts', async () => {
    let upsertCount = 0;
    state.listUsersImpl = () => [
      {
        externalId: 'kc-user-imported',
        username: 'alice.import',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Import',
        enabled: true,
        attributes: {
          instanceId: ['de-musterhausen'],
          displayName: ['Alice Import'],
        },
      },
      {
        externalId: 'kc-user-updated',
        username: 'bob.update',
        email: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'Update',
        enabled: false,
        attributes: {
          instanceId: ['de-musterhausen'],
        },
      },
      {
        externalId: 'kc-user-skipped',
        username: 'skip.me',
        attributes: {
          instanceId: ['22222222-2222-2222-8222-222222222222'],
        },
      },
    ];
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('INSERT INTO iam.accounts')) {
        upsertCount += 1;
        return {
          rowCount: 1,
          rows: [
            {
              id: upsertCount === 1 ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222',
              created: upsertCount === 1,
            },
          ],
        };
      }
      if (text.includes('INSERT INTO iam.instance_memberships')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await syncUsersFromKeycloakHandler(
      new Request('http://localhost/api/v1/iam/users/sync-keycloak', {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify({}),
      })
    );
    const payload = (await response.json()) as {
      data: {
        importedCount: number;
        updatedCount: number;
        skippedCount: number;
        totalKeycloakUsers: number;
        diagnostics?: {
          authRealm: string;
          providerSource: 'instance' | 'global';
          executionMode?: 'platform_admin' | 'tenant_admin' | 'break_glass';
          skippedInstanceIds?: readonly string[];
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      importedCount: 1,
      updatedCount: 1,
      skippedCount: 1,
      totalKeycloakUsers: 3,
      diagnostics: {
        providerSource: 'instance',
        executionMode: 'tenant_admin',
      },
    });
    expect(payload.data.diagnostics?.authRealm).toBe('test');
    expect(payload.data.diagnostics?.skippedInstanceIds).toEqual([
      '22222222-2222-2222-8222-222222222222',
    ]);
  });

  it('skips sync logging when all keycloak users match the active instance', async () => {
    state.listUsersImpl = () => [
      {
        externalId: 'kc-user-1',
        username: 'alice.import',
        email: 'alice@example.com',
        enabled: true,
        attributes: {
          instanceId: ['de-musterhausen'],
        },
      },
      {
        externalId: 'kc-user-2',
        username: 'bob.import',
        email: 'bob@example.com',
        enabled: true,
        attributes: {
          instanceId: ['de-musterhausen'],
        },
      },
    ];
    state.queryHandler = (text, values) => {
      if (text.includes('FROM iam.accounts a') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('INSERT INTO iam.accounts')) {
        return {
          rowCount: 1,
          rows: [{ id: values?.[0] ?? '11111111-1111-4111-8111-111111111111', created: true }],
        };
      }
      if (text.includes('INSERT INTO iam.instance_memberships') || text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await syncUsersFromKeycloakHandler(
      new Request('http://localhost/api/v1/iam/users/sync-keycloak', {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(200);
    expect(state.logger.debug).not.toHaveBeenCalledWith(
      'Skipped Keycloak user during IAM sync due to instance mismatch',
      expect.anything()
    );
    expect(state.logger.info).not.toHaveBeenCalledWith(
      'Keycloak user sync skipped users because instance ids did not match',
      expect.anything()
    );
  });

  it('caps sync debug logs and keeps subject refs pseudonymized for skipped users', async () => {
    state.listUsersImpl = () =>
      Array.from({ length: 22 }, (_, index) => ({
        externalId: `cleartext-user-${index}@example.com`,
        username: `skip.${index}`,
        email: `cleartext-user-${index}@example.com`,
        enabled: true,
        attributes: {
          instanceId: [`22222222-2222-2222-8222-2222222222${String(index).padStart(2, '0')}`],
        },
      }));
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await syncUsersFromKeycloakHandler(
      new Request('http://localhost/api/v1/iam/users/sync-keycloak', {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(200);
    const debugCalls = state.logger.debug.mock.calls.filter(
      ([message]) => message === 'Skipped Keycloak user during IAM sync due to instance mismatch'
    );
    expect(debugCalls).toHaveLength(20);
    const firstDebugMeta = debugCalls[0]?.[1] as Record<string, string | undefined>;
    expect(firstDebugMeta.subject_ref).toBeDefined();
    expect(firstDebugMeta.subject_ref).not.toContain('@');
    expect(JSON.stringify(debugCalls)).not.toContain('cleartext-user-0@example.com');
    expect(state.logger.info).toHaveBeenCalledWith(
      'Keycloak user sync skipped users because instance ids did not match',
      expect.objectContaining({
        skipped_count: 22,
      })
    );
  });

  it('limits skipped instance id samples to five entries in sync summary logs', async () => {
    state.listUsersImpl = () =>
      Array.from({ length: 7 }, (_, index) => ({
        externalId: `kc-user-${index}`,
        username: `skip.${index}`,
        enabled: true,
        attributes: {
          instanceId: [`22222222-2222-2222-8222-22222222222${index < 6 ? index : 0}`],
        },
      }));
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await syncUsersFromKeycloakHandler(
      new Request('http://localhost/api/v1/iam/users/sync-keycloak', {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(200);
    const summaryCall = state.logger.info.mock.calls.find(
      ([message]) => message === 'Keycloak user sync skipped users because instance ids did not match'
    );
    const summaryMeta = summaryCall?.[1] as Record<string, string | number | undefined>;
    expect(summaryMeta.skipped_count).toBe(7);
    expect(String(summaryMeta.sample_instance_ids).split(',')).toHaveLength(5);
  });

  it('maps keycloak failures during import sync to keycloak_unavailable', async () => {
    state.listUsersImpl = () => {
      throw new KeycloakAdminRequestError({
        message: 'down',
        statusCode: 503,
        code: 'service_unavailable',
        retryable: true,
      });
    };

    const response = await syncUsersFromKeycloakHandler(
      new Request('http://localhost/api/v1/iam/users/sync-keycloak', {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify({}),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('keycloak_unavailable');
  });

  it('rejects getUser for invalid user id path segment', async () => {
    const response = await getUserHandler(new Request('http://localhost/api/v1/iam/users/not-a-uuid', { method: 'GET' }));
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_request');
  });

  it('returns not_found when getUser cannot resolve the target user', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await getUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, { method: 'GET' })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('not_found');
  });

  it('returns database_unavailable when getUser encounters a db error', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      throw new Error('db unavailable');
    };

    const response = await getUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, { method: 'GET' })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('database_unavailable');
  });

  it('synchronizes user roles from Keycloak before returning user details', async () => {
    const keycloakRoleRows = [
      {
        id: 'role-editor',
        role_key: 'editor',
        role_name: 'editor',
        display_name: 'Editor',
        external_role_name: 'editor',
        role_level: 10,
        is_system_role: false,
      },
      {
        id: 'role-admin',
        role_key: 'system_admin',
        role_name: 'system_admin',
        display_name: 'System Admin',
        external_role_name: 'system_admin',
        role_level: 90,
        is_system_role: true,
      },
    ];
    const userDetailRow = buildUserDetailRow('active');
    userDetailRow.role_rows = [];
    let roleWriteAttempted = false;
    let invalidationAttempted = false;

    state.listUserRoleNamesImpl = async () => ['editor', 'system_admin', 'default-roles-test'];
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 1, rows: [userDetailRow] };
      }

      if (text.includes('COALESCE(external_role_name, role_key) = ANY($2::text[])')) {
        return { rowCount: keycloakRoleRows.length, rows: keycloakRoleRows };
      }

      if (text.includes('SELECT pg_notify')) {
        invalidationAttempted = true;
      }

      if (text.includes('DELETE FROM iam.account_roles') || text.includes('INSERT INTO iam.account_roles')) {
        roleWriteAttempted = true;
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await getUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, { method: 'GET' })
    );
    const payload = (await response.json()) as {
      data: {
        id: string;
        roles: Array<{ roleId: string; roleKey: string; roleName: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(targetUserId);
    expect(payload.data.roles).toHaveLength(2);
    expect(payload.data.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ roleId: 'role-editor', roleKey: 'editor', roleName: 'Editor' }),
        expect.objectContaining({ roleId: 'role-admin', roleKey: 'system_admin', roleName: 'System Admin' }),
      ])
    );
    expect(roleWriteAttempted).toBe(false);
    expect(invalidationAttempted).toBe(false);
  });

  it('degrades gracefully when Keycloak reads fail during getUser', async () => {
    state.listUserRoleNamesImpl = async () => {
      throw new KeycloakAdminRequestError({
        message: 'read timeout',
        statusCode: 503,
        code: 'read_timeout',
        retryable: true,
      });
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 1, rows: [buildUserDetailRow('active')] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await getUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, { method: 'GET' })
    );
    const payload = (await response.json()) as {
      data: {
        id: string;
        roles: Array<{ roleId: string; roleKey: string; roleName: string }>;
        mainserverUserApplicationId?: string;
        mainserverUserApplicationSecretSet: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(targetUserId);
    expect(payload.data.roles).toEqual([
      expect.objectContaining({ roleId: 'role-editor', roleKey: 'editor', roleName: 'editor', roleLevel: 10 }),
    ]);
    expect(payload.data.mainserverUserApplicationId).toBeUndefined();
    expect(payload.data.mainserverUserApplicationSecretSet).toBe(false);
    expect(state.logger.warn).toHaveBeenCalledWith(
      'IAM user detail projection degraded because external data could not be loaded',
      expect.objectContaining({
        operation: 'get_user',
        user_id: targetUserId,
        keycloak_roles_error: 'read timeout',
      })
    );
  });

  it('returns mainserver credential state from canonical attributes on getUser', async () => {
    state.listUserRoleNamesImpl = async () => ['editor'];
    state.getUserAttributesImpl = async () => ({
      mainserverUserApplicationId: ['studio-app-id'],
      mainserverUserApplicationSecret: ['top-secret'],
    });
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 1, rows: [buildUserDetailRow('active')] };
      }

      if (text.includes('COALESCE(external_role_name, role_key) = ANY($2::text[])')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'role-editor',
              role_key: 'editor',
              role_name: 'editor',
              display_name: 'Editor',
              external_role_name: 'editor',
              role_level: 10,
              is_system_role: false,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await getUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, { method: 'GET' })
    );
    const payload = (await response.json()) as {
      data: {
        mainserverUserApplicationId?: string;
        mainserverUserApplicationSecretSet: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.mainserverUserApplicationId).toBe('studio-app-id');
    expect(payload.data.mainserverUserApplicationSecretSet).toBe(true);
  });

  it('falls back to legacy mainserver attributes on getUser', async () => {
    state.listUserRoleNamesImpl = async () => ['editor'];
    state.getUserAttributesImpl = async () => ({
      sva_mainserver_api_key: ['legacy-app-id'],
      sva_mainserver_api_secret: ['legacy-secret'],
    });
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 1, rows: [buildUserDetailRow('active')] };
      }

      if (text.includes('COALESCE(external_role_name, role_key) = ANY($2::text[])')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'role-editor',
              role_key: 'editor',
              role_name: 'editor',
              display_name: 'Editor',
              external_role_name: 'editor',
              role_level: 10,
              is_system_role: false,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await getUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, { method: 'GET' })
    );
    const payload = (await response.json()) as {
      data: {
        mainserverUserApplicationId?: string;
        mainserverUserApplicationSecretSet: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.mainserverUserApplicationId).toBe('legacy-app-id');
    expect(payload.data.mainserverUserApplicationSecretSet).toBe(true);
  });

  it('keeps existing user roles when no identity provider is configured', async () => {
    const userDetailRow = buildUserDetailRow('active');
    vi.resetModules();
    state.keycloakConfigAvailable = false;
    state.instanceById = null;
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 1, rows: [userDetailRow] };
      }

      return { rowCount: 0, rows: [] };
    };

    const { getUserHandler: freshGetUserHandler } = await import('./iam-account-management.server');
    const response = await freshGetUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, { method: 'GET' })
    );
    const payload = (await response.json()) as {
      data: {
        id: string;
        roles: Array<{ roleId: string; roleKey: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(targetUserId);
    expect(payload.data.roles).toEqual([
      expect.objectContaining({ roleId: 'role-editor', roleKey: 'editor' }),
    ]);

    state.instanceById = {
      instanceId: 'de-musterhausen',
      primaryHostname: 'de-musterhausen.studio.smart-village.app',
      status: 'active',
      authRealm: 'test',
      authClientId: 'client',
    };
  });

  it('skips role writes when Keycloak returns no mapped roles', async () => {
    const userDetailRow = buildUserDetailRow('active');
    userDetailRow.role_rows = [];
    let externalRoleLookupCalled = false;

    state.listUserRoleNamesImpl = async () => [];
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 1, rows: [userDetailRow] };
      }

      if (text.includes('COALESCE(external_role_name, role_key) = ANY($2::text[])')) {
        externalRoleLookupCalled = true;
      }

      if (text.includes('DELETE FROM iam.account_roles') || text.includes('INSERT INTO iam.account_roles')) {
        throw new Error('role writes should not run');
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await getUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, { method: 'GET' })
    );
    const payload = (await response.json()) as {
      data: {
        roles: Array<{ roleId: string; roleKey: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.roles).toEqual([]);
    expect(externalRoleLookupCalled).toBe(false);
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

  it('returns database_unavailable when a missing actor account also cannot be provisioned', async () => {
    state.queryHandler = () => ({ rowCount: 0, rows: [] });

    const response = await createUserHandler(
      new Request('http://localhost/api/v1/iam/users', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'user-create-missing-actor',
        },
        body: JSON.stringify({
          email: 'new.user@example.com',
          roleIds: [],
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('database_unavailable');
  });

  it('rejects createUser when iam admin features are disabled', async () => {
    process.env.IAM_ADMIN_ENABLED = 'false';

    const response = await createUserHandler(
      new Request('http://localhost/api/v1/iam/users', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'feature-disabled-create-user',
        },
        body: JSON.stringify({
          email: 'new.user@example.com',
          roleIds: [],
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('feature_disabled');
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

  it('rejects updateUser when iam admin features are disabled', async () => {
    process.env.IAM_ADMIN_ENABLED = 'false';

    const response = await updateUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({ firstName: 'Blocked' }),
      })
    );

    const payload = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('feature_disabled');
  });

  it('returns not_found when updating an unknown user', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('MAX(r.role_level)')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 0, rows: [] };
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

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: 'not_found',
        message: 'Nutzer nicht gefunden.',
      },
      requestId: 'req-iam-handler',
    });
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

  it('rejects deactivateUser when iam admin features are disabled', async () => {
    process.env.IAM_ADMIN_ENABLED = 'false';

    const response = await deactivateUserHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}`, {
        method: 'DELETE',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    const payload = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('feature_disabled');
  });

  it('updates a user successfully on happy path', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('MAX(r.role_level)')) {
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

  it('writes canonical mainserver attributes during user updates and preserves existing secrets', async () => {
    state.getUserAttributesImpl = async () => ({
      displayName: ['Target User'],
      mainserverUserApplicationId: ['existing-app-id'],
      mainserverUserApplicationSecret: ['existing-secret'],
      customAttribute: ['keep-me'],
      sva_mainserver_api_key: ['legacy-app-id'],
      sva_mainserver_api_secret: ['legacy-secret'],
    });
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('MAX(r.role_level)')) {
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
          displayName: 'Updated User',
          mainserverUserApplicationId: 'updated-app-id',
          mainserverUserApplicationSecret: '   ',
        }),
      })
    );
    const payload = (await response.json()) as {
      data: {
        mainserverUserApplicationId?: string;
        mainserverUserApplicationSecretSet: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(state.updateUserCalls).toContainEqual({
      externalId: 'keycloak-target-2',
      input: expect.objectContaining({
        attributes: {
          customAttribute: ['keep-me'],
          displayName: ['Updated User'],
          mainserverUserApplicationId: ['updated-app-id'],
          mainserverUserApplicationSecret: ['existing-secret'],
        },
      }),
    });
    expect(payload.data.mainserverUserApplicationId).toBe('updated-app-id');
    expect(payload.data.mainserverUserApplicationSecretSet).toBe(true);
  });

  it('allows session system_admin to assign elevated roles even when actor account roles are not synced yet', async () => {
    const systemAdminRoleId = '11111111-1111-4111-8111-111111111111';

    state.user = {
      id: 'cb01549c-0bf8-4cc0-b60b-a917cd820e30',
      name: 'Tim Test',
      roles: ['App', 'Account Manager', 'Extended User', 'User', 'Restricted', 'Editor', 'Admin', 'system_admin'],
      instanceId: '35d9657e-1347-4d14-bb0d-6dafd8bdea5a',
    };

    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('MAX(r.role_level)')) {
        return { rowCount: 1, rows: [{ max_role_level: 0 }] };
      }

      if (text.includes('FROM iam.roles') && text.includes('id = ANY($2::uuid[])')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: systemAdminRoleId,
              role_key: 'system_admin',
              role_name: 'system_admin',
              display_name: 'system_admin',
              external_role_name: 'system_admin',
              role_level: 100,
              is_system_role: true,
            },
          ],
        };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return {
          rowCount: 1,
          rows: [buildUserDetailRow('active')],
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
          roleIds: [systemAdminRoleId],
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

      if (text.includes('MAX(r.role_level)')) {
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

  it('rejects user updates that would deactivate the last active system admin', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('MAX(r.role_level)')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('SELECT EXISTS (')) {
        return { rowCount: 1, rows: [{ has_role: true }] };
      }

      if (text.includes('COUNT(DISTINCT a.id)::int AS admin_count')) {
        return { rowCount: 1, rows: [{ admin_count: 1 }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              ...buildUserDetailRow('active'),
              role_rows: [
                {
                  id: 'role-system-admin',
                  role_key: 'system_admin',
                  role_name: 'system_admin',
                  display_name: 'System Admin',
                  role_level: 90,
                  is_system_role: true,
                },
              ],
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
          status: 'inactive',
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('last_admin_protection');
  });

  it('rejects removing the system_admin role from the last active system admin', async () => {
    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('MAX(r.role_level)')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('COUNT(DISTINCT a.id)::int AS admin_count')) {
        return { rowCount: 1, rows: [{ admin_count: 1 }] };
      }

      if (text.includes('SELECT id, role_key, role_name, display_name, external_role_name')) {
        const roleIds = values?.[1] as string[] | undefined;
        if (roleIds?.includes(targetRoleId)) {
          return {
            rowCount: 1,
            rows: [
              {
                id: targetRoleId,
                role_key: 'editor',
                role_name: 'editor',
                display_name: 'Editor',
                external_role_name: 'Editor',
                role_level: 10,
                is_system_role: false,
              },
            ],
          };
        }

        return {
          rowCount: 1,
          rows: [
            {
              id: 'role-system-admin',
              role_key: 'system_admin',
              role_name: 'system_admin',
              display_name: 'System Admin',
              external_role_name: 'System Admin',
              role_level: 90,
              is_system_role: true,
            },
          ],
        };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              ...buildUserDetailRow('active'),
              role_rows: [
                {
                  id: 'role-system-admin',
                  role_key: 'system_admin',
                  role_name: 'system_admin',
                  display_name: 'System Admin',
                  role_level: 90,
                  is_system_role: true,
                },
              ],
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
          roleIds: [targetRoleId],
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('last_admin_protection');
  });

  it('rejects user updates when referenced groups do not exist', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('MAX(r.role_level)')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 1, rows: [buildUserDetailRow('active')] };
      }

      if (text.includes('FROM iam.groups') && text.includes('id = ANY($2::uuid[])')) {
        return { rowCount: 0, rows: [] };
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
          groupIds: [targetGroupId],
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_request');
    expect(payload.error.message).toContain('Mindestens eine aktive Gruppe existiert nicht');
  });

  it('rejects group assignments that would exceed the actor role level', async () => {
    let membershipWriteAttempted = false;

    state.user = {
      ...state.user,
      roles: ['app_manager'],
    };

    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('MAX(r.role_level)')) {
        return { rowCount: 1, rows: [{ max_role_level: 20 }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 1, rows: [buildUserDetailRow('active')] };
      }

      if (text.includes('FROM iam.groups') && text.includes('id = ANY($2::uuid[])')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetGroupId,
              group_key: 'admins',
              display_name: 'Admins',
              description: 'Administrative Gruppe',
              group_type: 'role_bundle',
              is_active: true,
            },
          ],
        };
      }

      if (text.includes('SELECT DISTINCT gr.role_id') && text.includes('FROM iam.group_roles gr')) {
        return {
          rowCount: 1,
          rows: [{ role_id: targetRoleId }],
        };
      }

      if (text.includes('SELECT id, role_key, role_name, display_name, external_role_name')) {
        const roleIds = values?.[1] as readonly string[] | undefined;
        if (roleIds?.includes(targetRoleId)) {
          return {
            rowCount: 1,
            rows: [
              {
                id: targetRoleId,
                role_key: 'system_admin',
                role_name: 'system_admin',
                display_name: 'System Admin',
                external_role_name: 'system_admin',
                role_level: 90,
                is_system_role: true,
              },
            ],
          };
        }
      }

      if (text.includes('DELETE FROM iam.account_groups') || text.includes('INSERT INTO iam.account_groups')) {
        membershipWriteAttempted = true;
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
          groupIds: [targetGroupId],
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('forbidden');
    expect(payload.error.message).toContain('Rollenzuweisung überschreitet die eigene Berechtigungsstufe');
    expect(membershipWriteAttempted).toBe(false);
  });

  it('rejects deactivation of the current user', async () => {
    state.user = {
      ...state.user,
      id: 'keycloak-target-2',
    };

    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('MAX(r.role_level)')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 1, rows: [buildUserDetailRow('active')] };
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
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('self_protection');
  });

  it('rejects deactivation of the last active system admin', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('MAX(r.role_level)')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('SELECT EXISTS (')) {
        return { rowCount: 1, rows: [{ has_role: true }] };
      }

      if (text.includes('COUNT(DISTINCT a.id)::int AS admin_count')) {
        return { rowCount: 1, rows: [{ admin_count: 1 }] };
      }

      if (text.includes('WHERE a.id = $2::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              ...buildUserDetailRow('active'),
              role_rows: [
                {
                  id: 'role-system-admin',
                  role_key: 'system_admin',
                  role_name: 'system_admin',
                  display_name: 'System Admin',
                  role_level: 90,
                  is_system_role: true,
                },
              ],
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
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('last_admin_protection');
  });

  it('rejects deactivation when target user exceeds actor role level', async () => {
    state.user = {
      ...state.user,
      roles: ['app_manager'],
    };

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

  it('returns database_unavailable when listing roles fails', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      throw new Error('db unavailable');
    };

    const response = await listRolesHandler(new Request('http://localhost/api/v1/iam/roles', { method: 'GET' }));
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('database_unavailable');
  });

  it('lists groups on happy path', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.groups g') && text.includes('ORDER BY g.is_active DESC')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetGroupId,
              group_key: 'admins',
              display_name: 'Admins',
              description: 'Administrative Gruppe',
              group_type: 'role_bundle',
              is_active: true,
              member_count: 2,
              role_rows: [{ role_id: targetRoleId, role_key: 'system_admin', role_name: 'System Admin' }],
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await listGroupsHandler(new Request('http://localhost/api/v1/iam/groups', { method: 'GET' }));
    const payload = (await response.json()) as {
      data: Array<{ id: string; groupKey: string; memberCount: number; roles: Array<{ roleKey: string }> }>;
    };

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.id).toBe(targetGroupId);
    expect(payload.data[0]?.groupKey).toBe('admins');
    expect(payload.data[0]?.memberCount).toBe(2);
    expect(payload.data[0]?.roles[0]?.roleKey).toBe('system_admin');
  });

  it('returns database_unavailable when listing groups fails', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      throw new Error('db unavailable');
    };

    const response = await listGroupsHandler(new Request('http://localhost/api/v1/iam/groups', { method: 'GET' }));
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('database_unavailable');
  });

  it('returns zero-sized pagination when no groups exist', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.groups g') && text.includes('ORDER BY g.is_active DESC')) {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await listGroupsHandler(new Request('http://localhost/api/v1/iam/groups', { method: 'GET' }));
    const payload = (await response.json()) as {
      data: unknown[];
      pagination: { page: number; pageSize: number; total: number };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([]);
    expect(payload.pagination).toEqual({
      page: 1,
      pageSize: 0,
      total: 0,
    });
  });

  it('returns group details including current member assignments', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.groups g') && text.includes('AND g.id = $2::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetGroupId,
              group_key: 'admins',
              display_name: 'Admins',
              description: 'Administrative Gruppe',
              group_type: 'role_bundle',
              is_active: true,
              member_count: 1,
              role_rows: [{ role_id: targetRoleId, role_key: 'system_admin', role_name: 'System Admin' }],
              member_rows: [
                {
                  account_id: 'bbbbbbbb-bbbb-bbbb-8bbb-bbbbbbbbbbbb',
                  group_id: targetGroupId,
                  group_key: 'admins',
                  display_name: 'Admins',
                  group_type: 'role_bundle',
                  origin: 'manual',
                  valid_from: '2026-03-17T10:00:00.000Z',
                  valid_to: null,
                },
              ],
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await getGroupHandler(
      new Request(`http://localhost/api/v1/iam/groups/${targetGroupId}`, {
        method: 'GET',
      })
    );
    const payload = (await response.json()) as {
      data: {
        id: string;
        roles: Array<{ roleKey: string }>;
        members: Array<{ accountId?: string; groupId: string; origin: string; validFrom?: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(targetGroupId);
    expect(payload.data.roles[0]?.roleKey).toBe('system_admin');
    expect(payload.data.members).toEqual([
      {
        accountId: 'bbbbbbbb-bbbb-bbbb-8bbb-bbbbbbbbbbbb',
        groupId: targetGroupId,
        groupKey: 'admins',
        displayName: 'Admins',
        groupType: 'role_bundle',
        origin: 'manual',
        validFrom: '2026-03-17T10:00:00.000Z',
      },
    ]);
  });

  it('rejects getGroup for invalid group id path segment', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await getGroupHandler(
      new Request('http://localhost/api/v1/iam/groups/not-a-uuid', {
        method: 'GET',
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_request');
  });

  it('creates a group successfully with an idempotency key', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('INSERT INTO iam.idempotency_keys')) {
        return { rowCount: 1, rows: [{ status: 'IN_PROGRESS' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes('id = ANY($2::uuid[])')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'system_admin',
              role_name: 'system_admin',
              display_name: 'System Admin',
              external_role_name: 'system_admin',
              role_level: 90,
              is_system_role: true,
            },
          ],
        };
      }

      if (text.includes('INSERT INTO iam.groups') && text.includes('RETURNING id')) {
        return { rowCount: 1, rows: [{ id: targetGroupId }] };
      }

      if (text.includes('DELETE FROM iam.group_roles')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('INSERT INTO iam.group_roles')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('INSERT INTO iam.activity_logs') || text.includes('SELECT pg_notify')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('FROM iam.groups g') && text.includes('AND g.id = $2::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetGroupId,
              group_key: 'admins',
              display_name: 'Admins',
              description: 'Administrative Gruppe',
              group_type: 'role_bundle',
              is_active: true,
              member_count: 0,
              role_rows: [{ role_id: targetRoleId, role_key: 'system_admin', role_name: 'System Admin' }],
              member_rows: [],
            },
          ],
        };
      }

      if (text.includes('UPDATE iam.idempotency_keys')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await createGroupHandler(
      new Request('http://localhost/api/v1/iam/groups', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'group-create-1',
        },
        body: JSON.stringify({
          groupKey: 'admins',
          displayName: 'Admins',
          description: 'Administrative Gruppe',
          roleIds: [targetRoleId],
        }),
      })
    );

    const payload = (await response.json()) as {
      data: { id: string; groupKey: string; displayName: string; roles: Array<{ roleId: string }> };
    };

    expect(response.status).toBe(201);
    expect(payload.data.id).toBe(targetGroupId);
    expect(payload.data.groupKey).toBe('admins');
    expect(payload.data.displayName).toBe('Admins');
    expect(payload.data.roles).toEqual([
      {
        roleId: targetRoleId,
        roleKey: 'system_admin',
        roleName: 'System Admin',
      },
    ]);
  });

  it('rejects createGroup without idempotency key', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await createGroupHandler(
      new Request('http://localhost/api/v1/iam/groups', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          groupKey: 'admins',
          displayName: 'Admins',
          roleIds: [targetRoleId],
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('idempotency_key_required');
  });

  it('returns conflict when creating a group with an existing group key', async () => {
    let idempotencyCompletion:
      | {
          status: string;
          responseStatus: number;
          responseBody: { error?: { code?: string } };
        }
      | undefined;

    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('INSERT INTO iam.idempotency_keys')) {
        return { rowCount: 1, rows: [{ status: 'IN_PROGRESS' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes('id = ANY($2::uuid[])')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'system_admin',
              role_name: 'system_admin',
              display_name: 'System Admin',
              external_role_name: 'system_admin',
              role_level: 90,
              is_system_role: true,
            },
          ],
        };
      }

      if (text.includes('INSERT INTO iam.groups') && text.includes('RETURNING id')) {
        throw new Error('groups_instance_key_uniq');
      }

      if (text.includes('UPDATE iam.idempotency_keys')) {
        idempotencyCompletion = {
          status: String(values?.[4]),
          responseStatus: Number(values?.[5]),
          responseBody: JSON.parse(String(values?.[6])),
        };
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await createGroupHandler(
      new Request('http://localhost/api/v1/iam/groups', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'group-create-conflict',
        },
        body: JSON.stringify({
          groupKey: 'admins',
          displayName: 'Admins',
          roleIds: [targetRoleId],
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('conflict');
    expect(idempotencyCompletion).toEqual({
      status: 'FAILED',
      responseStatus: 409,
      responseBody: {
        error: {
          code: 'conflict',
          message: 'Gruppe mit diesem Schlüssel existiert bereits.',
        },
        requestId: 'req-iam-handler',
      },
    });
  });

  it('rejects createGroup when iam admin features are disabled', async () => {
    process.env.IAM_ADMIN_ENABLED = 'false';

    const response = await createGroupHandler(
      new Request('http://localhost/api/v1/iam/groups', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'feature-disabled-create-group',
        },
        body: JSON.stringify({
          groupKey: 'admins',
          displayName: 'Admins',
          roleIds: [targetRoleId],
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('feature_disabled');
  });

  it('returns invalid_request when updating a group with unknown role ids', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes('id = ANY($2::uuid[])')) {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await updateGroupHandler(
      new Request(`http://localhost/api/v1/iam/groups/${targetGroupId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          displayName: 'Admins Updated',
          roleIds: [targetRoleId],
        }),
      })
    );

    const payload = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_request');
    expect(payload.error.message).toContain('Mindestens eine Rolle existiert nicht');
  });

  it('rejects updateGroup for invalid group id path segment', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await updateGroupHandler(
      new Request('http://localhost/api/v1/iam/groups/not-a-uuid', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          displayName: 'Admins Updated',
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('invalid_request');
  });

  it('updates a group successfully and reloads its detail payload', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes('id = ANY($2::uuid[])')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetRoleId,
              role_key: 'system_admin',
              role_name: 'system_admin',
              display_name: 'System Admin',
              external_role_name: 'system_admin',
              role_level: 90,
              is_system_role: true,
            },
          ],
        };
      }

      if (text.includes('UPDATE iam.groups') && text.includes('RETURNING id;')) {
        return { rowCount: 1, rows: [{ id: targetGroupId }] };
      }

      if (text.includes('DELETE FROM iam.group_roles') || text.includes('INSERT INTO iam.group_roles')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('INSERT INTO iam.activity_logs') || text.includes('SELECT pg_notify')) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('FROM iam.groups g') && text.includes('AND g.id = $2::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: targetGroupId,
              group_key: 'admins',
              display_name: 'Admins Updated',
              description: 'Neue Beschreibung',
              group_type: 'role_bundle',
              is_active: false,
              member_count: 0,
              role_rows: [{ role_id: targetRoleId, role_key: 'system_admin', role_name: 'System Admin' }],
              member_rows: [],
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await updateGroupHandler(
      new Request(`http://localhost/api/v1/iam/groups/${targetGroupId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          displayName: 'Admins Updated',
          description: 'Neue Beschreibung',
          isActive: false,
          roleIds: [targetRoleId],
        }),
      })
    );
    const payload = (await response.json()) as {
      data: { id: string; displayName: string; isActive: boolean; roles: Array<{ roleKey: string }> };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      id: targetGroupId,
      displayName: 'Admins Updated',
      isActive: false,
    });
    expect(payload.data.roles[0]?.roleKey).toBe('system_admin');
  });

  it('returns not_found when deleting an unknown group', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('UPDATE iam.groups') && text.includes('SET is_active = false')) {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await deleteGroupHandler(
      new Request(`http://localhost/api/v1/iam/groups/${targetGroupId}`, {
        method: 'DELETE',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('not_found');
  });

  it('rejects deleteGroup for invalid group id path segment', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await deleteGroupHandler(
      new Request('http://localhost/api/v1/iam/groups/not-a-uuid', {
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

  it('deactivates a group successfully', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('UPDATE iam.groups') && text.includes('SET is_active = false')) {
        return { rowCount: 1, rows: [{ id: targetGroupId }] };
      }

      if (text.includes('INSERT INTO iam.activity_logs') || text.includes('SELECT pg_notify')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await deleteGroupHandler(
      new Request(`http://localhost/api/v1/iam/groups/${targetGroupId}`, {
        method: 'DELETE',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { id: targetGroupId },
      requestId: 'req-iam-handler',
    });
  });

  it('returns not_found when reading an unknown group', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.groups g') && text.includes('AND g.id = $2::uuid')) {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    };

    const response = await getGroupHandler(
      new Request(`http://localhost/api/v1/iam/groups/${targetGroupId}`, {
        method: 'GET',
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('not_found');
  });

  it('rejects listRoles when iam admin features are disabled', async () => {
    process.env.IAM_ADMIN_ENABLED = 'false';

    const response = await listRolesHandler(new Request('http://localhost/api/v1/iam/roles', { method: 'GET' }));
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('feature_disabled');
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

      if (text.includes('INSERT INTO iam.idempotency_keys')) {
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
      if (text.includes('INSERT INTO iam.idempotency_keys')) {
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
      if (text.includes('INSERT INTO iam.idempotency_keys')) {
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

  it('updates role permissions without requiring Keycloak when only permissionIds change', async () => {
    state.keycloakConfigAvailable = false;
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
              sync_state: 'failed',
              last_synced_at: null,
              last_error_code: 'IDP_TIMEOUT',
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
              description: 'Custom Editor',
              is_system_role: false,
              role_level: 25,
              managed_by: 'studio',
              member_count: 0,
              sync_state: 'failed',
              last_synced_at: null,
              last_error_code: 'IDP_TIMEOUT',
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
          permissionIds: [],
        }),
      })
    );

    const payload = (await response.json()) as { data: { id: string; syncState: string } };
    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(targetRoleId);
    expect(payload.data.syncState).toBe('failed');
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

  it('rejects createRole when iam admin features are disabled', async () => {
    process.env.IAM_ADMIN_ENABLED = 'false';

    const response = await createRoleHandler(
      new Request('http://localhost/api/v1/iam/roles', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'feature-disabled-create-role',
        },
        body: JSON.stringify({
          roleName: 'editor',
          displayName: 'Editor',
          roleLevel: 10,
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('feature_disabled');
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

  it('imports studio-managed Keycloak roles during reconcile when metadata is complete', async () => {
    const executedStatements: string[] = [];
    state.listRolesImpl = () => [
      {
        id: 'kc-custom_editor',
        externalName: 'custom_editor',
        description: 'Custom Editor',
        attributes: {
          managed_by: ['studio'],
          instance_id: ['de-musterhausen'],
          role_key: ['custom_editor'],
          display_name: ['Custom Editor'],
        },
      },
    ];
    state.queryHandler = (text) => {
      executedStatements.push(text);
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('FROM iam.roles') && text.includes("managed_by = 'studio'")) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('INSERT INTO iam.roles') && text.includes('RETURNING id')) {
        return { rowCount: 1, rows: [{ id: targetRoleId }] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
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
        checkedCount: number;
        correctedCount: number;
        failedCount: number;
        requiresManualActionCount: number;
        roles: Array<{ action: string; status: string; errorCode?: string; externalRoleName: string }>;
      };
    };
    expect(response.status).toBe(200);
    expect(payload.data.checkedCount).toBe(1);
    expect(payload.data.correctedCount).toBe(1);
    expect(payload.data.failedCount).toBe(0);
    expect(payload.data.requiresManualActionCount).toBe(0);
    const importStatement = executedStatements.find((statement) => statement.includes('INSERT INTO iam.roles'));
    expect(importStatement).toBeDefined();
    expect(importStatement).not.toContain('$1::uuid');
    expect(payload.data.roles).toEqual([
      {
        action: 'create',
        status: 'corrected',
        externalRoleName: 'custom_editor',
        roleId: targetRoleId,
        roleKey: 'custom_editor',
      },
    ]);
  });

  it('hydrates Keycloak role details during reconcile when listRoles omits attributes', async () => {
    state.listRolesImpl = () => [
      {
        id: 'kc-system_admin',
        externalName: 'system_admin',
        description: 'System administration persona',
        attributes: {},
      },
    ];
    state.getRoleByNameImpl = async (externalName: string) => {
      if (externalName !== 'system_admin') {
        return null;
      }
      return {
        id: 'kc-system_admin',
        externalName: 'system_admin',
        description: 'System administration persona',
        attributes: {
          managed_by: ['studio'],
          instance_id: ['de-musterhausen'],
          role_key: ['system_admin'],
          display_name: ['system_admin'],
          role_level: ['10'],
        },
      };
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('FROM iam.roles') && text.includes("managed_by = 'studio'")) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('INSERT INTO iam.roles') && text.includes('RETURNING id')) {
        return { rowCount: 1, rows: [{ id: targetRoleId }] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
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
        checkedCount: number;
        correctedCount: number;
        failedCount: number;
        requiresManualActionCount: number;
        roles: Array<{ action: string; status: string; errorCode?: string; externalRoleName: string }>;
      };
    };
    expect(response.status).toBe(200);
    expect(payload.data.checkedCount).toBe(1);
    expect(payload.data.correctedCount).toBe(1);
    expect(payload.data.failedCount).toBe(0);
    expect(payload.data.requiresManualActionCount).toBe(0);
    expect(payload.data.roles).toEqual([
      {
        action: 'create',
        status: 'corrected',
        externalRoleName: 'system_admin',
        roleId: targetRoleId,
        roleKey: 'system_admin',
      },
    ]);
  });

  it('hydrates Keycloak role details during reconcile when listRoles returns only partial attributes', async () => {
    state.listRolesImpl = () => [
      {
        id: 'kc-system_admin',
        externalName: 'system_admin',
        description: 'System administration persona',
        attributes: {
          role_level: ['10'],
        },
      },
    ];
    state.getRoleByNameImpl = async (externalName: string) => {
      if (externalName !== 'system_admin') {
        return null;
      }
      return {
        id: 'kc-system_admin',
        externalName: 'system_admin',
        description: 'System administration persona',
        attributes: {
          managed_by: ['studio'],
          instance_id: ['de-musterhausen'],
          role_key: ['system_admin'],
          display_name: ['system_admin'],
          role_level: ['10'],
        },
      };
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('FROM iam.roles') && text.includes("managed_by = 'studio'")) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('INSERT INTO iam.roles') && text.includes('RETURNING id')) {
        return { rowCount: 1, rows: [{ id: targetRoleId }] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
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
        checkedCount: number;
        correctedCount: number;
        failedCount: number;
        requiresManualActionCount: number;
        roles: Array<{ action: string; status: string; errorCode?: string; externalRoleName: string }>;
      };
    };
    expect(response.status).toBe(200);
    expect(payload.data.checkedCount).toBe(1);
    expect(payload.data.correctedCount).toBe(1);
    expect(payload.data.failedCount).toBe(0);
    expect(payload.data.requiresManualActionCount).toBe(0);
    expect(payload.data.roles).toEqual([
      {
        action: 'create',
        status: 'corrected',
        externalRoleName: 'system_admin',
        roleId: targetRoleId,
        roleKey: 'system_admin',
      },
    ]);
  });

  it('matches managed Keycloak roles by role_key during reconcile when external names drift', async () => {
    state.listRolesImpl = () => [
      {
        id: 'kc-admin',
        externalName: 'system_admin',
        description: 'System administration persona',
        attributes: {},
      },
    ];
    state.getRoleByNameImpl = async (externalName: string) => {
      if (externalName !== 'system_admin') {
        return null;
      }
      return {
        id: 'kc-admin',
        externalName: 'system_admin',
        description: 'System administration persona',
        attributes: {
          managed_by: ['studio'],
          instance_id: ['de-musterhausen'],
          role_key: ['mainserver_admin'],
          display_name: ['Admin'],
          role_level: ['10'],
        },
      };
    };
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
              role_key: 'mainserver_admin',
              role_name: 'mainserver_admin',
              display_name: 'Admin',
              external_role_name: 'Admin',
              description: 'System administration persona',
              is_system_role: false,
              role_level: 10,
              managed_by: 'studio',
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
            },
          ],
        };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
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
        checkedCount: number;
        correctedCount: number;
        failedCount: number;
        requiresManualActionCount: number;
        roles: Array<{ action: string; status: string; errorCode?: string; externalRoleName: string }>;
      };
    };
    expect(response.status).toBe(200);
    expect(payload.data.checkedCount).toBe(1);
    expect(payload.data.correctedCount).toBe(0);
    expect(payload.data.failedCount).toBe(0);
    expect(payload.data.requiresManualActionCount).toBe(0);
    expect(payload.data.roles).toEqual([
      {
        action: 'noop',
        status: 'synced',
        externalRoleName: 'Admin',
        roleId: targetRoleId,
        roleKey: 'mainserver_admin',
      },
    ]);
  });

  it('treats legacy editor aliases as satisfied when the canonical mainserver role already owns the Keycloak role', async () => {
    const updateRoleImpl = vi.fn();
    state.listRolesImpl = () => [
      {
        id: 'kc-mainserver-editor',
        externalName: 'Editor',
        description: 'Mainserver editor role',
        attributes: {},
      },
    ];
    state.getRoleByNameImpl = async (externalName: string) => {
      if (externalName !== 'Editor') {
        return null;
      }
      return {
        id: 'kc-mainserver-editor',
        externalName: 'Editor',
        description: 'Mainserver editor role',
        attributes: {
          managed_by: ['studio'],
          instance_id: ['de-musterhausen'],
          role_key: ['mainserver_editor'],
          display_name: ['Editor'],
          role_level: ['40'],
        },
      };
    };
    state.updateRoleImpl = updateRoleImpl;
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('FROM iam.roles') && text.includes("managed_by = 'studio'")) {
        return {
          rowCount: 2,
          rows: [
            {
              id: '30dddddd-dddd-dddd-dddd-dddddddddddd',
              role_key: 'mainserver_editor',
              role_name: 'mainserver_editor',
              display_name: 'Editor',
              external_role_name: 'Editor',
              description: 'Mainserver editor role',
              is_system_role: false,
              role_level: 40,
              managed_by: 'studio',
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
            },
            {
              id: targetRoleId,
              role_key: 'editor',
              role_name: 'editor',
              display_name: 'Editor',
              external_role_name: 'editor',
              description: 'Mainserver editor role',
              is_system_role: false,
              role_level: 30,
              managed_by: 'studio',
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
            },
          ],
        };
      }
      if (text.includes('UPDATE iam.roles') && text.includes('last_error_code = $4')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const firstResponse = await reconcileHandler(
      new Request('http://localhost/api/v1/iam/admin/reconcile', {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );
    const firstPayload = (await firstResponse.json()) as {
      data: {
        correctedCount: number;
        roles: Array<{ action: string; status: string; externalRoleName: string; roleKey?: string }>;
      };
    };

    expect(firstResponse.status).toBe(200);
    expect(firstPayload.data.correctedCount).toBe(0);
    expect(firstPayload.data.roles).toEqual([
      {
        action: 'noop',
        status: 'synced',
        externalRoleName: 'Editor',
        roleId: '30dddddd-dddd-dddd-dddd-dddddddddddd',
        roleKey: 'mainserver_editor',
      },
      {
        action: 'noop',
        status: 'synced',
        externalRoleName: 'Editor',
        roleId: targetRoleId,
        roleKey: 'editor',
      },
    ]);
    expect(updateRoleImpl).not.toHaveBeenCalled();

    const secondResponse = await reconcileHandler(
      new Request('http://localhost/api/v1/iam/admin/reconcile', {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
      })
    );
    const secondPayload = (await secondResponse.json()) as {
      data: {
        correctedCount: number;
        roles: Array<{ action: string; status: string; externalRoleName: string; roleKey?: string }>;
      };
    };

    expect(secondResponse.status).toBe(200);
    expect(secondPayload.data.correctedCount).toBe(0);
    expect(secondPayload.data.roles).toEqual([
      {
        action: 'noop',
        status: 'synced',
        externalRoleName: 'Editor',
        roleId: '30dddddd-dddd-dddd-dddd-dddddddddddd',
        roleKey: 'mainserver_editor',
      },
      {
        action: 'noop',
        status: 'synced',
        externalRoleName: 'Editor',
        roleId: targetRoleId,
        roleKey: 'editor',
      },
    ]);
    expect(updateRoleImpl).not.toHaveBeenCalled();
  });

  it('reports studio-managed Keycloak roles with incomplete metadata during reconcile', async () => {
    state.listRolesImpl = () => [
      {
        id: 'kc-custom_editor',
        externalName: 'custom_editor',
        description: 'Custom Editor',
        attributes: {
          managed_by: ['studio'],
          instance_id: ['de-musterhausen'],
          role_key: ['custom_editor'],
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
    expect(payload.data.checkedCount).toBe(1);
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

  it('reports unannotated custom Keycloak realm roles for manual review during reconcile', async () => {
    state.listRolesImpl = () => [
      {
        id: 'kc-custom_editor',
        externalName: 'custom_editor',
        description: 'Custom Editor',
        attributes: {},
        clientRole: false,
      },
      {
        id: 'kc-default',
        externalName: 'default-roles-sva-saas',
        description: 'Default realm role',
        attributes: {},
        clientRole: false,
      },
      {
        id: 'kc-offline',
        externalName: 'offline_access',
        description: 'Offline access',
        attributes: {},
        clientRole: false,
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
        roles: Array<{ action: string; status: string; errorCode?: string; externalRoleName: string; roleKey?: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.checkedCount).toBe(1);
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
          instance_id: ['de-musterhausen'],
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

  it('includes reconcile diagnostics when explicitly requested', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes("managed_by = 'studio'")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'role-1',
              role_key: 'system_admin',
              role_name: 'system_admin',
              display_name: 'System Admin',
              external_role_name: 'system_admin',
              description: 'System administration persona',
              is_system_role: true,
              role_level: 10,
              managed_by: 'studio',
              sync_state: 'synced',
              last_synced_at: null,
              last_error_code: null,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    };

    state.listRolesImpl = async () => [
      {
        externalName: 'system_admin',
        description: 'System administration persona',
        clientRole: false,
      },
    ];

    state.getRoleByNameImpl = async (externalName: string) =>
      externalName === 'system_admin'
        ? {
            externalName: 'system_admin',
            description: 'System administration persona',
            clientRole: false,
            attributes: {
              managed_by: ['studio'],
              instance_id: ['de-musterhausen'],
              role_key: ['system_admin'],
              display_name: ['System Admin'],
            },
          }
        : null;

    const response = await reconcileHandler(
      new Request('http://localhost/api/v1/iam/admin/reconcile', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          'x-debug-reconcile': '1',
          origin: 'http://localhost',
        },
        body: JSON.stringify({}),
      })
    );

    const payload = (await response.json()) as {
      data: {
        debug?: {
          instanceId: string;
          dbRoleCount: number;
          managedIdpRoleCount: number;
          importFailures?: Array<{
            roleKey?: string;
            externalRoleName: string;
            errorName: string;
            errorMessage: string;
          }>;
          dbRoleMatches: Array<{
            roleKey: string;
            externalRoleName: string;
            hasExternalNameMatch: boolean;
            hasRoleKeyMatch: boolean;
            hydratedManagedBy?: string;
            hydratedInstanceId?: string;
            hydratedRoleKey?: string;
          }>;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.debug).toEqual({
      instanceId: 'de-musterhausen',
      dbRoleCount: 1,
      listedIdpRoleCount: 1,
      hydratedIdpRoleCount: 1,
      managedIdpRoleCount: 1,
      importFailures: [],
      dbRoleMatches: [
        {
          roleKey: 'system_admin',
          externalRoleName: 'system_admin',
          hasExternalNameMatch: true,
          hasRoleKeyMatch: true,
          matchingExternalNameByRoleKey: 'system_admin',
          listedRoleFound: true,
          listedRoleHasAttributes: false,
          hydratedRoleFound: true,
          hydratedManagedBy: 'studio',
          hydratedInstanceId: 'de-musterhausen',
          hydratedRoleKey: 'system_admin',
          hydratedDisplayName: 'System Admin',
        },
      ],
    });
  });

  it('includes sanitize import failure diagnostics during reconcile when requested', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('FROM iam.roles') && text.includes("managed_by = 'studio'")) {
        return { rowCount: 0, rows: [] };
      }

      if (text.includes('current_user') && text.includes("current_setting('app.instance_id', true)")) {
        return {
          rowCount: 1,
          rows: [
            {
              current_user: 'iam_app',
              session_user: 'sva',
              current_role: 'iam_app',
              app_instance_id: 'de-musterhausen',
            },
          ],
        };
      }

      if (text.includes('INSERT INTO iam.roles') && text.includes('RETURNING id')) {
        throw new Error('insert into iam.roles failed because activity_logs is denied');
      }

      return { rowCount: 0, rows: [] };
    };

    state.listRolesImpl = async () => [
      {
        externalName: 'system_admin',
        description: 'System administration persona',
        clientRole: false,
      },
    ];

    state.getRoleByNameImpl = async (externalName: string) =>
      externalName === 'system_admin'
        ? {
            externalName: 'system_admin',
            description: 'System administration persona',
            clientRole: false,
            attributes: {
              managed_by: ['studio'],
              instance_id: ['de-musterhausen'],
              role_key: ['system_admin'],
              display_name: ['System Admin'],
              role_level: ['10'],
            },
          }
        : null;

    const response = await reconcileHandler(
      new Request('http://localhost/api/v1/iam/admin/reconcile', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          'x-debug-reconcile': '1',
          origin: 'http://localhost',
        },
        body: JSON.stringify({}),
      })
    );

    const payload = (await response.json()) as {
      data: {
        debug?: {
          importFailures?: Array<{
            roleKey?: string;
            externalRoleName: string;
            errorName: string;
            errorMessage: string;
            dbContext?: {
              currentUser?: string;
              sessionUser?: string;
              currentRole?: string;
              appInstanceId?: string;
            };
          }>;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.debug?.importFailures).toEqual([
      {
        roleKey: 'system_admin',
        externalRoleName: 'system_admin',
        errorName: 'Error',
        errorMessage: 'insert into iam.roles failed because activity_logs is denied',
        dbContext: {
          currentUser: 'iam_app',
          sessionUser: 'sva',
          currentRole: 'iam_app',
          appInstanceId: 'de-musterhausen',
        },
      },
    ]);
  });

  it('creates a user successfully on happy path', async () => {
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('INSERT INTO iam.idempotency_keys')) {
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

  it('compensates externally created users when createUser fails after Keycloak provisioning', async () => {
    state.createUserImpl = async () => ({ externalId: 'created-external-user' });
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('INSERT INTO iam.idempotency_keys')) {
        return { rowCount: 1, rows: [{ status: 'IN_PROGRESS' }] };
      }

      if (text.includes('INSERT INTO iam.accounts')) {
        throw new Error('db_write_failed');
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
          'idempotency-key': 'user-create-compensation',
        },
        body: JSON.stringify({
          email: 'new.user@example.com',
          firstName: 'New',
          lastName: 'User',
          roleIds: [],
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe('internal_error');
    expect(state.deactivateUserCalls).toEqual(['created-external-user']);
  });

  it('syncs external role names when creating a user', async () => {
    const createRoleCalls: Array<{ externalName: string; description?: string; attributes: Record<string, string> }> = [];
    state.getRoleByNameImpl = async (externalName: string) =>
      externalName === 'Admin' ? null : { id: `kc-${externalName}`, externalName };
    state.createRoleImpl = async (input) => {
      createRoleCalls.push(input);
      return { id: `kc-${input.externalName}`, externalName: input.externalName, attributes: input.attributes };
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('SELECT id, role_key, role_name, display_name, external_role_name') && text.includes('AND id = ANY($2::uuid[])')) {
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

      if (text.includes('FROM iam.roles') && text.includes('COALESCE(external_role_name, role_key) = ANY')) {
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

      if (text.includes('INSERT INTO iam.idempotency_keys')) {
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
    expect(createRoleCalls).toEqual([
      {
        externalName: 'Admin',
        description: undefined,
        attributes: {
          managedBy: 'studio',
          instanceId: 'de-musterhausen',
          roleKey: 'mainserver_admin',
          displayName: 'Admin',
        },
      },
    ]);
  });

  it('returns idempotent replay response for createUser', async () => {
    const rawBody = JSON.stringify({
      email: 'new.user@example.com',
      firstName: 'Replay',
      lastName: 'User',
      roleIds: [],
    });
    const payloadHash = toPayloadHash(rawBody);

    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
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
        body: rawBody,
      })
    );

    const payload = (await response.json()) as { data: { id: string; email: string } };
    expect(response.status).toBe(201);
    expect(payload.data.id).toBe('replayed-user');
    expect(payload.data.email).toBe('new.user@example.com');
  });

  it('rejects createUser when the idempotency key is reused with a different payload', async () => {
    const rawBody = JSON.stringify({
      email: 'conflict@example.com',
      firstName: 'Conflict',
      lastName: 'Case',
      roleIds: [],
    });
    const payloadHash = toPayloadHash(rawBody);

    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('SELECT status, payload_hash, response_status, response_body')) {
        return {
          rowCount: 1,
          rows: [
            {
              status: 'COMPLETED',
              payload_hash: `${payloadHash}-other`,
              response_status: null,
              response_body: null,
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
          'idempotency-key': 'user-create-conflict',
        },
        body: rawBody,
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: 'idempotency_key_reuse',
        message: 'Idempotency-Key wurde bereits mit anderem Payload verwendet.',
      },
      requestId: 'req-iam-handler',
    });
  });

  it('rejects createUser while an idempotent request is still in progress', async () => {
    const rawBody = JSON.stringify({
      email: 'in-progress@example.com',
      firstName: 'In',
      lastName: 'Progress',
      roleIds: [],
    });
    const payloadHash = toPayloadHash(rawBody);

    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('SELECT status, payload_hash, response_status, response_body')) {
        return {
          rowCount: 1,
          rows: [
            {
              status: 'IN_PROGRESS',
              payload_hash: payloadHash,
              response_status: null,
              response_body: null,
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
          'idempotency-key': 'user-create-in-progress',
        },
        body: rawBody,
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: 'idempotency_key_reuse',
        message: 'Idempotenter Request wird bereits verarbeitet.',
      },
      requestId: 'req-iam-handler',
    });
  });

  it('syncs external role names when updating a user', async () => {
    const createRoleCalls: Array<{ externalName: string; description?: string; attributes: Record<string, string> }> = [];
    state.getRoleByNameImpl = async (externalName: string) =>
      externalName === 'Admin' ? null : { id: `kc-${externalName}`, externalName };
    state.createRoleImpl = async (input) => {
      createRoleCalls.push(input);
      return { id: `kc-${input.externalName}`, externalName: input.externalName, attributes: input.attributes };
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id') && text.includes('WHERE a.keycloak_subject = $2')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa' }] };
      }

      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }

      if (text.includes('SELECT id, role_key, role_name, display_name, external_role_name') && text.includes('AND id = ANY($2::uuid[])')) {
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

      if (text.includes('FROM iam.roles') && text.includes('COALESCE(external_role_name, role_key) = ANY')) {
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
    expect(createRoleCalls).toEqual([
      {
        externalName: 'Admin',
        description: undefined,
        attributes: {
          managedBy: 'studio',
          instanceId: 'de-musterhausen',
          roleKey: 'mainserver_admin',
          displayName: 'Admin',
        },
      },
    ]);
  });

  it('maps role sync failures during user updates to keycloak_unavailable', async () => {
    state.syncRolesImpl = async () => {
      throw new KeycloakAdminRequestError({
        message: 'realm-management missing',
        statusCode: 503,
        code: 'read_timeout',
        retryable: true,
      });
    };

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

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: 'keycloak_unavailable',
        message: 'Nutzerrollen konnten nicht mit Keycloak synchronisiert werden.',
        details: {
          syncState: 'failed',
          syncError: { code: 'IDP_TIMEOUT' },
        },
      },
      requestId: 'req-iam-handler',
    });
  });
});

describe('iam-account-management additional handlers', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    delete process.env.IAM_UI_ENABLED;
    delete process.env.IAM_ADMIN_ENABLED;
    delete process.env.IAM_BULK_ENABLED;
    delete process.env.IAM_DEBUG_PROFILE_ERRORS;
    delete process.env.IAM_PII_ALLOW_PLAINTEXT_FALLBACK;
    delete process.env.IAM_PII_ACTIVE_KEY_ID;
    delete process.env.IAM_PII_KEYRING_JSON;

    state.user = {
      id: `keycloak-admin-${Date.now()}`,
      name: 'Admin User',
      roles: ['system_admin'],
      instanceId: 'de-musterhausen',
    };
    state.queryHandler = null;
    state.timelineEvents = [];
    state.timelineError = null;
    state.redisAvailable = true;
    state.listRolesImpl = null;
    state.createUserImpl = null;
    state.deactivateUserCalls = [];
  });

  it('returns the current user profile', async () => {
    const selfAccountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    state.user = {
      id: 'keycloak-self-1',
      name: 'Self User',
      roles: ['member'],
      instanceId: 'de-musterhausen',
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id')) {
        return { rowCount: 1, rows: [{ account_id: selfAccountId }] };
      }
      if (text.includes('WHERE a.id = $2::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              ...buildUserDetailRow('active'),
              id: selfAccountId,
              keycloak_subject: 'keycloak-self-1',
              display_name_ciphertext: 'Self User',
              email_ciphertext: 'self.user@example.com',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await getMyProfileHandler(
      new Request('http://localhost/api/v1/iam/users/me', { method: 'GET' })
    );
    const payload = (await response.json()) as { data: { id: string; keycloakSubject: string } };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual(
      expect.objectContaining({
        id: selfAccountId,
        keycloakSubject: 'keycloak-self-1',
      })
    );
  });

  it('rejects getMyProfile when iam ui features are disabled', async () => {
    process.env.IAM_UI_ENABLED = 'false';

    const response = await getMyProfileHandler(
      new Request('http://localhost/api/v1/iam/users/me', { method: 'GET' })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('feature_disabled');
  });

  it('returns not_found when the current profile cannot be resolved', async () => {
    const selfAccountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    state.user = {
      id: 'keycloak-self-missing',
      name: 'Self User',
      roles: ['member'],
      instanceId: 'de-musterhausen',
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id')) {
        return { rowCount: 1, rows: [{ account_id: selfAccountId }] };
      }
      if (text.includes('WHERE a.id = $2::uuid')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await getMyProfileHandler(
      new Request('http://localhost/api/v1/iam/users/me', { method: 'GET' })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('not_found');
  });

  it('returns database_unavailable when resolving the current profile fails early', async () => {
    state.user = {
      id: 'keycloak-self-failure',
      name: 'Self User',
      roles: ['member'],
      instanceId: 'de-musterhausen',
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] };
      }
      throw new Error('db unavailable');
    };

    const response = await getMyProfileHandler(
      new Request('http://localhost/api/v1/iam/users/me', { method: 'GET' })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('database_unavailable');
  });

  it('adds self-service diagnostics when profile actor resolution fails before the query', async () => {
    process.env.IAM_DEBUG_PROFILE_ERRORS = 'true';
    state.user = {
      id: 'keycloak-self-no-instance',
      name: 'Self User',
      roles: ['member'],
    };

    const response = await getMyProfileHandler(
      new Request('http://localhost/api/v1/iam/users/me/profile', { method: 'GET' })
    );
    const payload = (await response.json()) as {
      error: {
        code: string;
        details?: {
          diagnostic_stage?: string;
          reason_code?: string;
          session_instance_id?: string | null;
          session_roles?: string[];
          session_roles_count?: number;
          session_user_id?: string;
        };
      };
      requestId?: string;
    };

    expect(response.status).toBe(400);
    expect(response.headers.get('X-Request-Id')).toBe('req-iam-handler');
    expect(payload.requestId).toBe('req-iam-handler');
    expect(payload.error.code).toBe('invalid_instance_id');
    expect(payload.error.details).toEqual(
      expect.objectContaining({
        diagnostic_stage: 'actor_resolution',
        reason_code: 'invalid_instance_id',
        session_instance_id: null,
        session_roles: ['member'],
        session_roles_count: 1,
        session_user_id: 'keycloak-self-no-instance',
      })
    );
  });

  it('returns a platform self-service profile for root-host admins without tenant instance scope', async () => {
    state.user = {
      id: 'keycloak-platform-admin',
      name: 'Platform Admin',
      roles: ['system_admin', 'instance_registry_admin'],
      username: 'studio-superuser',
      email: 'studio@example.com',
      firstName: 'Studio',
      lastName: 'Superuser',
      displayName: 'Studio Superuser',
    };

    const response = await getMyProfileHandler(
      new Request('http://localhost/api/v1/iam/users/me/profile', { method: 'GET' })
    );
    const payload = (await response.json()) as {
      data: {
        id: string;
        keycloakSubject: string;
        status: string;
        roles: Array<{ roleKey: string }>;
      };
      requestId?: string;
    };

    expect(response.status).toBe(200);
    expect(payload.requestId).toBe('req-iam-handler');
    expect(payload.data).toEqual(
      expect.objectContaining({
        id: 'platform:keycloak-platform-admin',
        keycloakSubject: 'keycloak-platform-admin',
        status: 'active',
      })
    );
    expect(payload.data.roles.map((role) => role.roleKey)).toEqual([
      'system_admin',
      'instance_registry_admin',
    ]);
  });

  it('returns schema_drift details when profile loading fails with unexpected internal error and critical schema drift is present', async () => {
    state.user = {
      id: 'keycloak-self-schema-drift',
      name: 'Self User',
      roles: ['member'],
      instanceId: 'de-musterhausen',
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('WHERE a.id = $2::uuid')) {
        throw new Error('unexpected profile query failure');
      }
      if (text.includes("to_regclass('iam.groups')")) {
        return {
          rowCount: 1,
          rows: [
            {
              groups_exists: true,
              group_roles_exists: true,
              account_groups_exists: true,
              account_groups_origin_column_exists: false,
              activity_logs_exists: true,
              platform_activity_logs_exists: false,
              accounts_avatar_url_column_exists: true,
              accounts_instance_id_column_exists: true,
              accounts_username_ciphertext_column_exists: true,
              accounts_notes_column_exists: true,
              accounts_preferred_language_column_exists: true,
              accounts_timezone_column_exists: true,
              instance_hostnames_exists: true,
              instance_hostnames_rls_disabled: true,
              instances_primary_hostname_column_exists: true,
              instances_auth_realm_column_exists: true,
              instances_auth_client_id_column_exists: true,
              instances_auth_issuer_url_column_exists: true,
              instances_auth_client_secret_ciphertext_column_exists: true,
              instances_rls_disabled: true,
              instances_tenant_admin_username_column_exists: true,
              instances_tenant_admin_email_column_exists: true,
              instances_tenant_admin_first_name_column_exists: true,
              instances_tenant_admin_last_name_column_exists: true,
              instances_tenant_admin_client_id_column_exists: true,
              instances_tenant_admin_client_secret_ciphertext_column_exists: true,
              idx_accounts_kc_subject_instance_exists: true,
              accounts_isolation_policy_matches: true,
              instance_memberships_isolation_policy_matches: true,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await getMyProfileHandler(
      new Request('http://localhost/api/v1/iam/users/me', { method: 'GET' })
    );
    const payload = (await response.json()) as {
      error: {
        code: string;
        details?: {
          dependency?: string;
          expected_migration?: string;
          instance_id?: string;
          reason_code?: string;
          schema_object?: string;
        };
      };
    };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('database_unavailable');
    expect(payload.error.details).toEqual(
      expect.objectContaining({
        dependency: 'database',
        expected_migration: '0028_iam_platform_activity_logs.sql',
        instance_id: 'de-musterhausen',
        reason_code: 'schema_drift',
        schema_object: 'iam.platform_activity_logs',
      })
    );
  });

  it('adds self-service diagnostics to profile fetch failures when debug mode is enabled', async () => {
    process.env.IAM_DEBUG_PROFILE_ERRORS = 'true';
    state.user = {
      id: 'keycloak-self-debug',
      name: 'Self User',
      roles: ['member'],
      instanceId: 'de-musterhausen',
    };
    state.queryHandler = (text) => {
      if (
        text === 'BEGIN' ||
        text === 'COMMIT' ||
        text === 'ROLLBACK' ||
        text === 'SET LOCAL ROLE iam_app;' ||
        text.includes('SELECT set_config')
      ) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('SELECT a.id AS account_id')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] };
      }
      throw new Error('profile debug failure');
    };

    const response = await getMyProfileHandler(
      new Request('http://localhost/api/v1/iam/users/me/profile', { method: 'GET' })
    );
    const payload = (await response.json()) as {
      error: {
        code: string;
        details?: {
          actor_account_id?: string | null;
          actor_account_id_present?: boolean;
          actor_instance_id?: string;
          debug_error_message?: string;
          diagnostic_stage?: string;
          session_instance_id?: string | null;
          session_roles?: string[];
          session_roles_count?: number;
          session_user_id?: string;
        };
      };
      requestId?: string;
    };

    expect(response.status).toBe(500);
    expect(response.headers.get('X-Request-Id')).toBe('req-iam-handler');
    expect(payload.requestId).toBe('req-iam-handler');
    expect(payload.error.code).toBe('internal_error');
    expect(payload.error.details).toEqual(
      expect.objectContaining({
        actor_account_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        actor_account_id_present: true,
        actor_instance_id: 'de-musterhausen',
        debug_error_message: 'profile debug failure',
        diagnostic_stage: 'load_profile_detail',
        session_instance_id: 'de-musterhausen',
        session_roles: ['member'],
        session_roles_count: 1,
        session_user_id: 'keycloak-self-debug',
      })
    );
  });

  it('jit-provisions self-service profiles without writing jit activity logs', async () => {
    let actorLookupCount = 0;
    let activityLogInserts = 0;
    state.user = {
      id: 'keycloak-self-jit',
      name: 'Self User',
      roles: ['member'],
      instanceId: 'de-musterhausen',
    };
    state.queryHandler = (text) => {
      if (
        text === 'BEGIN' ||
        text === 'COMMIT' ||
        text === 'ROLLBACK' ||
        text.includes('SELECT set_config')
      ) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('SELECT a.id AS account_id')) {
        actorLookupCount += 1;
        if (actorLookupCount === 1) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('INSERT INTO iam.accounts') && text.includes("VALUES ($1, $2, 'pending')")) {
        return {
          rowCount: 1,
          rows: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', created: true }],
        };
      }
      if (text.includes('INSERT INTO iam.instance_memberships')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        activityLogInserts += 1;
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('WHERE a.id = $2::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              keycloak_subject: 'keycloak-self-jit',
              username_ciphertext: null,
              email_ciphertext: null,
              first_name_ciphertext: null,
              last_name_ciphertext: null,
              display_name_ciphertext: null,
              phone_ciphertext: null,
              avatar_url: null,
              position: null,
              department: null,
              preferred_language: null,
              timezone: null,
              notes: null,
              status: 'pending',
              roles: [],
              permissions: [],
              groups: [],
              mainserver_user_application_secret_set: false,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await getMyProfileHandler(
      new Request('http://localhost/api/v1/iam/users/me/profile', { method: 'GET' })
    );
    const payload = (await response.json()) as {
      data: { id: string; status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual(
      expect.objectContaining({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        status: 'pending',
      })
    );
    expect(activityLogInserts).toBe(0);
  });

  it('updates the current user profile', async () => {
    const selfAccountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    state.user = {
      id: 'keycloak-self-2',
      name: 'Self User',
      roles: ['member'],
      instanceId: 'de-musterhausen',
    };

    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id')) {
        return { rowCount: 1, rows: [{ account_id: selfAccountId }] };
      }
      if (text.includes('UPDATE iam.accounts')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('WHERE a.id = $2::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              ...buildUserDetailRow('active'),
              id: selfAccountId,
              keycloak_subject: 'keycloak-self-2',
              username_ciphertext: 'self.updated',
              display_name_ciphertext: 'Updated Self User',
              email_ciphertext: 'self.updated@example.com',
              first_name_ciphertext: 'Updated',
              last_name_ciphertext: 'Self',
              preferred_language: 'de',
              timezone: 'Europe/Berlin',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await updateMyProfileHandler(
      new Request('http://localhost/api/v1/iam/users/me', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          username: 'self.updated',
          email: 'self.updated@example.com',
          firstName: 'Updated',
          lastName: 'Self',
          displayName: 'Updated Self User',
          preferredLanguage: 'de',
          timezone: 'Europe/Berlin',
        }),
      })
    );
    const payload = (await response.json()) as { data: { displayName: string; keycloakSubject: string } };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual(
      expect.objectContaining({
        displayName: 'Updated Self User',
        keycloakSubject: 'keycloak-self-2',
      })
    );
    expect(state.updateUserCalls).toEqual([
      {
        externalId: 'keycloak-self-2',
        input: {
          username: 'self.updated',
          email: 'self.updated@example.com',
          firstName: 'Updated',
          lastName: 'Self',
          attributes: {
            displayName: 'Updated Self User',
          },
        },
      },
    ]);
  });

  it('rejects updateMyProfile when iam ui features are disabled', async () => {
    process.env.IAM_UI_ENABLED = 'false';

    const response = await updateMyProfileHandler(
      new Request('http://localhost/api/v1/iam/users/me', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          displayName: 'Blocked',
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('feature_disabled');
  });

  it('bulk-deactivates users and invalidates permission snapshots', async () => {
    process.env.IAM_BULK_ENABLED = 'true';
    const executedStatements: string[] = [];
    state.queryHandler = (text) => {
      executedStatements.push(text);
      if (text.includes('SELECT a.id AS account_id')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('DELETE FROM iam.idempotency_keys')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('INSERT INTO iam.idempotency_keys')) {
        return { rowCount: 1, rows: [{ status: 'IN_PROGRESS' }] };
      }
      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }
      if (text.includes('WHERE a.id = ANY($2::uuid[])')) {
        return { rowCount: 1, rows: [buildBulkUserRow()] };
      }
      if (text.includes("UPDATE iam.accounts") && text.includes("status = 'inactive'")) {
        return { rowCount: 1, rows: [] };
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

    const response = await bulkDeactivateUsersHandler(
      new Request('http://localhost/api/v1/iam/users/bulk-deactivate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'bulk-deactivate-1',
        },
        body: JSON.stringify({
          userIds: [targetUserId],
        }),
      })
    );
    const payload = (await response.json()) as { data: { count: number; deactivatedUserIds: string[] } };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      count: 1,
      deactivatedUserIds: [targetUserId],
    });
    expect(state.deactivateUserCalls).toEqual(['keycloak-target-2']);
    expect(executedStatements.some((statement) => statement.includes('SELECT pg_notify'))).toBe(true);
  });

  it('rejects bulk deactivation when iam bulk features are disabled', async () => {
    process.env.IAM_BULK_ENABLED = 'false';

    const response = await bulkDeactivateUsersHandler(
      new Request('http://localhost/api/v1/iam/users/bulk-deactivate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'feature-disabled-bulk',
        },
        body: JSON.stringify({
          userIds: [targetUserId],
        }),
      })
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('feature_disabled');
  });

  it('protects against bulk self-deactivation', async () => {
    process.env.IAM_BULK_ENABLED = 'true';
    state.user = {
      id: 'keycloak-self-protect',
      name: 'Self Protect',
      roles: ['system_admin'],
      instanceId: 'de-musterhausen',
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id')) {
        return { rowCount: 1, rows: [{ account_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] };
      }
      if (text.includes('DELETE FROM iam.idempotency_keys')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('INSERT INTO iam.idempotency_keys')) {
        return { rowCount: 1, rows: [{ status: 'IN_PROGRESS' }] };
      }
      if (text.includes('max_role_level') && text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ max_role_level: 90 }] };
      }
      if (text.includes('WHERE a.id = ANY($2::uuid[])')) {
        return {
          rowCount: 1,
          rows: [
            buildBulkUserRow({
              id: targetUserId,
              keycloakSubject: 'keycloak-self-protect',
            }),
          ],
        };
      }
      if (text.includes('UPDATE iam.idempotency_keys')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await bulkDeactivateUsersHandler(
      new Request('http://localhost/api/v1/iam/users/bulk-deactivate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'http://localhost',
          'idempotency-key': 'bulk-deactivate-self',
        },
        body: JSON.stringify({
          userIds: [targetUserId],
        }),
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: 'self_protection',
        message: 'Eigener Nutzer kann nicht deaktiviert werden.',
      },
      requestId: 'req-iam-handler',
    });
    expect(state.deactivateUserCalls).toEqual([]);
  });

  it('returns readiness details for healthy dependencies', async () => {
    vi.resetModules();
    state.redisAvailable = true;
    state.listRolesImpl = async () => [];
    state.queryHandler = (text) => {
      if (text.includes('SELECT 1;')) {
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      }
      if (text.includes("to_regclass('iam.groups')")) {
        return {
          rowCount: 1,
          rows: [
            {
              groups_exists: true,
              group_roles_exists: true,
              account_groups_exists: true,
              account_groups_origin_column_exists: true,
              activity_logs_exists: true,
              platform_activity_logs_exists: true,
              accounts_avatar_url_column_exists: true,
              accounts_instance_id_column_exists: true,
              accounts_username_ciphertext_column_exists: true,
              accounts_notes_column_exists: true,
              accounts_preferred_language_column_exists: true,
              accounts_timezone_column_exists: true,
              instance_hostnames_exists: true,
              instance_hostnames_rls_disabled: true,
              instances_primary_hostname_column_exists: true,
              instances_auth_realm_column_exists: true,
              instances_auth_client_id_column_exists: true,
              instances_auth_issuer_url_column_exists: true,
              instances_auth_client_secret_ciphertext_column_exists: true,
              instances_rls_disabled: true,
              instances_tenant_admin_username_column_exists: true,
              instances_tenant_admin_email_column_exists: true,
              instances_tenant_admin_first_name_column_exists: true,
              instances_tenant_admin_last_name_column_exists: true,
              instances_tenant_admin_client_id_column_exists: true,
              instances_tenant_admin_client_secret_ciphertext_column_exists: true,
              idx_accounts_kc_subject_instance_exists: true,
              accounts_isolation_policy_matches: true,
              instance_memberships_isolation_policy_matches: true,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const { healthReadyHandler: freshHealthReadyHandler } = await import('./iam-account-management.server');
    const response = await freshHealthReadyHandler(
      new Request('http://localhost/api/v1/iam/health/ready', { method: 'GET' })
    );
    const payload = (await response.json()) as {
      status: string;
      checks: { db: boolean; redis: boolean; keycloak: boolean; errors: Record<string, string> };
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        status: 'ready',
        checks: expect.objectContaining({
          auth: {
            activeRealm: 'svs-intern-studio-staging',
            realm: 'svs-intern-studio-staging',
            scopeKind: 'platform',
            platformAdmin: {
              realm: 'svs-intern-studio-staging',
              clientId: 'platform-admin-client',
              configured: true,
              executionMode: 'platform_admin',
            },
          },
          db: true,
          redis: true,
          keycloak: true,
          errors: {},
          authorizationCache: expect.objectContaining({
            status: 'ready',
          }),
          services: expect.objectContaining({
            authorizationCache: expect.objectContaining({ status: 'ready' }),
            database: expect.objectContaining({ status: 'ready' }),
            keycloak: expect.objectContaining({ status: 'ready' }),
            redis: expect.objectContaining({ status: 'ready' }),
          }),
        }),
      })
    );
  });

  it('returns degraded when authorization cache exceeds latency threshold', async () => {
    vi.resetModules();
    state.redisAvailable = true;
    state.permissionCacheHealth = {
      status: 'degraded',
      coldStart: true,
      lastRedisLatencyMs: 77,
      recomputePerMinute: 3,
      consecutiveRedisFailures: 0,
    };
    state.listRolesImpl = async () => [];
    state.queryHandler = (text) => {
      if (text.includes('SELECT 1;')) {
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      }
      if (text.includes("to_regclass('iam.groups')")) {
        return {
          rowCount: 1,
          rows: [
            {
              groups_exists: true,
              group_roles_exists: true,
              account_groups_exists: true,
              account_groups_origin_column_exists: true,
              activity_logs_exists: true,
              platform_activity_logs_exists: true,
              accounts_avatar_url_column_exists: true,
              accounts_instance_id_column_exists: true,
              accounts_username_ciphertext_column_exists: true,
              accounts_notes_column_exists: true,
              accounts_preferred_language_column_exists: true,
              accounts_timezone_column_exists: true,
              instance_hostnames_exists: true,
              instance_hostnames_rls_disabled: true,
              instances_primary_hostname_column_exists: true,
              instances_auth_realm_column_exists: true,
              instances_auth_client_id_column_exists: true,
              instances_auth_issuer_url_column_exists: true,
              instances_auth_client_secret_ciphertext_column_exists: true,
              instances_rls_disabled: true,
              instances_tenant_admin_username_column_exists: true,
              instances_tenant_admin_email_column_exists: true,
              instances_tenant_admin_first_name_column_exists: true,
              instances_tenant_admin_last_name_column_exists: true,
              instances_tenant_admin_client_id_column_exists: true,
              instances_tenant_admin_client_secret_ciphertext_column_exists: true,
              idx_accounts_kc_subject_instance_exists: true,
              accounts_isolation_policy_matches: true,
              instance_memberships_isolation_policy_matches: true,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const { healthReadyHandler: freshHealthReadyHandler } = await import('./iam-account-management.server');
    const response = await freshHealthReadyHandler(
      new Request('http://localhost/api/v1/iam/health/ready', { method: 'GET' })
    );
    const payload = (await response.json()) as {
      status: string;
      checks: { authorizationCache: { status: string; coldStart: boolean; lastRedisLatencyMs: number } };
    };

    expect(response.status).toBe(200);
    expect(payload.status).toBe('degraded');
    expect(payload.checks).toEqual(
      expect.objectContaining({
        auth: {
          realm: 'svs-intern-studio-staging',
          activeRealm: 'svs-intern-studio-staging',
          scopeKind: 'platform',
          platformAdmin: {
            realm: 'svs-intern-studio-staging',
            clientId: 'platform-admin-client',
            configured: true,
            executionMode: 'platform_admin',
          },
        },
      })
    );
    expect(payload.checks.authorizationCache).toEqual(
      expect.objectContaining({
        status: 'degraded',
        coldStart: true,
        lastRedisLatencyMs: 77,
      })
    );
  });

  it('derives the runtime auth realm from the issuer when the explicit realm is missing', async () => {
    vi.resetModules();
    state.redisAvailable = true;
    state.runtimeAuthRealm = undefined as never;
    state.runtimeAuthIssuer = 'https://keycloak.local/realms/platform-root';
    delete process.env.KEYCLOAK_ADMIN_REALM;
    process.env.SVA_AUTH_ISSUER = state.runtimeAuthIssuer;
    state.listRolesImpl = async () => [];
    state.queryHandler = (text) => {
      if (text.includes('SELECT 1;')) {
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      }
      if (text.includes("to_regclass('iam.groups')")) {
        return {
          rowCount: 1,
          rows: [
            {
              groups_exists: true,
              group_roles_exists: true,
              account_groups_exists: true,
              account_groups_origin_column_exists: true,
              activity_logs_exists: true,
              platform_activity_logs_exists: true,
              accounts_avatar_url_column_exists: true,
              accounts_instance_id_column_exists: true,
              accounts_username_ciphertext_column_exists: true,
              accounts_notes_column_exists: true,
              accounts_preferred_language_column_exists: true,
              accounts_timezone_column_exists: true,
              instance_hostnames_exists: true,
              instance_hostnames_rls_disabled: true,
              instances_primary_hostname_column_exists: true,
              instances_auth_realm_column_exists: true,
              instances_auth_client_id_column_exists: true,
              instances_auth_issuer_url_column_exists: true,
              instances_auth_client_secret_ciphertext_column_exists: true,
              instances_rls_disabled: true,
              instances_tenant_admin_username_column_exists: true,
              instances_tenant_admin_email_column_exists: true,
              instances_tenant_admin_first_name_column_exists: true,
              instances_tenant_admin_last_name_column_exists: true,
              instances_tenant_admin_client_id_column_exists: true,
              instances_tenant_admin_client_secret_ciphertext_column_exists: true,
              idx_accounts_kc_subject_instance_exists: true,
              accounts_isolation_policy_matches: true,
              instance_memberships_isolation_policy_matches: true,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const { healthReadyHandler: freshHealthReadyHandler } = await import('./iam-account-management.server');
    const response = await freshHealthReadyHandler(
      new Request('http://localhost/api/v1/iam/health/ready', { method: 'GET' })
    );
    const payload = (await response.json()) as {
      checks: {
        auth: {
          realm?: string;
          activeRealm?: string;
          scopeKind?: string;
          platformAdmin?: {
            realm?: string;
            clientId?: string;
            configured: boolean;
            executionMode: 'platform_admin';
          };
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.checks.auth.realm).toBe('platform-root');
    expect(payload.checks.auth.activeRealm).toBe('platform-root');
    expect(payload.checks.auth.scopeKind).toBe('platform');
    expect(payload.checks.auth.platformAdmin).toEqual({
      realm: 'platform-root',
      clientId: 'platform-admin-client',
      configured: true,
      executionMode: 'platform_admin',
    });
  });

  it('reports the tenant realm as active realm on tenant hosts', async () => {
    vi.resetModules();
    state.redisAvailable = true;
    process.env.KEYCLOAK_ADMIN_REALM = 'svs-intern-studio-staging';
    process.env.SVA_AUTH_ISSUER = 'https://keycloak.local/realms/svs-intern-studio-staging';
    state.instanceByHostname = {
      instanceId: 'de-musterhausen',
      primaryHostname: 'de-musterhausen.studio.smart-village.app',
      status: 'active',
      authRealm: 'de-musterhausen',
      authClientId: 'sva-studio',
      tenantAdminClient: {
        clientId: 'sva-studio-admin',
        secretConfigured: true,
      },
    };
    state.listRolesImpl = async () => [];
    state.queryHandler = (text) => {
      if (text.includes('SELECT 1;')) {
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      }
      if (text.includes("to_regclass('iam.groups')")) {
        return {
          rowCount: 1,
          rows: [
            {
              groups_exists: true,
              group_roles_exists: true,
              account_groups_exists: true,
              account_groups_origin_column_exists: true,
              activity_logs_exists: true,
              platform_activity_logs_exists: true,
              accounts_avatar_url_column_exists: true,
              accounts_instance_id_column_exists: true,
              accounts_username_ciphertext_column_exists: true,
              accounts_notes_column_exists: true,
              accounts_preferred_language_column_exists: true,
              accounts_timezone_column_exists: true,
              instance_hostnames_exists: true,
              instance_hostnames_rls_disabled: true,
              instances_primary_hostname_column_exists: true,
              instances_auth_realm_column_exists: true,
              instances_auth_client_id_column_exists: true,
              instances_auth_issuer_url_column_exists: true,
              instances_auth_client_secret_ciphertext_column_exists: true,
              instances_rls_disabled: true,
              instances_tenant_admin_username_column_exists: true,
              instances_tenant_admin_email_column_exists: true,
              instances_tenant_admin_first_name_column_exists: true,
              instances_tenant_admin_last_name_column_exists: true,
              instances_tenant_admin_client_id_column_exists: true,
              instances_tenant_admin_client_secret_ciphertext_column_exists: true,
              idx_accounts_kc_subject_instance_exists: true,
              accounts_isolation_policy_matches: true,
              instance_memberships_isolation_policy_matches: true,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const { healthReadyHandler: freshHealthReadyHandler } = await import('./iam-account-management.server');
    const response = await freshHealthReadyHandler(
      new Request('http://de-musterhausen.studio.smart-village.app/api/v1/iam/health/ready', { method: 'GET' })
    );
    const payload = (await response.json()) as {
      checks: {
        auth: {
          realm?: string;
          activeRealm?: string;
          scopeKind?: string;
          login?: {
            realm?: string;
            clientId?: string;
            configured: boolean;
          };
          tenantAdmin?: {
            realm?: string;
            clientId?: string;
            configured: boolean;
            secretConfigured: boolean;
            executionMode: 'tenant_admin';
            fallbackToLoginClient: boolean;
          };
          platformAdmin?: {
            realm?: string;
            clientId?: string;
            configured: boolean;
            executionMode: 'platform_admin';
          };
          breakGlass?: {
            realm?: string;
            clientId?: string;
            configured: boolean;
            executionMode: 'break_glass';
          };
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.checks.auth.realm).toBe('svs-intern-studio-staging');
    expect(payload.checks.auth.activeRealm).toBe('de-musterhausen');
    expect(payload.checks.auth.scopeKind).toBe('instance');
    expect(payload.checks.auth.login).toEqual({
      realm: 'de-musterhausen',
      clientId: 'sva-studio',
      configured: true,
    });
    expect(payload.checks.auth.tenantAdmin).toEqual({
      realm: 'de-musterhausen',
      clientId: 'sva-studio-admin',
      configured: true,
      secretConfigured: true,
      executionMode: 'tenant_admin',
      fallbackToLoginClient: false,
    });
    expect(payload.checks.auth.platformAdmin).toEqual({
      realm: 'svs-intern-studio-staging',
      clientId: 'platform-admin-client',
      configured: true,
      executionMode: 'platform_admin',
    });
    expect(payload.checks.auth.breakGlass).toEqual({
      realm: 'de-musterhausen',
      clientId: 'platform-admin-client',
      configured: true,
      executionMode: 'break_glass',
    });
  });

  it('returns not_ready when dependencies fail', async () => {
    vi.resetModules();
    state.redisAvailable = false;
    state.permissionCacheHealth = {
      status: 'ready',
      coldStart: false,
      lastRedisLatencyMs: 12,
      recomputePerMinute: 0,
      consecutiveRedisFailures: 0,
    };
    state.listRolesImpl = async () => {
      throw new Error('keycloak down');
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT 1;')) {
        throw new Error('db down');
      }
      if (text.includes("to_regclass('iam.groups')")) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const { healthReadyHandler: freshHealthReadyHandler } = await import('./iam-account-management.server');
    const response = await freshHealthReadyHandler(
      new Request('http://localhost/api/v1/iam/health/ready', { method: 'GET' })
    );
    const payload = (await response.json()) as {
      status: string;
      checks: { db: boolean; redis: boolean; keycloak: boolean };
    };

    expect(response.status).toBe(503);
    expect(payload).toEqual(
      expect.objectContaining({
        status: 'not_ready',
        checks: expect.objectContaining({
          db: false,
          redis: false,
          keycloak: false,
          services: expect.objectContaining({
            authorizationCache: expect.objectContaining({ status: 'ready' }),
            database: expect.objectContaining({
              reasonCode: 'database_connection_failed',
              status: 'not_ready',
            }),
            keycloak: expect.objectContaining({
              reasonCode: 'keycloak_dependency_failed',
              status: 'not_ready',
            }),
            redis: expect.objectContaining({
              reasonCode: 'redis_ping_failed',
              status: 'not_ready',
            }),
          }),
        }),
      })
    );
  });

  it('returns not_ready when the critical IAM schema drifts', async () => {
    vi.resetModules();
    state.redisAvailable = true;
    state.listRolesImpl = async () => [];
    state.queryHandler = (text) => {
      if (text.includes('SELECT 1;')) {
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      }
      if (text.includes("to_regclass('iam.groups')")) {
        return {
          rowCount: 1,
          rows: [
            {
              groups_exists: true,
              group_roles_exists: true,
              account_groups_exists: false,
              account_groups_origin_column_exists: false,
              activity_logs_exists: true,
              platform_activity_logs_exists: true,
              accounts_avatar_url_column_exists: true,
              accounts_instance_id_column_exists: true,
              accounts_username_ciphertext_column_exists: true,
              accounts_notes_column_exists: true,
              accounts_preferred_language_column_exists: true,
              accounts_timezone_column_exists: true,
              idx_accounts_kc_subject_instance_exists: true,
              accounts_isolation_policy_matches: true,
              instance_memberships_isolation_policy_matches: true,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const { healthReadyHandler: freshHealthReadyHandler } = await import('./iam-account-management.server');
    const response = await freshHealthReadyHandler(
      new Request('http://localhost/api/v1/iam/health/ready', { method: 'GET' })
    );
    const payload = (await response.json()) as {
      checks: {
        db: boolean;
        diagnostics?: {
          db?: {
            reason_code?: string;
            schema_guard?: {
              checks: Array<{ reasonCode: string; schemaObject: string }>;
            };
          };
        };
        errors: Record<string, string>;
      };
      status: string;
    };

    expect(response.status).toBe(503);
    expect(payload.status).toBe('not_ready');
    expect(payload.checks.db).toBe(false);
    expect(payload.checks.errors.db).toContain('missing_table:iam.account_groups');
    expect(payload.checks.diagnostics?.db?.reason_code).toBe('schema_drift');
    expect(payload.checks.diagnostics?.db?.schema_guard?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: 'missing_table',
          schemaObject: 'iam.account_groups',
        }),
      ])
    );
  });

  it('returns a live heartbeat payload', async () => {
    const response = await healthLiveHandler(
      new Request('http://localhost/api/v1/iam/health/live', { method: 'GET' })
    );
    const payload = (await response.json()) as { status: string; path: string };

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        status: 'alive',
        path: '/api/v1/iam/health/live',
      })
    );
  });

  it('returns the unified user timeline', async () => {
    state.timelineEvents = [
      {
        id: 'event-1',
        category: 'governance',
        eventType: 'delegation',
        title: 'Support Delegate',
        description: 'Requester -> Target',
        occurredAt: '2026-03-18T10:00:00.000Z',
        perspective: 'actor',
        metadata: {},
      },
    ];
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id')) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await getUserTimelineHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}/timeline`, { method: 'GET' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: state.timelineEvents,
      pagination: {
        page: 1,
        pageSize: 1,
        total: 1,
      },
      requestId: 'req-iam-handler',
    });
  });

  it('returns database_unavailable when loading the user timeline fails', async () => {
    state.timelineError = new Error('timeline unavailable');
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id AS account_id')) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await getUserTimelineHandler(
      new Request(`http://localhost/api/v1/iam/users/${targetUserId}/timeline`, { method: 'GET' })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'database_unavailable',
        message: 'IAM-Historie ist nicht erreichbar.',
      },
      requestId: 'req-iam-handler',
    });
  });

  it('rejects timeline requests for actors without admin roles', async () => {
    state.user = {
      ...state.user,
      roles: ['member'],
    };

    const response = await getUserTimelineHandler(
      new Request('http://localhost/api/v1/iam/users/not-a-uuid/timeline', { method: 'GET' })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'forbidden',
        message: 'Unzureichende Berechtigungen.',
      },
      requestId: 'req-iam-handler',
    });
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
