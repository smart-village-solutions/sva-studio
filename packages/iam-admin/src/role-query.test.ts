import { describe, expect, it, vi } from 'vitest';

import {
  loadRoleById,
  loadRoleListItemById,
  loadRoleListItems,
} from './role-query.js';

const createQueryClient = (rows: unknown[]) => ({
  query: vi.fn(async () => ({ rows })),
});

describe('role-query', () => {
  it('loads role list items scoped by instance and maps permissions', async () => {
    const client = createQueryClient([
      {
        id: 'role-1',
        role_key: 'editor',
        role_name: 'editor',
        display_name: 'Editor',
        external_role_name: 'Editor',
        managed_by: 'studio',
        description: 'Kann Inhalte bearbeiten',
        is_system_role: false,
        role_level: 20,
        member_count: 3,
        sync_state: 'synced',
        last_synced_at: '2026-04-24T12:00:00.000Z',
        last_error_code: null,
        permission_rows: [{ id: 'perm-1', permission_key: 'content.update', description: null }],
      },
    ]);

    await expect(loadRoleListItems(client, 'de-musterhausen')).resolves.toEqual([
      {
        id: 'role-1',
        roleKey: 'editor',
        roleName: 'Editor',
        externalRoleName: 'Editor',
        managedBy: 'studio',
        description: 'Kann Inhalte bearbeiten',
        isSystemRole: false,
        editability: 'editable',
        roleLevel: 20,
        memberCount: 3,
        syncState: 'synced',
        lastSyncedAt: '2026-04-24T12:00:00.000Z',
        permissions: [{ id: 'perm-1', permissionKey: 'content.update', description: undefined }],
      },
    ]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('WHERE r.instance_id = $1'), [
      'de-musterhausen',
    ]);
  });

  it('loads a managed role row by id', async () => {
    const row = {
      id: 'role-1',
      role_key: 'editor',
      role_name: 'editor',
      display_name: 'Editor',
      external_role_name: 'Editor',
      description: null,
      is_system_role: false,
      role_level: 20,
      managed_by: 'studio',
      sync_state: 'synced',
      last_synced_at: null,
      last_error_code: null,
    };
    const client = createQueryClient([row]);

    await expect(loadRoleById(client, { instanceId: 'de-musterhausen', roleId: 'role-1' })).resolves.toEqual(row);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('AND id = $2::uuid'), [
      'de-musterhausen',
      'role-1',
    ]);
  });

  it('maps a single role list item by id', async () => {
    const client = createQueryClient([
      {
        id: 'role-1',
        role_key: 'system_admin',
        role_name: 'system_admin',
        display_name: null,
        external_role_name: null,
        managed_by: 'studio',
        description: null,
        is_system_role: true,
        role_level: 100,
        member_count: 1,
        sync_state: 'failed',
        last_synced_at: null,
        last_error_code: 'IDP_TIMEOUT',
        permission_rows: null,
      },
    ]);

    await expect(loadRoleListItemById(client, { instanceId: 'de-musterhausen', roleId: 'role-1' })).resolves.toEqual(
      expect.objectContaining({
        roleKey: 'system_admin',
        roleName: 'system_admin',
        externalRoleName: 'system_admin',
        editability: 'read_only',
        diagnostics: [{ code: 'system_role', objectId: 'role-1', objectType: 'role' }],
        syncError: { code: 'IDP_TIMEOUT' },
      })
    );
  });
});
