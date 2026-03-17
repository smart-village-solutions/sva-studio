import { describe, expect, it, vi } from 'vitest';

import { assignGroups, ensureActorCanManageTarget, resolveGroupsByIds } from './iam-account-management/shared';

describe('iam-account-management/shared group helpers', () => {
  it('returns an empty result without querying when no group ids are requested', async () => {
    const query = vi.fn();

    await expect(
      resolveGroupsByIds({ query } as never, {
        instanceId: 'de-musterhausen',
        groupIds: [],
      })
    ).resolves.toEqual([]);

    expect(query).not.toHaveBeenCalled();
  });

  it('loads instance-scoped groups by id', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: 'group-1',
          group_key: 'admins',
          display_name: 'Admins',
          description: 'Administrative Gruppe',
          group_type: 'role_bundle',
          is_active: true,
        },
      ],
    });

    await expect(
      resolveGroupsByIds({ query } as never, {
        instanceId: 'de-musterhausen',
        groupIds: ['group-1'],
      })
    ).resolves.toEqual([
      {
        id: 'group-1',
        group_key: 'admins',
        display_name: 'Admins',
        description: 'Administrative Gruppe',
        group_type: 'role_bundle',
        is_active: true,
      },
    ]);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM iam.groups'), [
      'de-musterhausen',
      ['group-1'],
    ]);
  });

  it('replaces account groups and skips inserts when no groups remain', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await assignGroups({ query } as never, {
      instanceId: 'de-musterhausen',
      accountId: 'account-1',
      groupIds: [],
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      'DELETE FROM iam.account_groups WHERE instance_id = $1 AND account_id = $2::uuid;',
      ['de-musterhausen', 'account-1']
    );
  });

  it('inserts replacement group memberships with a stable default origin', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await assignGroups({ query } as never, {
      instanceId: 'de-musterhausen',
      accountId: 'account-1',
      groupIds: ['group-1', 'group-2'],
    });

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO iam.account_groups'),
      ['de-musterhausen', 'account-1', 'manual', ['group-1', 'group-2']]
    );
  });
});

describe('iam-account-management/shared target guard', () => {
  it('rejects non-admin actors for higher target role levels and system admins', () => {
    expect(
      ensureActorCanManageTarget({
        actorMaxRoleLevel: 20,
        actorRoles: ['editor'],
        targetRoles: [{ roleKey: 'system_admin', roleLevel: 90 }],
      })
    ).toEqual({
      ok: false,
      code: 'forbidden',
      message: 'Zielnutzer überschreitet die eigene Berechtigungsstufe.',
    });

    expect(
      ensureActorCanManageTarget({
        actorMaxRoleLevel: 20,
        actorRoles: ['editor'],
        targetRoles: [{ roleKey: 'system_admin', roleLevel: 10 }],
      })
    ).toEqual({
      ok: false,
      code: 'forbidden',
      message: 'Nur system_admin darf system_admin-Nutzer verwalten.',
    });
  });
});
