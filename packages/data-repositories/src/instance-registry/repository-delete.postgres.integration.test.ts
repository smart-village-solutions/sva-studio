/** Exercises the real schema, RLS and cascades in a disposable local database. */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createInstanceRegistryRepository } from './index.js';

const enabled = Boolean(process.env.MAIL_TEMPLATES_TEST_ADMIN_URL);
const url = new URL(process.env.MAIL_TEMPLATES_TEST_ADMIN_URL ?? 'postgresql://localhost/postgres');
if (enabled && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('local_test_database_required');
const admin = new Pool({ connectionString: url.toString() });
const database = `tenant_delete_${randomUUID().replaceAll('-', '')}`;
const migration = await readFile(new URL('../../../data/migrations/0114_iam_studio_instance_delete.sql', import.meta.url), 'utf8');
let pool: Pool;
let client: PoolClient;
let created = false;
const updatedAt = '2026-11-08 00:00:00.123456+00';
const accountId = '00000000-0000-4000-8000-000000000001';
const orgId = '00000000-0000-4000-8000-000000000002';
const manifestId = '00000000-0000-4000-8000-000000000003';
const releaseId = '00000000-0000-4000-8000-000000000004';
const repo = () => createInstanceRegistryRepository({ execute: async (statement) => {
  const result = await client.query(statement.text, [...statement.values]);
  return { rowCount: result.rowCount ?? 0, rows: result.rows };
} });
const remove = () => repo().deleteInstance({ instanceId: 'old', expectedUpdatedAt: updatedAt, actorId: 'platform-admin', requestId: 'delete-test' });

describe.skipIf(!enabled)('Studio-only tenant deletion on PostgreSQL', () => {
  beforeAll(async () => {
    await admin.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='iam_app') THEN CREATE ROLE iam_app NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='iam_observability') THEN CREATE ROLE iam_observability NOLOGIN; END IF;
    END $$`);
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    const connection = new URL(url); connection.pathname = `/${database}`;
    pool = new Pool({ connectionString: connection.toString() });
    const schema = await readFile(new URL('../../../../docs/development/studio-db-schema-final.sql', import.meta.url), 'utf8');
    await pool.query(schema.replace(/^\\.*$/gm, ''));
    await pool.query(`SET row_security=on; GRANT USAGE ON SCHEMA iam TO iam_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO iam_app;
      REVOKE UPDATE, DELETE ON iam.app_translation_manifests, iam.app_translation_catalog_releases FROM iam_app;
      REVOKE DELETE ON iam.app_translation_catalog_drafts FROM iam_app;`);
    // The final schema includes 0114; exercise its Down/Up compatibility too.
    if ((await pool.query("SELECT to_regprocedure('iam.delete_studio_instance(text,timestamptz,text,text)') AS f")).rows[0].f) {
      await pool.query(migration.split('-- +goose Down')[1] ?? '');
    }
    await pool.query(migration.split('-- +goose Down')[0] ?? '');
  });
  afterAll(async () => {
    await pool?.end();
    if (created) await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  });
  beforeEach(async () => {
    client = await pool.connect(); await client.query('BEGIN');
    for (const id of ['old', 'staging']) await client.query(`INSERT INTO iam.instances
      (id,display_name,status,parent_domain,primary_hostname,auth_realm,auth_client_id,tenant_admin_client_id,auth_client_secret_ciphertext,updated_at)
      VALUES ($1,$1,'archived','example.test',$1||'.example.test',$1,'login','admin','encrypted-secret',$2)`, [id, updatedAt]);
    await client.query(`INSERT INTO iam.accounts(id,keycloak_subject,instance_id) VALUES ($1,'preserved-keycloak-user','old');
      `, [accountId]);
    await client.query("INSERT INTO iam.instance_memberships(instance_id,account_id) VALUES ('old',$1)", [accountId]);
    await client.query("INSERT INTO iam.organizations(id,organization_key,display_name,instance_id) VALUES ($1,'test','Test','old')", [orgId]);
    await client.query("INSERT INTO iam.instance_hostnames(hostname,instance_id) VALUES ('old.example.test','old'),('alias.example.test','old')");
    await client.query("INSERT INTO iam.activity_logs(instance_id,event_type) VALUES ('old','test')");
    await client.query(`INSERT INTO iam.app_translation_manifests(id,contract_id,manifest_version,manifest,digest)
      VALUES ($1,'test','1','{}',repeat('a',64))`, [manifestId]);
    await client.query(`INSERT INTO iam.app_translation_catalog_releases(id,scope,contract_id,manifest_id,catalog_set_revision,draft_revision,supported_locales,payload,checksum)
      VALUES ($1,'global','test',$2,1,1,'["de"]','{}',repeat('b',64))`, [releaseId, manifestId]);
    await client.query(`INSERT INTO iam.app_translation_catalog_releases(scope,instance_id,organization_id,contract_id,manifest_id,base_release_id,catalog_set_revision,draft_revision,supported_locales,payload,checksum)
      VALUES ('municipal','old',$1,'test',$2,$3,1,1,'["de"]','{}',repeat('c',64))`, [orgId, manifestId, releaseId]);
    await client.query(`INSERT INTO iam.app_translation_catalog_drafts(scope,instance_id,organization_id,contract_id,manifest_id,base_release_id,supported_locales)
      VALUES ('municipal','old',$1,'test',$2,$3,'["de"]')`, [orgId, manifestId, releaseId]);
    await client.query(`INSERT INTO iam.app_translation_catalog_drafts(scope,contract_id,manifest_id,supported_locales)
      VALUES ('global','test',$1,'["de"]')`, [manifestId]);
    await client.query(`INSERT INTO iam.media_content_save_operations(id,instance_id,actor_subject,target_type,target_id,status,expires_at)
      VALUES ('00000000-0000-4000-8000-000000000010','old','test','news','test-content','committed',now()+interval '1 day');
      INSERT INTO iam.media_assets(id,instance_id,storage_key,media_type,mime_type,byte_size,visibility,upload_status,processing_status)
      VALUES ('00000000-0000-4000-8000-000000000011','old','old/test.png','image','image/png',1,'public','processed','ready');
      INSERT INTO iam.media_content_save_operation_references(id,instance_id,operation_id,asset_id,role)
      VALUES ('00000000-0000-4000-8000-000000000012','old','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000011','gallery')`);
    await client.query("SET LOCAL ROLE iam_app; SELECT set_config('app.instance_id','old',true)");
  });
  afterEach(async () => { await client?.query('ROLLBACK'); client?.release(); });

  it('removes local tenant data and secrets, preserves staging, global catalogs and deletion evidence', async () => {
    expect(await remove()).toBe(true);
    expect(await remove()).toBe(false);
    await client.query('RESET ROLE');
    for (const table of ['instances','instance_hostnames','accounts','instance_memberships','organizations','activity_logs','app_translation_catalog_releases','app_translation_catalog_drafts','media_assets','media_content_save_operations','media_content_save_operation_references']) {
      const column = table === 'instances' ? 'id' : 'instance_id';
      expect((await client.query(`SELECT count(*)::int AS n FROM iam.${table} WHERE ${column}='old'`)).rows[0].n).toBe(0);
    }
    expect((await client.query("SELECT auth_client_secret_ciphertext FROM iam.instances WHERE id='staging'")).rows[0].auth_client_secret_ciphertext).toBe('encrypted-secret');
    expect((await client.query('SELECT count(*)::int AS n FROM iam.app_translation_catalog_releases')).rows[0].n).toBe(1);
    expect((await client.query("SELECT payload FROM iam.platform_activity_logs WHERE event_type='instance.deleted'")).rows).toEqual([{payload:{instanceId:'old'}}]);
  });
  it('rolls back all local deletions when the final audit insert fails', async () => {
    await client.query('RESET ROLE; REVOKE INSERT ON iam.platform_activity_logs FROM iam_app; SET LOCAL ROLE iam_app; SAVEPOINT before_delete');
    await expect(remove()).rejects.toThrow('permission denied');
    await client.query('ROLLBACK TO SAVEPOINT before_delete; RESET ROLE');
    expect((await client.query("SELECT count(*)::int AS n FROM iam.instances WHERE id='old'")).rows[0].n).toBe(1);
    expect((await client.query("SELECT count(*)::int AS n FROM iam.activity_logs WHERE instance_id='old'")).rows[0].n).toBe(1);
    expect((await client.query("SELECT count(*)::int AS n FROM iam.app_translation_catalog_releases WHERE instance_id='old'")).rows[0].n).toBe(1);
  });
  it('rejects an active tenant and a stale confirmation without deleting data', async () => {
    await client.query("UPDATE iam.instances SET status='active' WHERE id='old'");
    await expect(remove()).rejects.toThrow('instance_delete_conflict');
  });
  it('rejects changed tenant state', async () => {
    await client.query("UPDATE iam.instances SET updated_at=now() WHERE id='old'");
    await expect(remove()).rejects.toThrow('instance_delete_conflict');
  });
  it('rejects a foreign tenant scope', async () => {
    await client.query("SELECT set_config('app.instance_id','staging',true)");
    await expect(remove()).rejects.toThrow('instance_delete_scope_mismatch');
  });
  it('preserves active legal holds', async () => {
    await client.query("INSERT INTO iam.legal_holds(instance_id,account_id,hold_reason) VALUES ('old',$1,'test')", [accountId]);
    await expect(remove()).rejects.toThrow('instance_delete_legal_hold');
  });
  it('blocks pending work that could still mutate external systems', async () => {
    await client.query(`INSERT INTO iam.studio_jobs(id,instance_id,job_type_id,queue_name,status,input_payload,idempotency_key,scheduled_at)
      VALUES (gen_random_uuid(),'old','test','test','running','{}','test',now())`);
    await expect(remove()).rejects.toThrow('instance_delete_busy');
  });
  it('preserves municipal and global drafts in ordinary catalog sessions', async () => {
    await client.query("SELECT set_config('app.organization_id',$1,true)", [orgId]);
    expect((await client.query("SELECT id FROM iam.app_translation_catalog_drafts WHERE instance_id='old'")).rowCount).toBe(1);
    expect((await client.query("UPDATE iam.app_translation_catalog_drafts SET draft_revision=draft_revision+1 WHERE instance_id='old'")).rowCount).toBe(1);
    expect((await client.query("DELETE FROM iam.app_translation_catalog_drafts WHERE instance_id='old'")).rowCount).toBe(0);
    await client.query("SELECT set_config('app.instance_id','',true), set_config('app.organization_id','',true), set_config('app.catalog_platform','true',true)");
    expect((await client.query("SELECT id FROM iam.app_translation_catalog_drafts WHERE scope='global'")).rowCount).toBe(1);
    expect((await client.query("UPDATE iam.app_translation_catalog_drafts SET draft_revision=draft_revision+1 WHERE scope='global'")).rowCount).toBe(1);
    expect((await client.query("DELETE FROM iam.app_translation_catalog_drafts WHERE scope='global'")).rowCount).toBe(0);
  });
  it('keeps sealed catalogs immutable outside the deletion function', async () => {
    await client.query("SELECT set_config('app.organization_id',$1,true)", [orgId]);
    expect((await client.query("DELETE FROM iam.app_translation_catalog_releases WHERE instance_id='old'")).rowCount).toBe(0);
    expect((await client.query("SELECT count(*)::int AS n FROM iam.app_translation_catalog_releases WHERE instance_id='old'")).rows[0].n).toBe(1);
    await client.query('RESET ROLE');
    await expect(client.query("DELETE FROM iam.app_translation_catalog_releases WHERE instance_id='old'")).rejects.toThrow('app_translation_revision_immutable');
  });
});
