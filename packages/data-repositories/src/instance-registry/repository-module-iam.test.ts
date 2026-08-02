import { describe, expect, it } from 'vitest';

import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import { createInstanceRegistryRepository } from './index.js';
import { createQueuedExecutor } from './test-support.js';

describe('instance registry repository module iam', () => {
  it('returns false for idempotent module assignment and revocation writes', async () => {
    const { executor } = createQueuedExecutor([[], []]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.assignModule('tenant-a', 'news')).resolves.toBe(false);
    await expect(repository.revokeModule('tenant-a', 'news')).resolves.toBe(false);
  });

  it('skips IAM cleanup work when no managed modules or role pairs are present', async () => {
    const { executor, statements } = createQueuedExecutor([]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.syncAssignedModuleIam({
        instanceId: 'tenant-a',
        managedModuleIds: [],
        contracts: [],
      })
    ).resolves.toEqual({
      permissionsInserted: 0,
      permissionsUpdated: 0,
      permissionsUnchanged: 0,
      grantsInserted: 0,
      grantsUnchanged: 0,
    });

    expect(statements).toEqual([]);
  });

  it('cleans up stale module grants but preserves materialized permission definitions', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.syncAssignedModuleIam({
        instanceId: 'tenant-a',
        managedModuleIds: ['news'],
        contracts: [],
      })
    ).resolves.toMatchObject({ permissionsUnchanged: 0, grantsUnchanged: 0 });

    expect(statements).toHaveLength(1);
    expect(statements[0]?.text).toContain("role_permission.grant_origin_module_id IN ('news')");
    expect(
      statements.some((statement) => statement.text.includes('DELETE FROM iam.permissions'))
    ).toBe(false);
  });

  it('does not revoke grants merely because an active module removed a catalog entry', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createInstanceRegistryRepository(executor);

    await repository.syncAssignedModuleIam({
      instanceId: 'tenant-a',
      managedModuleIds: ['news'],
      contracts: [{ moduleId: 'news', permissionIds: [], permissions: [] }],
    });

    const cleanup = statements.find((statement) =>
      statement.text.includes('DELETE FROM iam.role_permissions')
    );
    expect(cleanup?.text).toContain("grant_origin_module_id NOT IN ('news')");
    expect(
      statements.some((statement) => statement.text.includes('DELETE FROM iam.permissions'))
    ).toBe(false);
  });

  it('tags module-synced role grants with ownership metadata and cleans up only module-owned rows', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.syncAssignedModuleIam({
        instanceId: 'tenant-a',
        managedModuleIds: ['news', 'events'],
        contracts: [
          {
            moduleId: 'news',
            permissionIds: ['news.read'],
            permissions: [{ key: 'news.read', description: 'Read news', resourceType: 'news' }],
            tenantBootstrapRoles: [{ roleName: 'system_admin', permissionIds: ['news.read'] }],
          },
        ],
      })
    ).resolves.toMatchObject({ permissionsUnchanged: 1, grantsUnchanged: 1 });

    const rolePermissionInsert = statements.find((statement) =>
      statement.text.includes('grant_origin_kind')
    );
    expect(rolePermissionInsert?.text).toContain('grant_origin_kind');
    expect(rolePermissionInsert?.text).toContain('grant_origin_module_id');
    expect(rolePermissionInsert?.values).toEqual([
      'tenant-a',
      'system_admin',
      'news.read',
      'module_sync',
      'news',
    ]);

    const rolePermissionCleanup = statements.find((statement) =>
      statement.text.includes('DELETE FROM iam.role_permissions role_permission')
    );
    expect(rolePermissionCleanup?.text).toContain(
      "role_permission.grant_origin_kind = 'module_sync'"
    );
    expect(rolePermissionCleanup?.text).toContain(
      "role_permission.grant_origin_module_id IN ('news', 'events')"
    );
    expect(rolePermissionCleanup?.text).toContain(
      "role_permission.grant_origin_module_id NOT IN ('news')"
    );
    expect(rolePermissionCleanup?.text).not.toContain('role.role_key IN');
  });

  it('uses locale-aware ordering for managed permission and role cleanup sets', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.syncAssignedModuleIam({
        instanceId: 'tenant-a',
        managedModuleIds: ['news'],
        contracts: [
          {
            moduleId: 'news',
            permissionIds: ['z.permission', 'ä.permission'],
            permissions: [
              { key: 'z.permission', description: 'Z permission', resourceType: 'z' },
              { key: 'ä.permission', description: 'Ä permission', resourceType: 'ä' },
            ],
            tenantBootstrapRoles: [
              { roleName: 'z-role', permissionIds: ['z.permission'] },
              { roleName: 'ä-role', permissionIds: ['ä.permission'] },
            ],
          },
        ],
      })
    ).resolves.toMatchObject({ permissionsUnchanged: 2, grantsUnchanged: 2 });

    const permissionUpserts = statements.filter((statement) =>
      statement.text.includes('INSERT INTO iam.permissions')
    );

    expect(permissionUpserts.map((statement) => statement.values[1])).toEqual([
      'ä.permission',
      'z.permission',
    ]);
  });

  it('syncs protected system-role permissions without relying on bootstrap groups', async () => {
    const { executor, statements } = createQueuedExecutor([]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.syncProtectedSystemRolePermissions({
        instanceId: 'tenant-a',
        role: {
          roleKey: 'system_admin',
          displayName: 'System Administrator',
          roleLevel: 100,
          permissions: [
            { key: 'cockpit.read', description: 'Read cockpit', resourceType: 'cockpit' },
            { key: 'iam.optout.read', description: 'Read opt-out data', resourceType: 'iam' },
            { key: 'iam.user.read', description: 'Read accounts', resourceType: 'iam' },
          ],
          grantPermissionKeys: ['cockpit.read', 'iam.user.read'],
        },
      })
    ).resolves.toMatchObject({ permissionsUnchanged: 3, grantsUnchanged: 2 });

    const roleUpsert = statements.find(
      (statement) =>
        statement.text.includes('INSERT INTO iam.roles') &&
        statement.text.includes('is_system_role = TRUE')
    );
    expect(roleUpsert?.values).toEqual([
      'tenant-a',
      'system_admin',
      'System Administrator',
      'Geschützte Systemrolle System Administrator',
      100,
    ]);

    const bootstrapCleanup = statements.find(
      (statement) =>
        statement.text.includes('DELETE FROM iam.role_permissions role_permission') &&
        statement.text.includes("role_permission.grant_origin_kind = 'bootstrap'")
    );
    expect(bootstrapCleanup).toBeUndefined();

    const rolePermissionInserts = statements.filter(
      (statement) =>
        statement.text.includes('INSERT INTO iam.role_permissions') &&
        statement.text.includes('grant_origin_kind') &&
        statement.values[1] === 'system_admin'
    );
    expect(rolePermissionInserts).toHaveLength(2);
    expect(rolePermissionInserts.map((statement) => statement.values)).toEqual([
      ['tenant-a', 'system_admin', 'cockpit.read'],
      ['tenant-a', 'system_admin', 'iam.user.read'],
    ]);
  });

  it('leaves transaction ownership to the scoped runtime boundary', async () => {
    const statements: SqlStatement[] = [];
    const executor: SqlExecutor = {
      async execute<TRow>(statement: SqlStatement) {
        statements.push(statement);
        if (statement.text.includes('INSERT INTO iam.permissions')) {
          throw new Error('permission_write_failed');
        }
        return { rowCount: 0, rows: [] as readonly TRow[] };
      },
    };
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.syncProtectedSystemRolePermissions({
        instanceId: 'tenant-a',
        role: {
          roleKey: 'system_admin',
          displayName: 'System Administrator',
          roleLevel: 100,
          permissions: [
            { key: 'iam.user.read', description: 'Read accounts', resourceType: 'iam' },
          ],
          grantPermissionKeys: ['iam.user.read'],
        },
      })
    ).rejects.toThrow('permission_write_failed');

    expect(statements).toHaveLength(1);
    expect(statements[0]?.text).toContain('INSERT INTO iam.permissions');
  });
});
