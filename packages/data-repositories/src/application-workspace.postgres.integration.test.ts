/** Real PostgreSQL CAS/RLS checks; requires an explicitly disposable *_test database. */
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { readApplicationWorkspace, saveApplicationWorkspace } from './application-workspace.js';
const url = process.env.APPLICATION_WORKSPACE_TEST_DATABASE_URL;
const pool = url ? new Pool({ connectionString: url, max: 4 }) : null;
const a = `workspace-a-${randomUUID()}`,
  b = `workspace-b-${randomUUID()}`;
const tx = async <T>(instance: string | null, work: (client: PoolClient) => Promise<T>) => {
  const client = await pool!.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE iam_app');
    await client.query("SELECT set_config('app.instance_id',$1,true)", [instance ?? '']);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
describe.skipIf(!url)('application workspace PostgreSQL', () => {
  beforeAll(async () => {
    if (!url || !/^\/[^/]+_test$/.test(new URL(url).pathname))
      throw Error('disposable_test_database_required');
    await pool!.query(
      `INSERT INTO iam.instances(id,display_name,primary_hostname,tenant_admin_client_id,auth_realm,auth_client_id) VALUES ($1,'Workspace A',$3,'tenant-admin',$1,'studio'),($2,'Workspace B',$4,'tenant-admin',$2,'studio')`,
      [a, b, `${a}.test`, `${b}.test`]
    );
  });
  afterAll(async () => {
    await pool!.query('DELETE FROM iam.instances WHERE id=ANY($1::text[])', [[a, b]]);
    await pool!.end();
  });
  it('persists and independently reads a first configuration', async () => {
    const saved = await tx(a, (c) =>
      saveApplicationWorkspace(c, a, { version: 0, tiles: [{ id: 'one' }] })
    );
    expect(saved.version).toBe(1);
    expect(await tx(a, (c) => readApplicationWorkspace(c, a))).toEqual(saved);
  });
  it('isolates tenants even with manipulated explicit IDs and missing context', async () => {
    expect(await tx(b, (c) => readApplicationWorkspace(c, a))).toEqual({ version: 0, tiles: [] });
    expect(await tx(null, (c) => readApplicationWorkspace(c, a))).toEqual({
      version: 0,
      tiles: [],
    });
    await expect(
      tx(b, (c) => saveApplicationWorkspace(c, a, { version: 0, tiles: [] }))
    ).rejects.toThrow();
  });
  it('allows exactly one concurrent writer for the same revision', async () => {
    const results = await Promise.allSettled([
      tx(a, (c) => saveApplicationWorkspace(c, a, { version: 1, tiles: [{ id: 'left' }] })),
      tx(a, (c) => saveApplicationWorkspace(c, a, { version: 1, tiles: [{ id: 'right' }] })),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect((await tx(a, (c) => readApplicationWorkspace(c, a))).version).toBe(2);
  });
  it('rolls back the configuration when the containing host transaction fails', async () => {
    await expect(
      tx(a, async (c) => {
        await saveApplicationWorkspace(c, a, { version: 2, tiles: [] });
        throw Error('audit_failed');
      })
    ).rejects.toThrow('audit_failed');
    expect((await tx(a, (c) => readApplicationWorkspace(c, a))).version).toBe(2);
  });
  it('rejects a missing revision rather than recreating the row', async () => {
    await expect(
      tx(b, (c) => saveApplicationWorkspace(c, b, { version: 8, tiles: [] }))
    ).rejects.toThrow('workspace_version_conflict');
  });
  it('preserves configuration across a nondestructive migration rollback and replay', async () => {
    const migration = await readFile(
      new URL('../../data/migrations/0115_application_workspace_settings.sql', import.meta.url),
      'utf8'
    );
    const [up, down] = migration.split('-- +goose Down');
    if (!up || !down) throw Error('migration_sections_required');
    const before = await tx(a, (c) => readApplicationWorkspace(c, a));
    await pool!.query(down);
    await pool!.query(up);
    expect(await tx(a, (c) => readApplicationWorkspace(c, a))).toEqual(before);
    expect(await tx(b, (c) => readApplicationWorkspace(c, a))).toEqual({ version: 0, tiles: [] });
  });
});
