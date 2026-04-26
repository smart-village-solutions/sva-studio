import { describe, expect, it, vi } from 'vitest';

import { resolveUsersForBulkDeactivation } from './user-bulk-query.js';

const createQueryClient = (rows: unknown[]) => ({
  query: vi.fn(async () => ({ rows })),
});

describe('user-bulk-query', () => {
  it('returns no users and skips the database for empty input', async () => {
    const client = createQueryClient([]);

    await expect(resolveUsersForBulkDeactivation(client, { instanceId: 'de-musterhausen', userIds: [] })).resolves.toEqual([]);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('loads users in request order and maps assigned roles', async () => {
    const client = createQueryClient([
      {
        id: 'user-2',
        keycloak_subject: 'kc-2',
        status: 'pending',
        role_rows: null,
      },
      {
        id: 'user-1',
        keycloak_subject: 'kc-1',
        status: 'active',
        role_rows: [
          {
            id: 'role-1',
            role_key: 'editor',
            role_name: 'editor',
            display_name: 'Editor',
            role_level: 20,
          },
        ],
      },
    ]);

    await expect(
      resolveUsersForBulkDeactivation(client, {
        instanceId: 'de-musterhausen',
        userIds: ['user-1', 'missing-user', 'user-2'],
      })
    ).resolves.toEqual([
      {
        id: 'user-1',
        keycloakSubject: 'kc-1',
        status: 'active',
        roles: [{ roleId: 'role-1', roleKey: 'editor', roleName: 'Editor', roleLevel: 20 }],
      },
      {
        id: 'user-2',
        keycloakSubject: 'kc-2',
        status: 'pending',
        roles: [],
      },
    ]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('WHERE a.id = ANY($2::uuid[])'), [
      'de-musterhausen',
      ['user-1', 'missing-user', 'user-2'],
    ]);
  });
});
