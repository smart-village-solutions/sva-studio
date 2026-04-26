import { describe, expect, it, vi } from 'vitest';

import { createUserCreatePersistence } from './user-create-persistence.js';
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

const createDeps = () => ({
  assignRoles: vi.fn(async () => undefined),
  emitActivityLog: vi.fn(async () => undefined),
  ensureRoleAssignmentWithinActorLevel: vi.fn(async () => ({ ok: true as const, roles: [roleRow] })),
  notifyPermissionInvalidation: vi.fn(async () => undefined),
  protectField: vi.fn((value: string | undefined, context: string) => (value ? `${context}:${value}` : null)),
  resolveRolesByIds: vi.fn(async () => [roleRow]),
});

describe('user-create-persistence', () => {
  it('persists a created user with membership, roles, activity log and invalidation', async () => {
    const deps = createDeps();
    const client: QueryClient = {
      query: vi.fn(async (text: string) => {
        if (text.includes('RETURNING id')) {
          return { rowCount: 1, rows: [{ id: 'account-1' }] };
        }
        return { rowCount: 1, rows: [] };
      }),
    };
    const persistence = createUserCreatePersistence(deps);

    await expect(
      persistence.persistCreatedUser(client, {
        actor: {
          instanceId: 'inst-1',
          actorAccountId: 'actor-1',
          actorRoles: ['admin'],
          requestId: 'req-1',
          traceId: 'trace-1',
        },
        actorSubject: 'subject-actor',
        externalId: 'subject-new',
        payload: {
          email: 'user@example.test',
          firstName: 'Ada',
          lastName: 'Lovelace',
          roleIds: ['role-1'],
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
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: 'user.created',
        subjectId: 'account-1',
      })
    );
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      keycloakSubject: 'subject-new',
      trigger: 'user_role_changed',
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
    const client: QueryClient = {
      query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
    };
    const persistence = createUserCreatePersistence(deps);

    await expect(
      persistence.persistCreatedUser(client, {
        actor: { instanceId: 'inst-1', actorAccountId: 'actor-1' },
        actorSubject: 'subject-actor',
        externalId: 'subject-new',
        payload: {
          email: 'user@example.test',
          roleIds: ['role-1'],
        },
      })
    ).rejects.toThrow('forbidden:denied');

    expect(client.query).not.toHaveBeenCalled();
  });
});
