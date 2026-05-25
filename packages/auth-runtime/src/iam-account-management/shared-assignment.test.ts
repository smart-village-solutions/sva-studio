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
  it('deletes only removed role assignments and inserts only new ones', async () => {
    const { assignRoles } = await import('./shared-assignment.js');
    const { client, calls } = createClient();

    await assignRoles(client as never, {
      instanceId: 'instance-1',
      accountId: 'account-1',
      existingRoleIds: ['role-1', 'role-2'],
      roleIds: ['role-2'],
      assignedBy: 'actor-1',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain('DELETE FROM iam.account_roles');
    expect(calls[0]?.params).toEqual(['instance-1', 'account-1', ['role-1']]);

    await assignRoles(client as never, {
      instanceId: 'instance-1',
      accountId: 'account-1',
      existingRoleIds: ['role-2'],
      roleIds: ['role-2', 'role-3'],
      assignedBy: 'actor-1',
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]?.sql).toContain('INSERT INTO iam.account_roles');
    expect(calls[1]?.params).toEqual(['instance-1', 'account-1', 'actor-1', ['role-3']]);
  });

  it('deduplicates group ids, preserves unchanged memberships and applies the default origin on inserts', async () => {
    const { assignGroups } = await import('./shared-assignment.js');
    const { client, calls } = createClient();

    await assignGroups(client as never, {
      instanceId: 'instance-1',
      accountId: 'account-1',
      existingGroupIds: ['group-1', 'group-3'],
      groupIds: ['group-1', 'group-1', 'group-2'],
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.sql).toContain('DELETE FROM iam.account_groups');
    expect(calls[0]?.params).toEqual(['instance-1', 'account-1', ['group-3']]);
    expect(calls[1]?.sql).toContain('INSERT INTO iam.account_groups');
    expect(calls[1]?.params).toEqual(['instance-1', 'account-1', 'manual', ['group-2']]);
  });

  it('skips all writes when the requested group memberships are unchanged', async () => {
    const { assignGroups } = await import('./shared-assignment.js');
    const { client, calls } = createClient();

    await assignGroups(client as never, {
      instanceId: 'instance-1',
      accountId: 'account-1',
      existingGroupIds: ['group-1'],
      groupIds: ['group-1', 'group-1'],
      origin: 'sync',
    });

    expect(calls).toHaveLength(0);
  });
});
