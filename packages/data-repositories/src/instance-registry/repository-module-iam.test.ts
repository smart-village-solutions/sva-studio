import { describe, expect, it } from 'vitest';

import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import { createInstanceRegistryRepository } from './index.js';
import { createQueuedExecutor } from './test-support.js';

describe('instance registry repository module iam', () => {
  it('persists active lifecycle reconcile intents and their Graphile wake-up together', async () => {
    const { executor, statements } = createQueuedExecutor([[{ plugin_id: 'events' }]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.persistPluginTenantLifecycleReconcileIntents({
        instanceId: 'tenant-a',
        lifecycles: [{ pluginId: 'events', contractRevision: 'events-1:1' }],
        forcePluginIds: ['events'],
      })
    ).resolves.toEqual(['events']);

    expect(statements[0]?.text).toContain('FOR UPDATE');
    expect(statements[0]?.text).toContain('active_job_id IS NULL');
    expect(statements[0]?.text).toContain('readiness_status');
    expect(statements[0]?.text).not.toMatch(/\breadiness\b/u);
    expect(statements[0]?.text).toContain('graphile_worker.sva_enqueue_job');
    expect(statements[0]?.text).toContain("identifier => 'plugin_tenant_lifecycle_retry'");
    expect(statements[0]?.values).toEqual(['tenant-a', 'events', 'events-1:1', true]);
  });
  it('reads the persisted activation policy and normalizes bigint revisions', async () => {
    const { executor } = createQueuedExecutor([
      [
        {
          activation_policy: 'required',
          activation_origin: 'policy_reconcile',
          effective_active: true,
          manual_override: null,
          reconcile_id: 'reconcile-1',
          reconciled_at: '2026-08-30T12:00:00.000Z',
          state_revision: '7',
          updated_by: 'migration',
        },
      ],
      [],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.getModuleActivationPolicy('tenant-a', 'ssf')).resolves.toEqual({
      activationPolicy: 'required',
      activationOrigin: 'policy_reconcile',
      effectiveActive: true,
      manualOverride: null,
      reconcileId: 'reconcile-1',
      reconciledAt: '2026-08-30T12:00:00.000Z',
      stateRevision: 7,
      updatedBy: 'migration',
    });
    await expect(repository.getModuleActivationPolicy('tenant-a', 'missing')).resolves.toBeNull();
  });

  it('restores an existing activation snapshot and removes a newly inserted row', async () => {
    const { executor, statements } = createQueuedExecutor([
      [{ acquired: true, changed: true }],
      [{ acquired: true, changed: true }],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.restoreModuleActivation('tenant-a', 'news', {
        activationOrigin: 'policy_reconcile',
        effectiveActive: true,
        manualOverride: null,
        reconcileId: 'reconcile-1',
        reconciledAt: '2026-08-30T12:00:00.000Z',
        stateRevision: 7,
        updatedBy: 'migration',
      })
    ).resolves.toBe(true);
    await expect(repository.restoreModuleActivation('tenant-a', 'events', null)).resolves.toBe(
      true
    );

    expect(statements[0]?.text).toContain('state_revision = $10::bigint + 1');
    expect(statements[0]?.values).toEqual([
      'tenant-a',
      'news',
      true,
      'policy_reconcile',
      true,
      null,
      'reconcile-1',
      '2026-08-30T12:00:00.000Z',
      'migration',
      7,
    ]);
    expect(statements[1]?.text).toContain('DELETE FROM iam.instance_modules');
    expect(statements[1]?.values[2]).toBe(false);
  });

  it('returns false for idempotent module assignment and revocation writes', async () => {
    const { executor } = createQueuedExecutor([
      [{ acquired: true, changed: false }],
      [{ acquired: true, changed: false }],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.assignModule('tenant-a', 'news')).resolves.toBe(false);
    await expect(repository.revokeModule('tenant-a', 'news')).resolves.toBe(false);
  });

  it('surfaces advisory lock conflicts instead of treating them as idempotent writes', async () => {
    const { executor } = createQueuedExecutor([[{ acquired: false, changed: false }]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.assignModule('tenant-a', 'news')).rejects.toThrow(
      'plugin_activation_state_conflict:news'
    );
  });

  it('persists manual enable and disable overrides without deleting activation policy state', async () => {
    const { executor, statements } = createQueuedExecutor([
      [{ acquired: true, changed: true }],
      [{ acquired: true, changed: true }],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.assignModule('tenant-a', 'news')).resolves.toBe(true);
    await expect(repository.revokeModule('tenant-a', 'news')).resolves.toBe(true);

    expect(statements[0]?.text).toContain("activation_origin = 'manual'");
    expect(statements[0]?.text).toContain("SELECT $1, $2, 'manual', true, 'enabled'");
    expect(statements[0]?.text).toContain('pg_try_advisory_xact_lock');
    expect(statements[0]?.text).toContain("manual_override = 'enabled'");
    expect(statements[0]?.text).toContain("activation_policy <> 'required'");
    expect(statements[0]?.text).toContain('UPDATE iam.instance_plugin_lifecycle');
    expect(statements[0]?.text).toContain("retry_kind = 'terminal'");
    expect(statements[0]?.text).toContain('EXISTS (SELECT 1 FROM mutation)');
    expect(statements[1]?.text).toContain('UPDATE iam.instance_modules');
    expect(statements[1]?.text).toContain('pg_try_advisory_xact_lock');
    expect(statements[1]?.text).toContain("manual_override = 'disabled'");
    expect(statements[1]?.text).toContain("activation_policy <> 'required'");
    expect(statements[1]?.text).not.toContain('DELETE FROM iam.instance_modules');
  });

  it('reconciles activation policies deterministically and preserves non-required overrides', async () => {
    const { executor, statements } = createQueuedExecutor([
      [{ acquired: true, changed: true }],
      [{ acquired: true, changed: false }],
      [],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.reconcileModuleActivationPolicies({
        instanceId: 'tenant-a',
        policies: [
          {
            moduleId: 'news',
            activationPolicy: 'automatic',
            manifestVersion: 1,
            policyRevision: 'catalog-7',
          },
          {
            moduleId: 'events',
            activationPolicy: 'required',
            manifestVersion: 1,
            policyRevision: 'catalog-7',
          },
        ],
        preservedModuleIds: ['media'],
        reconcileId: 'reconcile-1',
        actorId: 'system',
      })
    ).resolves.toEqual({
      changedModuleIds: ['events'],
      conflictModuleIds: [],
      unchangedModuleIds: ['news'],
    });

    expect(statements.slice(0, 2).map((item) => item.values[1])).toEqual(['events', 'news']);
    expect(statements[0]?.text).toContain("WHEN EXCLUDED.activation_policy = 'required' THEN true");
    expect(statements[0]?.text).toContain('pg_try_advisory_xact_lock');
    expect(statements[0]?.text).toContain(
      "WHEN iam.instance_modules.manual_override = 'disabled' THEN false"
    );
    expect(statements[0]?.text).toContain("WHEN EXCLUDED.activation_policy = 'required' THEN NULL");
    expect(statements[0]?.text).toContain(
      'policy_revision IS DISTINCT FROM EXCLUDED.policy_revision'
    );
    expect(statements[0]?.values).toEqual([
      'tenant-a',
      'events',
      'required',
      1,
      'catalog-7',
      'reconcile-1',
      'system',
    ]);
    expect(statements[2]?.values).toEqual([
      'tenant-a',
      JSON.stringify({ events: true, media: true, news: true }),
      'reconcile-1',
      'system',
    ]);
  });

  it('deactivates omitted plugin modules while preserving registered host modules', async () => {
    const { executor, statements } = createQueuedExecutor([
      [{ acquired: true, changed: false }],
      [{ module_id: 'retired-plugin', acquired: true, changed: true }],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.reconcileModuleActivationPolicies({
        instanceId: 'tenant-a',
        policies: [
          {
            moduleId: 'events',
            activationPolicy: 'automatic',
            manifestVersion: 1,
            policyRevision: 'events-1',
          },
        ],
        preservedModuleIds: ['media'],
        reconcileId: 'catalog-8',
        actorId: 'system',
      })
    ).resolves.toEqual({
      changedModuleIds: ['retired-plugin'],
      conflictModuleIds: [],
      unchangedModuleIds: ['events'],
    });

    expect(statements[1]?.text).not.toContain("policy_revision <> 'legacy'");
    expect(statements[1]?.text).toContain("activation_policy = 'optional'");
    expect(statements[1]?.text).toContain('effective_active = false');
    expect(statements[1]?.text).not.toContain('manual_override = NULL');
    expect(statements[1]?.values).toEqual([
      'tenant-a',
      JSON.stringify({ events: true, media: true }),
      'catalog-8',
      'system',
    ]);
  });

  it('reports a deterministic conflict when another transaction owns a module lock', async () => {
    const { executor } = createQueuedExecutor([[{ acquired: false, changed: false }], []]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.reconcileModuleActivationPolicies({
        instanceId: 'tenant-a',
        policies: [
          {
            moduleId: 'events',
            activationPolicy: 'automatic',
            manifestVersion: 1,
            policyRevision: 'catalog-7',
          },
        ],
        preservedModuleIds: [],
        reconcileId: 'reconcile-1',
      })
    ).resolves.toEqual({
      changedModuleIds: [],
      conflictModuleIds: ['events'],
      unchangedModuleIds: [],
    });
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

  it('removes module-owned grants but preserves permission definitions and manual grants', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.syncAssignedModuleIam({
        instanceId: 'tenant-a',
        managedModuleIds: ['news'],
        managedContracts: [
          {
            moduleId: 'news',
            permissionIds: ['news.read'],
            permissions: [{ key: 'news.read', description: 'Read news', resourceType: 'news' }],
          },
        ],
        contracts: [],
      })
    ).resolves.toMatchObject({ permissionsUnchanged: 0, grantsUnchanged: 0 });

    expect(statements).toHaveLength(1);
    expect(statements[0]?.text).toContain("role_permission.grant_origin_module_id IN ('news')");
    expect(statements[0]?.text).toContain("role_permission.grant_origin_kind = 'module_sync'");
    expect(statements[0]?.text).not.toContain('DELETE FROM iam.permissions');
  });

  it('revokes module-owned grants removed from an active IAM contract', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createInstanceRegistryRepository(executor);

    await repository.syncAssignedModuleIam({
      instanceId: 'tenant-a',
      managedModuleIds: [],
      managedContracts: [
        {
          moduleId: 'news',
          permissionIds: ['news.read'],
          permissions: [{ key: 'news.read', description: 'Read news', resourceType: 'news' }],
        },
      ],
      contracts: [{ moduleId: 'news', permissionIds: [], permissions: [] }],
    });

    const cleanup = statements.find((statement) =>
      statement.text.includes('DELETE FROM iam.role_permissions')
    );
    expect(cleanup?.text).toContain("grant_origin_module_id IN ('news')");
    expect(cleanup?.text).toContain('FROM jsonb_to_recordset($2::jsonb)');
    expect(cleanup?.values).toEqual(['tenant-a', '[]']);
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
      "role_permission.grant_origin_module_id IN ('events', 'news')"
    );
    expect(rolePermissionCleanup?.text).toContain('FROM jsonb_to_recordset($2::jsonb)');
    expect(rolePermissionCleanup?.text).toContain('active_pair.role_name = role.role_key');
    expect(rolePermissionCleanup?.values).toEqual([
      'tenant-a',
      JSON.stringify([
        { module_id: 'news', role_name: 'system_admin', permission_id: 'news.read' },
      ]),
    ]);
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
