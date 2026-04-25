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
    });

    expect(executedQueries).toHaveLength(2);
    expect(executedQueries[0]).toContain('EXISTS (');
    expect(executedQueries[1]).toContain('EXISTS (');
    expect(executedQueries[1]).not.toContain('iam.role_permissions');
    expect(executedQueries[1]).not.toContain('iam.permissions');
  });
});
