/** Runs only against a disposable local PostgreSQL database. */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  standardEditorContentModules,
  standardEditorPermissionKeys,
  resolveStandardEditorPermissionScope,
  tenantCorePermissionCatalog,
} from '@sva/core';
import { createInstanceRegistryRepository } from './index.js';

const enabled = Boolean(process.env.MAIL_TEMPLATES_TEST_ADMIN_URL);
const url = new URL(process.env.MAIL_TEMPLATES_TEST_ADMIN_URL ?? 'postgresql://localhost/postgres');
if (enabled && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('local_test_database_required');
const admin = new Pool({ connectionString: url.toString() });
const migration = (
  await readFile(
    new URL('../../../data/migrations/0116_iam_standard_editor_role.sql', import.meta.url),
    'utf8'
  )
).split('-- +goose Down')[0]!;
let pool: Pool;
let database: string;
const repo = () =>
  createInstanceRegistryRepository({
    execute: async (statement) => {
      const result = await pool.query(statement.text, [...statement.values]);
      return { rowCount: result.rowCount ?? 0, rows: result.rows };
    },
  });
const addTenant = (id: string) =>
  pool.query(
    `INSERT INTO iam.instances
  (id, display_name, status, parent_domain, primary_hostname, auth_realm, auth_client_id, tenant_admin_client_id)
  VALUES ($1,$1,'active','example.test',$1||'.example.test',$1,'studio','admin')`,
    [id]
  );
const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(migration);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
const readRole = async (id: string) =>
  (
    await pool.query(
      `SELECT id, role_key, display_name, is_system_role, managed_by, sync_state
  FROM iam.roles WHERE instance_id=$1 AND role_key='standard_editor'`,
      [id]
    )
  ).rows;
const readGrants = async (id: string) =>
  (
    await pool.query(
      `SELECT permission.permission_key AS key, grant_row.access_scope AS scope
  FROM iam.role_permissions grant_row JOIN iam.roles role ON role.instance_id=grant_row.instance_id AND role.id=grant_row.role_id
  JOIN iam.permissions permission ON permission.instance_id=grant_row.instance_id AND permission.id=grant_row.permission_id
  WHERE role.instance_id=$1 AND role.role_key='standard_editor' ORDER BY permission.permission_key`,
      [id]
    )
  ).rows;
const syncCore = (id: string) =>
  repo().syncProtectedSystemRolePermissions({
    instanceId: id,
    role: {
      roleKey: 'system_admin',
      displayName: 'System Administrator',
      roleLevel: 100,
      permissions: tenantCorePermissionCatalog,
      grantPermissionKeys: tenantCorePermissionCatalog.map((permission) => permission.key),
    },
  });
const syncNews = (id: string) =>
  repo().syncAssignedModuleIam({
    instanceId: id,
    managedModuleIds: ['news'],
    contracts: [
      {
        moduleId: 'news',
        permissions: [
          'news.read',
          'news.create',
          'news.update',
          'news.delete',
          'news.pushNotification',
        ].map((key) => ({ key, resourceType: 'news', description: key })),
        systemRoles: [
          {
            roleName: 'system_admin',
            permissionIds: [
              'news.read',
              'news.create',
              'news.update',
              'news.delete',
              'news.pushNotification',
            ],
          },
        ],
      },
    ],
  });

describe.skipIf(!enabled)('standard editor lifecycle on PostgreSQL', () => {
  beforeAll(async () => {
    await admin.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='iam_app') THEN CREATE ROLE iam_app NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='iam_observability') THEN CREATE ROLE iam_observability NOLOGIN; END IF;
  END $$`);
  });
  beforeEach(async () => {
    database = `editor_${randomUUID().replaceAll('-', '')}`;
    await admin.query(`CREATE DATABASE "${database}"`);
    const connection = new URL(url);
    connection.pathname = `/${database}`;
    pool = new Pool({ connectionString: connection.toString() });
    const schema = await readFile(
      new URL('../../../../docs/development/studio-db-schema-final.sql', import.meta.url),
      'utf8'
    );
    await pool.query(schema.replace(/^\\.*$/gm, ''));
    await addTenant('tenant-a');
    await addTenant('tenant-b');
    await pool.query(
      `INSERT INTO iam.instance_modules(instance_id,module_id) VALUES ('tenant-a','news'),('tenant-b','events')`
    );
  });
  afterEach(async () => {
    await pool?.end();
    if (database) await admin.query(`DROP DATABASE "${database}"`);
  });
  afterAll(async () => {
    await admin.end();
  });

  it('backfills both tenants, verifies exact scopes and preserves roles without assigning members', async () => {
    await syncCore('tenant-a');
    await migrate();
    for (const id of ['tenant-a', 'tenant-b']) {
      expect(await readRole(id)).toMatchObject([
        {
          display_name: 'Standard Redakteur',
          is_system_role: false,
          managed_by: 'studio',
          sync_state: 'synced',
        },
      ]);
      const grants = await readGrants(id);
      const moduleId = id === 'tenant-a' ? 'news' : 'events';
      const expectedKeys = standardEditorPermissionKeys.filter(
        (key) =>
          key.startsWith('content.') ||
          key === 'modules.read' ||
          key.startsWith('media.') ||
          key.startsWith('categories.') ||
          key.startsWith(`${moduleId}.`)
      );
      expect(grants).toEqual(
        expectedKeys
          .sort()
          .map((key) => ({ key, scope: resolveStandardEditorPermissionScope(key) }))
      );
    }
    expect((await pool.query('SELECT * FROM iam.account_roles')).rowCount).toBe(0);
    expect(
      (await pool.query("SELECT * FROM iam.roles WHERE role_key='system_admin'")).rowCount
    ).toBe(1);
    const before = await readGrants('tenant-a');
    await migrate();
    expect(await readGrants('tenant-a')).toEqual(before);
  });

  it('covers every supported content module and keeps module sync tenant local', async () => {
    await pool.query(
      `INSERT INTO iam.instance_modules(instance_id,module_id)
      SELECT 'tenant-a', unnest($1::text[]) ON CONFLICT DO NOTHING`,
      [[...standardEditorContentModules]]
    );
    await migrate();
    expect(await readGrants('tenant-a')).toEqual(
      [...standardEditorPermissionKeys]
        .sort()
        .map((key) => ({ key, scope: resolveStandardEditorPermissionScope(key) }))
    );
    const otherTenantGrants = await readGrants('tenant-b');
    await syncNews('tenant-a');
    expect(await readGrants('tenant-b')).toEqual(otherTenantGrants);
    expect(otherTenantGrants.some((grant) => grant.key.startsWith('news.'))).toBe(false);
  });

  it('creates the default atomically with a new tenant and never restores it on a create retry or reconcile', async () => {
    const input = {
      instanceId: 'new-tenant',
      displayName: 'New',
      status: 'active' as const,
      parentDomain: 'example.test',
      primaryHostname: 'new-tenant.example.test',
      realmMode: 'new' as const,
      authRealm: 'new-tenant',
      authClientId: 'studio',
      tenantAdminClient: { clientId: 'admin' },
    };
    expect(await repo().createInstance(input)).not.toBeNull();
    await syncCore(input.instanceId);
    await syncNews(input.instanceId);
    expect(
      (await readGrants(input.instanceId)).some(
        (grant) => grant.key === 'news.pushNotification' && grant.scope === 'organization'
      )
    ).toBe(true);
    await pool.query("DELETE FROM iam.roles WHERE instance_id=$1 AND role_key='standard_editor'", [
      input.instanceId,
    ]);
    expect(await repo().createInstance(input)).toBeNull();
    await syncCore(input.instanceId);
    await syncNews(input.instanceId);
    expect(await readRole(input.instanceId)).toEqual([]);
  });

  it('preserves a deliberately deleted backfill role during later module and core sync', async () => {
    await migrate();
    await pool.query(
      "DELETE FROM iam.roles WHERE instance_id='tenant-a' AND role_key='standard_editor'"
    );
    await syncCore('tenant-a');
    await syncNews('tenant-a');
    expect(await readRole('tenant-a')).toEqual([]);
    expect(await readRole('tenant-b')).toHaveLength(1);
  });

  it.each(['standard_editor', 'custom-editor'])(
    'rolls back all tenants on conflicting identity %s',
    async (key) => {
      await pool.query(
        `INSERT INTO iam.roles(instance_id,role_key,role_name,display_name,external_role_name)
      VALUES ('tenant-b',$1,$1,'Standard Redakteur',$1)`,
        [key]
      );
      await expect(migrate()).rejects.toThrow('standard_editor_profile_conflict');
      expect(await readRole('tenant-a')).toEqual([]);
      expect((await pool.query('SELECT * FROM iam.roles')).rowCount).toBe(1);
      expect((await pool.query('SELECT * FROM iam.role_permissions')).rowCount).toBe(0);
    }
  );

  it.each([
    ['role_name', 'custom_name'],
    ['external_role_name', 'external_editor'],
    ['role_level', 90],
    ['description', 'individually customized role'],
  ] as const)(
    'preserves an existing profile with noncanonical %s and stops the migration',
    async (field, value) => {
      await migrate();
      await pool.query(
        `UPDATE iam.roles SET ${field}=$1 WHERE instance_id='tenant-a' AND role_key='standard_editor'`,
        [value]
      );
      const before = await pool.query(
        "SELECT * FROM iam.roles WHERE instance_id='tenant-a' AND role_key='standard_editor'"
      );
      await expect(migrate()).rejects.toThrow('standard_editor_profile_conflict');
      expect(
        (
          await pool.query(
            "SELECT * FROM iam.roles WHERE instance_id='tenant-a' AND role_key='standard_editor'"
          )
        ).rows
      ).toEqual(before.rows);
    }
  );

  it('rejects drifted permission definitions without modifying existing privileges', async () => {
    await pool.query(`INSERT INTO iam.permissions(instance_id,permission_key,action,resource_type)
      VALUES ('tenant-a','news.read','iam.user.write','iam')`);
    await expect(migrate()).rejects.toThrow('standard_editor_permission_conflict');
    expect(await readRole('tenant-a')).toEqual([]);
    expect(
      (await pool.query("SELECT action FROM iam.permissions WHERE instance_id='tenant-a'")).rows
    ).toEqual([{ action: 'iam.user.write' }]);
  });

  it('rolls back a grant failure and succeeds on retry without duplicate roles', async () => {
    await pool.query(`CREATE FUNCTION public.fail_editor_grant() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected_grant_failure'; END $$;
      CREATE TRIGGER fail_editor_grant BEFORE INSERT ON iam.role_permissions FOR EACH ROW EXECUTE FUNCTION public.fail_editor_grant()`);
    await expect(migrate()).rejects.toThrow('injected_grant_failure');
    expect(await readRole('tenant-a')).toEqual([]);
    await pool.query('DROP TRIGGER fail_editor_grant ON iam.role_permissions');
    await migrate();
    expect(await readRole('tenant-a')).toHaveLength(1);
    expect(await readRole('tenant-b')).toHaveLength(1);
  });

  it('adds later module grants without widening customized grants and removes only module-owned grants', async () => {
    await migrate();
    await pool.query(`UPDATE iam.role_permissions SET access_scope='own', grant_origin_kind='manual', grant_origin_module_id=NULL
      WHERE role_id=(SELECT id FROM iam.roles WHERE instance_id='tenant-a' AND role_key='standard_editor')
      AND permission_id=(SELECT id FROM iam.permissions WHERE instance_id='tenant-a' AND permission_key='news.update')`);
    await syncNews('tenant-a');
    expect((await readGrants('tenant-a')).find((grant) => grant.key === 'news.update')?.scope).toBe(
      'own'
    );
    await repo().syncAssignedModuleIam({
      instanceId: 'tenant-a',
      managedModuleIds: ['news'],
      contracts: [],
    });
    expect((await readGrants('tenant-a')).filter((grant) => grant.key.startsWith('news.'))).toEqual(
      [{ key: 'news.update', scope: 'own' }]
    );
  });
});
