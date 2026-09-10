import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { createProvisionTenantDatabaseOperation, deriveWasteTenantDatabaseNames } from './waste-tenant-database-provisioner.server.js';

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('WASTE_DATE_SHIFT_TEST_DATABASE_URL is required for this integration test');

const instanceId = `role-reconcile-${randomUUID().slice(0, 8)}`;
const names = deriveWasteTenantDatabaseNames(instanceId);
const provisionerRole = `test_provisioner_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: databaseUrl, max: 1 });

afterAll(async () => {
  await admin.query(`DROP DATABASE IF EXISTS "${names.database}" WITH (FORCE)`);
  for (const role of [names.appRole, names.publicAppRole, names.migratorRole, names.ownerRole, provisionerRole]) {
    await admin.query(`DROP ROLE IF EXISTS "${role}"`);
  }
  await admin.end();
});

describe('Waste provisioning with a restricted PostgreSQL principal', () => {
  it('creates and reconciles tenant roles without superuser, replication or RLS bypass privileges', async () => {
    const password = randomUUID();
    await admin.query(`CREATE ROLE "${provisionerRole}" LOGIN PASSWORD '${password}' CREATEDB CREATEROLE NOINHERIT`);
    const provisionerUrl = new URL(databaseUrl);
    provisionerUrl.username = provisionerRole;
    provisionerUrl.password = password;
    const completeProvisioning = vi.fn(async (input) => ({ ...input, status: 'ready' } as never));
    const failProvisioning = vi.fn(async () => null);
    const operation = createProvisionTenantDatabaseOperation({
      getProvisionerDatabaseUrl: () => provisionerUrl.toString(),
      protectSecret: () => 'test-ciphertext',
      claimProvisioning: vi.fn(async () => ({ status: 'provisioning' } as never)),
      completeProvisioning,
      failProvisioning,
      loadManagedInterface: vi.fn(async () => null),
      saveManagedInterface: vi.fn(async () => undefined),
    });
    for (const generation of [1, 2]) {
      await operation(instanceId, { operation: 'provision-tenant-database', desiredGeneration: generation }, { jobId: randomUUID() });
    }
    expect(completeProvisioning).toHaveBeenCalledTimes(2);
    expect(failProvisioning).not.toHaveBeenCalled();
    const roles = await admin.query<{ rolsuper: boolean; rolreplication: boolean; rolbypassrls: boolean }>(
      'SELECT rolsuper, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = ANY($1::text[])',
      [[names.ownerRole, names.migratorRole, names.appRole, names.publicAppRole]]
    );
    expect(roles.rows).toHaveLength(4);
    expect(roles.rows.every((role) => !role.rolsuper && !role.rolreplication && !role.rolbypassrls)).toBe(true);
  }, 30_000);
});
