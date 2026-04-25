import { describe, expect, it, vi } from 'vitest';

import {
  resolveGroupsByIds,
  resolveRoleIdsForGroups,
  resolveRolesByExternalNames,
  resolveRolesByIds,
} from './role-resolution.js';
import type { QueryClient } from './query-client.js';

describe('role-resolution', () => {
  it('skips database access for empty inputs', async () => {
    const client = { query: vi.fn() } satisfies QueryClient;

    await expect(resolveRolesByIds(client, { instanceId: 'de-musterhausen', roleIds: [] })).resolves.toEqual([]);
    await expect(
      resolveRolesByExternalNames(client, { instanceId: 'de-musterhausen', externalRoleNames: [] })
    ).resolves.toEqual([]);
    await expect(resolveGroupsByIds(client, { instanceId: 'de-musterhausen', groupIds: [] })).resolves.toEqual([]);
    await expect(resolveRoleIdsForGroups(client, { instanceId: 'de-musterhausen', groupIds: [] })).resolves.toEqual([]);

    expect(client.query).not.toHaveBeenCalled();
  });

  it('loads roles and groups with instance scope', async () => {
    const client: QueryClient = {
      query: vi.fn(async (text: string) => {
        if (text.includes('COALESCE(external_role_name')) {
          return { rowCount: 1, rows: [{ id: 'role-2', role_key: 'editor' }] };
        }
        if (text.includes('FROM iam.groups') && !text.includes('group_roles')) {
          return { rowCount: 1, rows: [{ id: 'group-1', group_key: 'editors' }] };
        }
        if (text.includes('FROM iam.group_roles')) {
          return { rowCount: 1, rows: [{ role_id: 'role-1' }] };
        }
        return { rowCount: 1, rows: [{ id: 'role-1', role_key: 'admin' }] };
      }),
    };

    await expect(resolveRolesByIds(client, { instanceId: 'de-musterhausen', roleIds: ['role-1'] })).resolves.toEqual([
      expect.objectContaining({ id: 'role-1' }),
    ]);
    await expect(
      resolveRolesByExternalNames(client, { instanceId: 'de-musterhausen', externalRoleNames: ['editor'] })
    ).resolves.toEqual([expect.objectContaining({ id: 'role-2' })]);
    await expect(resolveGroupsByIds(client, { instanceId: 'de-musterhausen', groupIds: ['group-1', 'group-1'] })).resolves.toEqual([
      expect.objectContaining({ id: 'group-1' }),
    ]);
    await expect(resolveRoleIdsForGroups(client, { instanceId: 'de-musterhausen', groupIds: ['group-1'] })).resolves.toEqual([
      'role-1',
    ]);
  });
});
