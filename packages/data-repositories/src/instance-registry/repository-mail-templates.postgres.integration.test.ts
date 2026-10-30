/** Creates and drops its own local database; never migrates an existing Studio database. */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
  DEFAULT_EMAIL_VERIFICATION_TEMPLATE,
} from '@sva/core';
import type { SqlExecutor } from '../iam/repositories/types';
import { createMailTemplateRepository } from './repository-mail-templates';
const enabled = Boolean(
  process.env.INSTANCE_PROVISIONING_INTEGRATION_DB || process.env.MAIL_TEMPLATES_TEST_ADMIN_URL
);
const adminUrl = new URL(
  process.env.MAIL_TEMPLATES_TEST_ADMIN_URL ?? 'postgresql://127.0.0.1/postgres'
);
if (!process.env.MAIL_TEMPLATES_TEST_ADMIN_URL) {
  adminUrl.username = process.env.POSTGRES_USER ?? 'sva';
  adminUrl.password = process.env.POSTGRES_PASSWORD ?? 'sva_local_dev_password';
  adminUrl.port = process.env.POSTGRES_PORT ?? process.env.POSTGRES_HOST_PORT ?? '5432';
}
if (enabled && !['127.0.0.1', 'localhost', '[::1]'].includes(adminUrl.hostname))
  throw new Error('local_test_database_required');
const admin = new Pool({ connectionString: adminUrl.toString() });
const name = `mail_templates_${randomUUID().replaceAll('-', '')}_test`;
let pool: Pool;
let created = false;
let createdRole = false;
const migration = await readFile(
  new URL('../../../data/migrations/0111_iam_instance_mail_templates.sql', import.meta.url),
  'utf8'
);
const [up, down] = migration.split('-- +goose Down');
if (!up || !down) throw new Error('migration_sections_missing');
const template = { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, revision: 3 };
const executor: SqlExecutor = {
  execute: async (statement) => {
    const result = await pool.query(statement.text, [...statement.values]);
    return { rowCount: result.rowCount ?? 0, rows: result.rows };
  },
};
const repo = createMailTemplateRepository(executor);
describe.skipIf(!enabled)('mail template migration and PostgreSQL concurrency', () => {
  beforeAll(async () => {
    if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='iam_app'")).rowCount) {
      await admin.query('CREATE ROLE iam_app NOLOGIN');
      createdRole = true;
    }
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    const connection = new URL(adminUrl);
    connection.pathname = `/${name}`;
    pool = new Pool({ connectionString: connection.toString() });
    await pool.query(`CREATE SCHEMA iam; GRANT USAGE ON SCHEMA iam TO iam_app;
    CREATE FUNCTION iam.current_instance_id() RETURNS text LANGUAGE sql STABLE AS $$SELECT NULLIF(current_setting('app.instance_id',true),'')$$;
    CREATE TABLE iam.instances(id text PRIMARY KEY, account_invitation_template jsonb, updated_by text, updated_at timestamptz, CONSTRAINT instances_account_invitation_template_chk CHECK(account_invitation_template IS NULL OR jsonb_typeof(account_invitation_template)='object'));
    GRANT SELECT, UPDATE ON iam.instances TO iam_app;
    ALTER TABLE iam.instances ENABLE ROW LEVEL SECURITY;
    ALTER TABLE iam.instances FORCE ROW LEVEL SECURITY;
    CREATE POLICY instance_scope ON iam.instances USING (iam.current_instance_id() IS NULL OR id=iam.current_instance_id()) WITH CHECK (iam.current_instance_id() IS NULL OR id=iam.current_instance_id());`);
    await pool.query(
      "INSERT INTO iam.instances(id,account_invitation_template) VALUES ('a',$1),('b',NULL)",
      [JSON.stringify(template)]
    );
    const oldGlobal = await readFile(
      new URL(
        '../../../data/migrations/0098_iam_server_account_invitation_template.sql',
        import.meta.url
      ),
      'utf8'
    );
    await pool.query(oldGlobal.split('-- +goose Down')[0] ?? '');
    await pool.query(`ALTER TABLE iam.server_account_invitation_templates ADD COLUMN default_purpose text;
      ALTER POLICY server_account_invitation_templates_platform_scope ON iam.server_account_invitation_templates USING(true);
      GRANT SELECT, UPDATE ON iam.server_account_invitation_templates TO iam_app;`);
    await pool.query(
      "UPDATE iam.server_account_invitation_templates SET revision=3,template=$1,default_purpose='ssf' WHERE template_key='account_invitation'",
      [JSON.stringify(template)]
    );
    await pool.query(up);
  });
  afterAll(async () => {
    await pool?.end();
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    if (createdRole) await admin.query('DROP ROLE iam_app');
    await admin.end();
  });
  it('preserves existing source and starts both kinds unreviewed', async () => {
    expect(await repo.getInstanceMailTemplate('a', 'invitation')).toMatchObject({
      revision: 3,
      template,
      syncStatus: 'unreviewed',
    });
    expect(await repo.getInstanceMailTemplate('a', 'verification')).toMatchObject({
      revision: 0,
      template: null,
      syncStatus: 'unreviewed',
    });
  });
  it('allows exactly one concurrent save and prevents reset ABA', async () => {
    const input = {
      instanceId: 'a',
      kind: 'invitation' as const,
      expectedRevision: 3,
      template: null,
    };
    const results = await Promise.allSettled([
      repo.saveInstanceMailTemplate(input),
      repo.saveInstanceMailTemplate(input),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect((await repo.getInstanceMailTemplate('a', 'invitation')).revision).toBe(4);
    await expect(repo.saveInstanceMailTemplate({ ...input, expectedRevision: 0 })).rejects.toThrow(
      'mail_template_revision_conflict'
    );
  });
  it('preserves saved source when sync fails and rejects stale confirmations', async () => {
    await repo.saveInstanceMailTemplate({
      instanceId: 'a',
      kind: 'verification',
      expectedRevision: 0,
      template: DEFAULT_EMAIL_VERIFICATION_TEMPLATE,
    });
    expect(
      await repo.recordMailTemplateSync({
        instanceId: 'a',
        kind: 'verification',
        expectedRevision: 0,
        status: 'synced',
        realm: 'a',
        texts: {},
      })
    ).toBe(false);
    await repo.recordMailTemplateSync({
      instanceId: 'a',
      kind: 'verification',
      expectedRevision: 1,
      status: 'failed',
    });
    expect((await repo.getInstanceMailTemplate('a', 'verification')).template).toEqual(
      DEFAULT_EMAIL_VERIFICATION_TEMPLATE
    );
    expect(await repo.getInstanceMailTemplate('a', 'verification')).toMatchObject({
      template: expect.objectContaining(DEFAULT_EMAIL_VERIFICATION_TEMPLATE),
      syncStatus: 'failed',
    });
  });
  it('enforces tenant isolation on reads and writes', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE iam_app');
      await client.query("SELECT set_config('app.instance_id','a',true)");
      expect(
        (await client.query('SELECT DISTINCT instance_id FROM iam.instance_mail_templates')).rows
      ).toEqual([{ instance_id: 'a' }]);
      await expect(
        client.query(
          "UPDATE iam.instance_mail_templates SET instance_id='b' WHERE instance_id='a' AND template_kind='verification'"
        )
      ).rejects.toThrow();
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it('preserves the invitation standard and adds a separate confirmation standard', async () => {
    expect(
      (
        await pool.query(
          "SELECT revision,template,default_purpose FROM iam.server_account_invitation_templates WHERE template_key='account_invitation'"
        )
      ).rows[0]
    ).toEqual({ revision: 3, template, default_purpose: 'ssf' });
    expect(await repo.getServerEmailVerificationTemplate()).toEqual({
      revision: 0,
      template: null,
    });
    const source = { ...DEFAULT_EMAIL_VERIFICATION_TEMPLATE, subject: 'Allgemeine Bestätigung' };
    await repo.saveServerEmailVerificationTemplate({
      expectedRevision: 0,
      template: source,
      actorId: 'admin',
    });
    expect(await repo.getServerEmailVerificationTemplate()).toEqual({
      revision: 1,
      template: source,
    });
    await expect(
      repo.saveServerEmailVerificationTemplate({
        expectedRevision: 0,
        template: null,
        actorId: 'admin',
      })
    ).rejects.toThrow('mail_template_revision_conflict');
    const reset = await repo.saveServerEmailVerificationTemplate({
      expectedRevision: 1,
      template: null,
      actorId: 'admin',
    });
    expect(reset).toEqual({ revision: 2, template: null });
    expect(
      (
        await pool.query(
          "SELECT template FROM iam.server_account_invitation_templates WHERE template_key='account_invitation'"
        )
      ).rows[0].template
    ).toEqual(template);
  });
  it('lets tenants read but never change the global standard', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE iam_app');
      await client.query("SELECT set_config('app.instance_id','a',true)");
      expect(
        (
          await client.query(
            "SELECT revision FROM iam.server_account_invitation_templates WHERE template_key='email_verification'"
          )
        ).rowCount
      ).toBe(1);
      await expect(
        client.query(
          "UPDATE iam.server_account_invitation_templates SET template=NULL WHERE template_key='email_verification'"
        )
      ).rejects.toThrow();
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it('keeps old reads and writes compatible with the canonical source across rollback', async () => {
    await pool.query("INSERT INTO iam.instances(id) VALUES ('c')");
    expect((await repo.getInstanceMailTemplate('c', 'invitation')).revision).toBe(0);
    const oldSave = await pool.query(
      "UPDATE iam.instances SET account_invitation_template=$1 WHERE id='c' AND COALESCE((account_invitation_template->>'revision')::integer,0)=0 RETURNING account_invitation_template",
      [JSON.stringify({ ...template, revision: 1 })]
    );
    expect(oldSave.rowCount).toBe(1);
    expect((await repo.getInstanceMailTemplate('c', 'invitation')).revision).toBe(1);
    const saved = await repo.saveInstanceMailTemplate({
      instanceId: 'c',
      kind: 'invitation',
      expectedRevision: 1,
      template,
    });
    expect(saved.revision).toBe(2);
    expect(
      (await pool.query("SELECT account_invitation_template FROM iam.instances WHERE id='c'"))
        .rows[0].account_invitation_template
    ).toEqual(saved.template);
    await pool.query("UPDATE iam.instances SET account_invitation_template=NULL WHERE id='c'");
    expect((await repo.getInstanceMailTemplate('c', 'invitation')).revision).toBe(3);
    await expect(
      repo.saveInstanceMailTemplate({
        instanceId: 'c',
        kind: 'invitation',
        expectedRevision: 0,
        template,
      })
    ).rejects.toThrow('mail_template_revision_conflict');
    await pool.query("UPDATE iam.instances SET account_invitation_template=$1 WHERE id='c'", [
      JSON.stringify({ ...template, revision: 1 }),
    ]);
    expect((await repo.getInstanceMailTemplate('c', 'invitation')).revision).toBe(4);
    expect(
      (await pool.query("SELECT account_invitation_template FROM iam.instances WHERE id='c'"))
        .rows[0].account_invitation_template.revision
    ).toBe(4);
    await repo.recordMailTemplateSync({
      instanceId: 'c',
      kind: 'invitation',
      expectedRevision: 4,
      status: 'synced',
    });
    expect((await repo.getInstanceMailTemplate('c', 'invitation')).revision).toBe(4);
  });
  it('serializes concurrent old and new writers without deadlocks', async () => {
    const results = await Promise.allSettled([
      pool.query(
        "UPDATE iam.instances SET account_invitation_template=$1 WHERE id='c' AND COALESCE((account_invitation_template->>'revision')::integer,0)=4 RETURNING id",
        [JSON.stringify({ ...template, revision: 5 })]
      ),
      repo.saveInstanceMailTemplate({
        instanceId: 'c',
        kind: 'invitation',
        expectedRevision: 4,
        template: null,
      }),
    ]);
    expect(
      results.filter(
        (r) =>
          r.status === 'fulfilled' &&
          ('rowCount' in r.value ? r.value.rowCount === 1 : r.value.revision === 5)
      )
    ).toHaveLength(1);
    expect((await repo.getInstanceMailTemplate('c', 'invitation')).revision).toBe(5);
  }, 5000);
  it('denies a tenant writing another instance through the compatibility function', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE iam_app');
      await client.query("SELECT set_config('app.instance_id','a',true)");
      await expect(
        client.query("SELECT * FROM iam.save_instance_invitation_template('b',0,NULL,NULL)")
      ).rejects.toThrow('mail_template_revision_conflict');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it('restores invitation sources on down migration', async () => {
    const saved = await repo.saveInstanceMailTemplate({
      instanceId: 'a',
      kind: 'invitation',
      expectedRevision: 4,
      template,
    });
    await pool.query(down);
    expect(
      (await pool.query("SELECT account_invitation_template FROM iam.instances WHERE id='a'"))
        .rows[0].account_invitation_template
    ).toEqual(saved.template);
  });
});
