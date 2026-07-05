import { describe, expect, it, vi } from 'vitest';

import { createUserCreatePersistence } from './user-create-persistence.js';
import type { CreateUserPersistenceActor, CreateUserPersistencePayload } from './user-create-persistence.js';
import type { QueryClient } from './query-client.js';

const roleRow = {
  id: 'role-1',
  role_key: 'editor',
  role_name: 'editor',
  display_name: 'Editor',
  external_role_name: 'Editor',
  role_level: 20,
  is_system_role: false,
};

const systemAdminAliasRoleRow = {
  ...roleRow,
  role_key: 'system_admin',
  role_name: 'system_admin',
  display_name: 'System Admin',
  external_role_name: 'legacy-system-admin',
  is_system_role: true,
};

const createDeps = () => ({
  assignGroups: vi.fn(async () => undefined),
  assignRoles: vi.fn(async () => undefined),
  emitActivityLog: vi.fn(async () => undefined),
  ensureRoleAssignmentWithinActorLevel: vi.fn(async () => ({ ok: true as const, roles: [roleRow] })),
  notifyPermissionInvalidation: vi.fn(async () => undefined),
  protectField: vi.fn((value: string | undefined, context: string) => (value ? `${context}:${value}` : null)),
  resolveGroupsByIds: vi.fn(async () => [
    {
      id: 'group-1',
      group_key: 'redaktion',
      display_name: 'Redaktion',
      description: null,
      group_type: 'role_bundle',
      is_active: true,
    },
  ]),
  resolveRoleIdsForGroups: vi.fn(async () => ['role-1']),
  resolveRolesByIds: vi.fn(async () => [roleRow]),
});

const createInsertClient = (accountId: string): QueryClient => ({
  query: vi.fn(async (text: string) => {
    if (text.includes('RETURNING id')) {
      return { rowCount: 1, rows: [{ id: accountId }] };
    }
    return { rowCount: 1, rows: [] };
  }),
});

type UserCreatePersistence = ReturnType<typeof createUserCreatePersistence>;
type UserCreatePersistenceDeps = Parameters<typeof createUserCreatePersistence>[0];

const persistCreatedTestUser = (
  persistence: UserCreatePersistence,
  client: QueryClient,
  overrides: {
    readonly actor?: Partial<CreateUserPersistenceActor>;
    readonly externalId?: string;
    readonly payload?: Partial<CreateUserPersistencePayload>;
  } = {}
) =>
  persistence.persistCreatedUser(client, {
    actor: {
      instanceId: 'inst-1',
      actorAccountId: 'actor-1',
      actorRoles: ['admin'],
      ...overrides.actor,
    },
    actorSubject: 'subject-actor',
    externalId: overrides.externalId ?? 'subject-new',
    payload: {
      email: 'user@example.test',
      roleIds: ['role-1'],
      ...overrides.payload,
    },
  });

const createNoWriteClient = (): QueryClient => ({
  query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
});

const expectCreateToRejectBeforeWrite = async (
  deps: UserCreatePersistenceDeps,
  message: string,
  overrides?: Parameters<typeof persistCreatedTestUser>[2]
) => {
  const client = createNoWriteClient();
  const persistence = createUserCreatePersistence(deps);

  await expect(persistCreatedTestUser(persistence, client, overrides)).rejects.toThrow(message);
  expect(client.query).not.toHaveBeenCalled();
};

describe('user-create-persistence', () => {
  it('persists a created user with membership, groups, roles, activity log and invalidation', async () => {
    const deps = createDeps();
    const client = createInsertClient('account-1');
    const persistence = createUserCreatePersistence(deps);

    await expect(
      persistCreatedTestUser(persistence, client, {
        actor: {
          requestId: 'req-1',
          traceId: 'trace-1',
        },
        payload: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          groupIds: ['group-1'],
        },
      })
    ).resolves.toEqual({
      responseData: expect.objectContaining({
        id: 'account-1',
        keycloakSubject: 'subject-new',
        displayName: 'Ada Lovelace',
        email: 'user@example.test',
        status: 'pending',
        roles: [expect.objectContaining({ roleKey: 'editor' })],
      }),
      roleNames: ['Editor'],
    });

    expect(deps.ensureRoleAssignmentWithinActorLevel).toHaveBeenCalledWith({
      client,
      instanceId: 'inst-1',
      actorSubject: 'subject-actor',
      actorRoles: ['admin'],
      roleIds: ['role-1'],
    });
    expect(deps.resolveGroupsByIds).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      groupIds: ['group-1'],
    });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO iam.accounts'), [
      'inst-1',
      'subject-new',
      'iam.accounts.email:subject-new:user@example.test',
      'iam.accounts.display_name:subject-new:Ada Lovelace',
      'iam.accounts.first_name:subject-new:Ada',
      'iam.accounts.last_name:subject-new:Lovelace',
      null,
      null,
      null,
      null,
      null,
      null,
      'pending',
      null,
    ]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO iam.instance_memberships'), [
      'inst-1',
      'account-1',
    ]);
    expect(deps.assignRoles).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      accountId: 'account-1',
      roleIds: ['role-1'],
      assignedBy: 'actor-1',
    });
    expect(deps.assignGroups).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      accountId: 'account-1',
      groupIds: ['group-1'],
      origin: 'manual',
    });
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: 'user.created',
        subjectId: 'account-1',
        payload: expect.objectContaining({
          assigned_role_ids: ['role-1'],
          assigned_group_ids: ['group-1'],
          effective_role_ids: ['role-1'],
        }),
      })
    );
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      keycloakSubject: 'subject-new',
      trigger: 'user_role_changed',
    });
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      keycloakSubject: 'subject-new',
      trigger: 'user_group_changed',
    });
  });

  it('includes canonical system_admin for aliased technical role rows', async () => {
    const deps = {
      ...createDeps(),
      ensureRoleAssignmentWithinActorLevel: vi.fn(async () => ({
        ok: true as const,
        roles: [systemAdminAliasRoleRow],
      })),
      resolveRolesByIds: vi.fn(async () => [systemAdminAliasRoleRow]),
    };
    const client = createInsertClient('account-1');
    const persistence = createUserCreatePersistence(deps);

    await expect(
      persistCreatedTestUser(persistence, client, {
        payload: {
          roleIds: ['role-admin'],
        },
      })
    ).resolves.toMatchObject({
      roleNames: ['legacy-system-admin', 'system_admin'],
    });
  });

  it('rejects role assignments above the actor level before writing the account', async () => {
    const deps = {
      ...createDeps(),
      ensureRoleAssignmentWithinActorLevel: vi.fn(async () => ({
        ok: false as const,
        code: 'forbidden',
        message: 'denied',
      })),
    };
    await expectCreateToRejectBeforeWrite(deps, 'forbidden:denied', {
      actor: { actorRoles: undefined },
    });
  });

  it('rejects unknown groups before writing the account', async () => {
    const deps = {
      ...createDeps(),
      resolveGroupsByIds: vi.fn(async () => []),
    };
    await expectCreateToRejectBeforeWrite(deps, 'invalid_request:Mindestens eine aktive Gruppe existiert nicht.', {
      payload: {
        roleIds: [],
        groupIds: ['missing-group'],
      },
    });
  });

  it('skips bundled group role validation when the selected groups do not add direct roles', async () => {
    const deps = {
      ...createDeps(),
      resolveRoleIdsForGroups: vi.fn(async () => []),
    };
    const client = createInsertClient('account-1');
    const persistence = createUserCreatePersistence(deps);

    await expect(
      persistCreatedTestUser(persistence, client, {
        payload: {
          roleIds: [],
          groupIds: ['group-1'],
        },
      })
    ).resolves.toMatchObject({
      responseData: expect.objectContaining({
        id: 'account-1',
        roles: [expect.objectContaining({ roleKey: 'editor' })],
      }),
      roleNames: ['Editor'],
    });

    expect(deps.ensureRoleAssignmentWithinActorLevel).toHaveBeenCalledTimes(1);
  });

  it('deduplicates direct and group-derived role ids before resolving the synced role set', async () => {
    const deps = {
      ...createDeps(),
      resolveRoleIdsForGroups: vi.fn(async () => ['role-1', 'role-1']),
    };
    const client = createInsertClient('account-3');
    const persistence = createUserCreatePersistence(deps);

    await expect(
      persistCreatedTestUser(persistence, client, {
        payload: {
          groupIds: ['group-1'],
        },
      })
    ).resolves.toMatchObject({
      roleNames: ['Editor'],
    });

    expect(deps.resolveRolesByIds).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      roleIds: ['role-1'],
    });
  });

  it('rejects groups that would grant bundled roles above the actor level', async () => {
    const deps = {
      ...createDeps(),
      ensureRoleAssignmentWithinActorLevel: vi
        .fn()
        .mockResolvedValueOnce({ ok: true as const, roles: [roleRow] })
        .mockResolvedValueOnce({
          ok: false as const,
          code: 'forbidden',
          message: 'group bundle denied',
        }),
    };
    await expectCreateToRejectBeforeWrite(deps, 'forbidden:group bundle denied', {
      payload: {
        groupIds: ['group-1'],
      },
    });
  });

  it('persists users without groups and keeps explicit display names', async () => {
    const deps = createDeps();
    const client = createInsertClient('account-2');
    const persistence = createUserCreatePersistence(deps);

    await expect(
      persistCreatedTestUser(persistence, client, {
        payload: {
          displayName: 'Ada Display',
        },
      })
    ).resolves.toMatchObject({
      responseData: expect.objectContaining({
        id: 'account-2',
        displayName: 'Ada Display',
      }),
    });

    expect(deps.resolveGroupsByIds).not.toHaveBeenCalled();
    expect(deps.assignGroups).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      accountId: 'account-2',
      groupIds: [],
      origin: 'manual',
    });
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        payload: expect.objectContaining({
          group_count: 0,
        }),
      })
    );
  });
});
