import { describe, expect, it } from 'vitest';

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
    ).resolves.toBeUndefined();

    expect(statements).toEqual([]);
  });

  it('cleans up stale module permissions and role grants when desired sets are empty', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.syncAssignedModuleIam({
        instanceId: 'tenant-a',
        managedModuleIds: ['news'],
        contracts: [
          {
            moduleId: 'news',
            permissionIds: [],
            tenantBootstrapRoles: [{ roleName: 'news_admin', permissionIds: [] }],
          },
        ],
      })
    ).resolves.toBeUndefined();

    expect(statements).toHaveLength(2);
    expect(statements[0]?.text).toContain("role_permission.grant_origin_module_id IN ('news')");
    expect(statements[1]?.text).toContain("permission_key LIKE 'news.%'");
    expect(statements[1]?.text).not.toContain('permission_key NOT IN (');
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
            tenantBootstrapRoles: [{ roleName: 'system_admin', permissionIds: ['news.read'] }],
          },
        ],
      })
    ).resolves.toBeUndefined();

    const rolePermissionInsert = statements.find((statement) => statement.text.includes('grant_origin_kind'));
    expect(rolePermissionInsert?.text).toContain('grant_origin_kind');
    expect(rolePermissionInsert?.text).toContain('grant_origin_module_id');
    expect(rolePermissionInsert?.values).toEqual(['tenant-a', 'system_admin', 'news.read', 'module_sync', 'news']);

    const rolePermissionCleanup = statements.find((statement) =>
      statement.text.includes('DELETE FROM iam.role_permissions role_permission')
    );
    expect(rolePermissionCleanup?.text).toContain("role_permission.grant_origin_kind = 'module_sync'");
    expect(rolePermissionCleanup?.text).toContain("role_permission.grant_origin_module_id IN ('news', 'events')");
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
            tenantBootstrapRoles: [
              { roleName: 'z-role', permissionIds: ['z.permission'] },
              { roleName: 'ä-role', permissionIds: ['ä.permission'] },
            ],
          },
        ],
      })
    ).resolves.toBeUndefined();

    const permissionCleanup = statements.find((statement) => statement.text.includes('DELETE FROM iam.permissions'));
    const permissionUpserts = statements.filter((statement) => statement.text.includes('INSERT INTO iam.permissions'));

    expect(permissionCleanup?.text).toContain("permission_key NOT IN ('ä.permission', 'z.permission')");
    expect(permissionUpserts.map((statement) => statement.values[1])).toEqual(['ä.permission', 'z.permission']);
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
          permissionKeys: ['cockpit.read', 'iam.user.read'],
        },
      })
    ).resolves.toBeUndefined();

    const roleUpsert = statements.find(
      (statement) =>
        statement.text.includes('INSERT INTO iam.roles') && statement.text.includes('is_system_role = TRUE')
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
    expect(bootstrapCleanup?.values).toEqual(['tenant-a', 'system_admin', ['cockpit.read', 'iam.user.read']]);

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
});
