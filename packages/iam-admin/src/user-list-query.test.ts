import { describe, expect, it, vi } from 'vitest';

import { resolveUsersWithPagination } from './user-list-query.js';

describe('resolveUsersWithPagination', () => {
  it('uses EXISTS role filters without permission joins in the list query', async () => {
    const executedQueries: string[] = [];
    const client = {
      query: vi.fn(async (text: string) => {
        executedQueries.push(text);

        if (text.includes('COUNT(DISTINCT a.id)::int AS total')) {
          return { rowCount: 1, rows: [{ total: 1 }] };
        }

        return {
          rowCount: 1,
          rows: [
            {
              id: 'bbbbbbbb-bbbb-4111-8bbb-bbbbbbbbbbbb',
              keycloak_subject: 'keycloak-target-2',
              display_name_ciphertext: null,
              first_name_ciphertext: null,
              last_name_ciphertext: null,
              email_ciphertext: null,
              position: null,
              department: null,
              status: 'active',
              is_technical_account: false,
              last_login_at: null,
              role_rows: [],
            },
          ],
        };
      }),
    };

    await resolveUsersWithPagination(client as Parameters<typeof resolveUsersWithPagination>[0], {
      instanceId: 'de-musterhausen',
      page: 1,
      pageSize: 25,
      role: 'editor',
      excludeAccountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });

    expect(executedQueries).toHaveLength(2);
    expect(executedQueries[0]).toContain('EXISTS (');
    expect(executedQueries[1]).toContain('EXISTS (');
    expect(executedQueries[1]).not.toContain('iam.role_permissions');
    expect(executedQueries[1]).not.toContain('iam.permissions');
    expect(executedQueries[0]).toContain('a.is_technical_account = FALSE');
    expect(executedQueries[1]).toContain('a.is_technical_account = FALSE');
    expect(client.query).toHaveBeenNthCalledWith(1, expect.any(String), [
      'de-musterhausen',
      null,
      'editor',
      null,
      false,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      false,
    ]);
    expect(executedQueries[0]).toContain('a.id <> $6::uuid');
    expect(executedQueries[1]).toContain('a.id <> $6::uuid');
  });

  it('can restrict ownership candidates to active lifecycle accounts', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await resolveUsersWithPagination(client, {
      instanceId: 'de-musterhausen',
      page: 1,
      pageSize: 10,
      activeLifecycleOnly: true,
    });

    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("a.deletion_lifecycle_state = 'active'"),
      ['de-musterhausen', null, null, null, false, null, true]
    );
    expect(client.query.mock.calls[0]?.[0]).toContain('a.is_blocked = FALSE');
    expect(client.query.mock.calls[0]?.[0]).toContain('a.soft_deleted_at IS NULL');
    expect(client.query).toHaveBeenNthCalledWith(2, expect.any(String), [
      'de-musterhausen',
      null,
      null,
      null,
      false,
      null,
      true,
      10,
      0,
    ]);
  });
});
