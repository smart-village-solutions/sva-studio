import { describe, expect, it, vi } from 'vitest';

type QueryCall = {
  sql: string;
  params: unknown[];
};

const createClient = () => {
  const calls: QueryCall[] = [];
  return {
    client: {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        calls.push({ sql, params });
        return { rows: [] };
      }),
    },
    calls,
  };
};

describe('shared assignment helpers', () => {
  it('replaces role assignments and skips inserts for empty role lists', async () => {
    const { assignRoles } = await import('./shared-assignment.js');
    const { client, calls } = createClient();

    await assignRoles(client as never, {
      instanceId: 'instance-1',
      accountId: 'account-1',
      roleIds: [],
      assignedBy: 'actor-1',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain('DELETE FROM iam.account_roles');

    await assignRoles(client as never, {
      instanceId: 'instance-1',
      accountId: 'account-1',
      roleIds: ['role-1', 'role-2'],
      assignedBy: 'actor-1',
    });

    expect(calls).toHaveLength(3);
    expect(calls[2]?.sql).toContain('INSERT INTO iam.account_roles');
    expect(calls[2]?.params).toEqual(['instance-1', 'account-1', 'actor-1', ['role-1', 'role-2']]);
  });

  it('deduplicates group ids and applies the default origin when inserting groups', async () => {
    const { assignGroups } = await import('./shared-assignment.js');
    const { client, calls } = createClient();

    await assignGroups(client as never, {
      instanceId: 'instance-1',
      accountId: 'account-1',
      groupIds: ['group-1', 'group-1', 'group-2'],
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.sql).toContain('DELETE FROM iam.account_groups');
    expect(calls[1]?.sql).toContain('INSERT INTO iam.account_groups');
    expect(calls[1]?.params).toEqual(['instance-1', 'account-1', 'manual', ['group-1', 'group-2']]);
  });

  it('skips group inserts when the unique group list is empty', async () => {
    const { assignGroups } = await import('./shared-assignment.js');
    const { client, calls } = createClient();

    await assignGroups(client as never, {
      instanceId: 'instance-1',
      accountId: 'account-1',
      groupIds: [],
      origin: 'sync',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain('DELETE FROM iam.account_groups');
  });
});
