import { describe, expect, it, vi } from 'vitest';

vi.mock('./encryption.js', () => ({
  protectField: (value: string) => `enc:${value}`,
}));

import {
  buildUpdatedUserParams,
  createUserUpdatePersistence,
} from './user-update-persistence.js';
import type { QueryClient } from './query-client.js';

const detail = {
  id: 'user-1',
  keycloakSubject: 'kc-1',
  displayName: 'User Name',
  email: 'user@example.test',
  status: 'active',
  roles: [],
  mainserverUserApplicationSecretSet: false,
} as const;

const createDeps = (client: QueryClient) => ({
  assignGroups: vi.fn(async () => undefined),
  assignRoles: vi.fn(async () => undefined),
  emitActivityLog: vi.fn(async () => undefined),
  notifyPermissionInvalidation: vi.fn(async () => undefined),
  resolveUserDetail: vi.fn(async () => detail),
  withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (queryClient: QueryClient) => Promise<unknown>) =>
    work(client)
  ),
});

describe('user-update-persistence', () => {
  it('builds encrypted update params and keeps optional fields nullable', () => {
    expect(
      buildUpdatedUserParams('user-1', 'instance-1', 'kc-1', {
        email: 'user@example.com',
        displayName: 'User Name',
        firstName: 'User',
        lastName: 'Name',
        status: 'active',
      })
    ).toEqual([
      'user-1',
      'instance-1',
      'enc:user@example.com',
      'enc:User Name',
      'enc:User',
      'enc:Name',
      null,
      null,
      null,
      null,
      null,
      null,
      'active',
      null,
    ]);
  });

  it('persists user updates, assignments, activity and invalidations', async () => {
    const client: QueryClient = {
      query: vi.fn(async () => ({ rowCount: 1, rows: [] })),
    };
    const deps = createDeps(client);
    const persistence = createUserUpdatePersistence(deps);

    await expect(
      persistence.persistUpdatedUserDetail({
        instanceId: 'inst-1',
        actorAccountId: 'actor-1',
        userId: 'user-1',
        keycloakSubject: 'kc-1',
        requestId: 'req-1',
        traceId: 'trace-1',
        payload: {
          email: 'new@example.test',
          roleIds: ['role-1'],
          groupIds: ['group-1'],
        },
        nextMainserverCredentialState: {
          mainserverUserApplicationId: 'app-1',
          mainserverUserApplicationSecretSet: true,
        },
      })
    ).resolves.toEqual({
      ...detail,
      mainserverUserApplicationId: 'app-1',
      mainserverUserApplicationSecretSet: true,
    });

    expect(deps.withInstanceScopedDb).toHaveBeenCalledWith('inst-1', expect.any(Function));
    expect(deps.assignRoles).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      accountId: 'user-1',
      roleIds: ['role-1'],
      assignedBy: 'actor-1',
    });
    expect(deps.assignGroups).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      accountId: 'user-1',
      groupIds: ['group-1'],
      origin: 'manual',
    });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE iam.accounts'), [
      'user-1',
      'inst-1',
      'enc:new@example.test',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: 'user.updated',
        subjectId: 'user-1',
      })
    );
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      keycloakSubject: 'kc-1',
      trigger: 'user_role_changed',
    });
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      keycloakSubject: 'kc-1',
      trigger: 'user_group_changed',
    });
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledWith(client, {
      instanceId: 'inst-1',
      keycloakSubject: 'kc-1',
      trigger: 'user_updated',
    });
  });

  it('returns undefined when the updated detail can no longer be loaded', async () => {
    const client: QueryClient = {
      query: vi.fn(async () => ({ rowCount: 1, rows: [] })),
    };
    const deps = {
      ...createDeps(client),
      resolveUserDetail: vi.fn(async () => undefined),
    };
    const persistence = createUserUpdatePersistence(deps);

    await expect(
      persistence.persistUpdatedUserDetail({
        instanceId: 'inst-1',
        actorAccountId: 'actor-1',
        userId: 'user-1',
        keycloakSubject: 'kc-1',
        payload: {},
        nextMainserverCredentialState: {
          mainserverUserApplicationSecretSet: false,
        },
      })
    ).resolves.toBeUndefined();
  });
});
