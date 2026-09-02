import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authorizeInstancePermissionForUser: vi.fn(),
  emitActivityLog: vi.fn(async () => undefined),
  query: vi.fn(),
  resolveIdentityProviderForInstance: vi.fn(),
  resolveMutationActorWithAccount: vi.fn(),
  resolveUserReadAccess: vi.fn(),
}));

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();
  return {
    ...actual,
    getWorkspaceContext: () => ({ requestId: 'request-roles', traceId: 'trace-roles' }),
  };
});

vi.mock('../db.js', () => ({
  jsonResponse: (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
}));

vi.mock('../instance-permission-authorization.js', () => ({
  authorizeInstancePermissionForUser: (...args: unknown[]) =>
    state.authorizeInstancePermissionForUser(...args),
  toInstancePermissionApiErrorCode: () => 'forbidden',
}));

vi.mock('./mutation-request-context.shared.js', () => ({
  resolveMutationActorWithAccount: (...args: unknown[]) =>
    state.resolveMutationActorWithAccount(...args),
}));

vi.mock('./shared-activity.js', () => ({
  emitActivityLog: (...args: unknown[]) => state.emitActivityLog(...args),
}));

vi.mock('./shared-observability.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
  trackKeycloakCall: async (_operation: string, execute: () => Promise<unknown>) => execute(),
}));

vi.mock('./shared-runtime.js', () => ({
  resolveIdentityProviderForInstance: (...args: unknown[]) =>
    state.resolveIdentityProviderForInstance(...args),
  withInstanceScopedDb: async (
    _instanceId: string,
    work: (client: { query: typeof state.query }) => Promise<unknown>
  ) => work({ query: state.query }),
}));

vi.mock('./user-read-shared.js', () => ({
  resolveUserReadAccess: (...args: unknown[]) => state.resolveUserReadAccess(...args),
}));

const createContext = () =>
  ({
    sessionId: 'session-1',
    user: {
      id: 'keycloak-actor',
      instanceId: 'tenant-1',
      roles: ['system_admin'],
    },
  }) as const;

const createRoleProvider = () => {
  let directRoleNames: string[] = [];
  const catalog = [
    { id: 'news-id', externalName: 'news_editor' },
    { id: 'system-id', externalName: 'system_admin', attributes: { managed_by: ['studio'] } },
    { id: 'builtin-id', externalName: 'offline_access' },
  ] as const;

  return {
    getUserAttributes: vi.fn(async () => ({})),
    getRoleByName: vi.fn(async (roleName: string) =>
      catalog.find((role) => role.externalName === roleName)
    ),
    listRoles: vi.fn(async () => catalog),
    listUserRoleNames: vi.fn(async () => directRoleNames),
    listUserRealmRoleAssignments: vi.fn(async () => ({
      direct: catalog.filter((role) => directRoleNames.includes(role.externalName)),
      effective: catalog.filter((role) => directRoleNames.includes(role.externalName)),
    })),
    assignRealmRoles: vi.fn(async (_externalId: string, roleNames: readonly string[]) => {
      directRoleNames = Array.from(new Set([...directRoleNames, ...roleNames]));
    }),
    removeRealmRoles: vi.fn(async (_externalId: string, roleNames: readonly string[]) => {
      directRoleNames = directRoleNames.filter((roleName) => !roleNames.includes(roleName));
    }),
  };
};

describe('user Keycloak role handlers integration boundary', () => {
  let getUserKeycloakRolesInternal: typeof import('./user-keycloak-role-handlers.js').getUserKeycloakRolesInternal;
  let mutateUserKeycloakRoleInternal: typeof import('./user-keycloak-role-handlers.js').mutateUserKeycloakRoleInternal;

  beforeAll(async () => {
    ({ getUserKeycloakRolesInternal, mutateUserKeycloakRoleInternal } =
      await import('./user-keycloak-role-handlers.js'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    state.authorizeInstancePermissionForUser.mockResolvedValue({ ok: true, permissions: [] });
    state.resolveUserReadAccess.mockResolvedValue({
      actor: { instanceId: 'tenant-1', requestId: 'request-roles', traceId: 'trace-roles' },
    });
    state.resolveMutationActorWithAccount.mockResolvedValue({
      actor: {
        instanceId: 'tenant-1',
        actorAccountId: '11111111-1111-4111-8111-111111111111',
      },
    });
    state.query.mockResolvedValue({ rows: [{ keycloak_subject: 'mapped-subject' }] });
  });

  it('loads mapped users from the tenant database and keeps local role assignments untouched', async () => {
    const provider = createRoleProvider();
    state.resolveIdentityProviderForInstance.mockResolvedValue({ provider });

    const response = await getUserKeycloakRolesInternal(
      new Request(
        'https://tenant.example.test/api/v1/iam/users/11111111-1111-4111-8111-111111111112/keycloak-roles'
      ),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          mappingStatus: 'mapped',
          roles: expect.arrayContaining([
            expect.objectContaining({ roleName: 'news_editor', assignable: true }),
            expect.objectContaining({ roleName: 'system_admin', assignable: false }),
          ]),
        }),
      })
    );
    expect(state.query).toHaveBeenCalledTimes(1);
    expect(state.query.mock.calls[0]?.[0]).toContain('SELECT keycloak_subject');
    expect(state.query.mock.calls[0]?.[0]).not.toMatch(/INSERT|UPDATE|DELETE/i);
    expect(state.authorizeInstancePermissionForUser).toHaveBeenCalledWith({
      ctx: createContext(),
      action: 'iam.role.read',
      instanceId: 'tenant-1',
    });
  });

  it('loads an unmapped App user without creating a local IAM account', async () => {
    const provider = createRoleProvider();
    state.resolveIdentityProviderForInstance.mockResolvedValue({ provider });

    const response = await getUserKeycloakRolesInternal(
      new Request(
        'https://tenant.example.test/api/v1/iam/users/keycloak%3Aapp-user-1/keycloak-roles'
      ),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ data: expect.objectContaining({ mappingStatus: 'unmapped' }) })
    );
    expect(state.query).not.toHaveBeenCalled();
    expect(provider.getUserAttributes).toHaveBeenCalledWith('app-user-1', []);
  });

  it('assigns exactly one external role delta and performs no local role write', async () => {
    const provider = createRoleProvider();
    state.resolveIdentityProviderForInstance.mockResolvedValue({ provider });

    const response = await mutateUserKeycloakRoleInternal(
      new Request(
        'https://tenant.example.test/api/v1/iam/users/11111111-1111-4111-8111-111111111112/keycloak-roles',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ roleName: 'news_editor', operation: 'assign' }),
        }
      ),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          roleName: 'news_editor',
          operation: 'assign',
          direct: true,
          status: 'confirmed',
        }),
      })
    );
    expect(provider.assignRealmRoles).toHaveBeenCalledWith('mapped-subject', ['news_editor']);
    expect(provider.removeRealmRoles).not.toHaveBeenCalled();
    expect(state.query).toHaveBeenCalledTimes(1);
    expect(state.query.mock.calls[0]?.[0]).not.toMatch(/INSERT|UPDATE|DELETE/i);
    expect(state.resolveMutationActorWithAccount).toHaveBeenCalledWith(
      expect.any(Request),
      createContext(),
      expect.objectContaining({ requiredPermissionAction: 'iam.role.write' })
    );
    expect(state.emitActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'keycloak.role_assignment.changed', result: 'success' })
    );
  });

  it('fails closed before Keycloak access when iam.role.write is denied', async () => {
    const provider = createRoleProvider();
    const denied = new Response(
      JSON.stringify({ error: { code: 'forbidden', message: 'permission_missing' } }),
      { status: 403, headers: { 'content-type': 'application/json' } }
    );
    state.resolveMutationActorWithAccount.mockResolvedValue({ response: denied });
    state.resolveIdentityProviderForInstance.mockResolvedValue({ provider });

    const response = await mutateUserKeycloakRoleInternal(
      new Request(
        'https://tenant.example.test/api/v1/iam/users/keycloak%3Aapp-user-1/keycloak-roles',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ roleName: 'news_editor', operation: 'assign' }),
        }
      ),
      createContext()
    );

    expect(response).toBe(denied);
    expect(state.resolveIdentityProviderForInstance).not.toHaveBeenCalled();
    expect(provider.assignRealmRoles).not.toHaveBeenCalled();
  });
});
