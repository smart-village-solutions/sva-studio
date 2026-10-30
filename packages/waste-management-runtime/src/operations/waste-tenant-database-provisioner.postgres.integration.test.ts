import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { ExternalInterfaceRecord } from '@sva/core';

import {
  createProvisionTenantDatabaseOperation,
  deriveWasteTenantDatabaseNames,
} from './waste-tenant-database-provisioner.server.js';
import { wasteTourStatements } from '../repositories/master-data.tours.js';
import { migrateWasteTenantDatabase } from '../../../../deploy/portainer/migrate-waste-tenants.mjs';
import {
  wasteTenantMigrations,
  wasteTenantContractMigrations,
} from '../../../../deploy/portainer/waste-tenant-migration-catalog.mjs';
import { buildWasteTourFractionsExpandStatements } from './waste-tour-fractions.schema.js';

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error('WASTE_DATE_SHIFT_TEST_DATABASE_URL is required for this integration test');

const instanceId = `role-reconcile-${randomUUID().slice(0, 8)}`;
const names = deriveWasteTenantDatabaseNames(instanceId);
const provisionerRole = `test_provisioner_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: databaseUrl, max: 1 });

afterAll(async () => {
  await admin.query(`DROP DATABASE IF EXISTS "${names.database}" WITH (FORCE)`);
  for (const role of [
    names.appRole,
    names.publicAppRole,
    names.migratorRole,
    names.ownerRole,
    provisionerRole,
  ]) {
    await admin.query(`DROP ROLE IF EXISTS "${role}"`);
  }
  await admin.end();
});

describe('Waste provisioning with a restricted PostgreSQL principal', () => {
  it('creates and reconciles tenant roles without superuser, replication or RLS bypass privileges', async () => {
    const password = randomUUID();
    await admin.query(
      `CREATE ROLE "${provisionerRole}" LOGIN PASSWORD '${password}' CREATEDB CREATEROLE NOINHERIT`
    );
    const provisionerUrl = new URL(databaseUrl);
    provisionerUrl.username = provisionerRole;
    provisionerUrl.password = password;
    const completeProvisioning = vi.fn(async (input) => ({ ...input, status: 'ready' }) as never);
    const failProvisioning = vi.fn(async () => null);
    const state: { managedInterface: ExternalInterfaceRecord | null } = {
      managedInterface: null,
    };
    const operation = createProvisionTenantDatabaseOperation({
      getProvisionerDatabaseUrl: () => provisionerUrl.toString(),
      protectSecret: (plaintext) => plaintext,
      revealSecret: (ciphertext) => ciphertext ?? undefined,
      claimProvisioning: vi.fn(async () => ({ status: 'provisioning' }) as never),
      completeProvisioning,
      failProvisioning,
      loadManagedInterface: vi.fn(async () => state.managedInterface),
      saveManagedInterface: vi.fn(async (record) => {
        state.managedInterface = record;
      }),
    });
    await operation(
      instanceId,
      { operation: 'provision-tenant-database', desiredGeneration: 1 },
      { jobId: randomUUID() }
    );
    const firstSecret = JSON.parse(state.managedInterface?.secretConfigCiphertext ?? '{}') as {
      publicDatabaseUrl?: string;
      databaseUrl?: string;
    };
    expect(firstSecret.publicDatabaseUrl).toBeTruthy();

    await operation(
      instanceId,
      { operation: 'provision-tenant-database', desiredGeneration: 2 },
      { jobId: randomUUID() }
    );
    const reconciledSecret = JSON.parse(state.managedInterface?.secretConfigCiphertext ?? '{}') as {
      publicDatabaseUrl?: string;
    };
    expect(reconciledSecret.publicDatabaseUrl).toBe(firstSecret.publicDatabaseUrl);
    const publicConsumer = new Pool({ connectionString: firstSecret.publicDatabaseUrl, max: 1 });
    const appConsumer = new Pool({ connectionString: firstSecret.databaseUrl, max: 1 });
    const tenantAdminUrl = new URL(databaseUrl);
    tenantAdminUrl.pathname = `/${names.database}`;
    const tenantAdmin = new Pool({ connectionString: tenantAdminUrl.toString(), max: 1 });
    try {
      await expect(
        publicConsumer.query('SELECT COUNT(*)::int AS count FROM public.waste_regions')
      ).resolves.toMatchObject({ rowCount: 1 });
      const migrationClient = await tenantAdmin.connect();
      try {
        const expandMigration = wasteTenantMigrations.find(
          ({ id }) => id === '20261030_01_expand_waste_tour_fractions'
        );
        expect(expandMigration?.statements.slice(0, 4)).toEqual(
          buildWasteTourFractionsExpandStatements('public')
        );
        await migrateWasteTenantDatabase({
          client: migrationClient,
          migrations: wasteTenantMigrations,
          ...names,
        });
        await expect(
          migrateWasteTenantDatabase({
            client: migrationClient,
            migrations: wasteTenantMigrations,
            ...names,
          })
        ).resolves.toMatchObject({ appliedMigrationCount: 0 });
        const fractionId = randomUUID();
        const tourId = randomUUID();
        await appConsumer.query(
          "INSERT INTO waste_fractions(id, name, pdf_short_label) VALUES ($1, 'Bio', 'BIO')",
          [fractionId]
        );
        const statement = wasteTourStatements.upsertWasteTour({
          id: tourId,
          name: 'Tour',
          status: 'published',
          wasteFractionIds: [fractionId],
        });
        await appConsumer.query(statement.text, [...statement.values]);
        await expect(
          appConsumer.query('DELETE FROM waste_fractions WHERE id = $1', [fractionId])
        ).rejects.toMatchObject({ code: '23503' });
        await expect(appConsumer.query('DELETE FROM waste_tour_fractions')).rejects.toMatchObject({
          code: '42501',
        });
        await expect(
          publicConsumer.query('SELECT replace_waste_tour_fractions($1, $2)', [tourId, []])
        ).rejects.toMatchObject({ code: '42501' });
        await migrateWasteTenantDatabase({
          client: migrationClient,
          migrations: [...wasteTenantMigrations, ...wasteTenantContractMigrations],
          ...names,
        });
        await appConsumer.query(statement.text, [...statement.values]);
        await expect(
          publicConsumer.query('SELECT fraction_id FROM waste_tour_fractions WHERE tour_id = $1', [
            tourId,
          ])
        ).resolves.toMatchObject({ rows: [{ fraction_id: fractionId }] });
        await expect(
          migrateWasteTenantDatabase({
            client: migrationClient,
            migrations: [...wasteTenantMigrations, ...wasteTenantContractMigrations],
            ...names,
          })
        ).resolves.toMatchObject({ appliedMigrationCount: 0 });
        await operation(
          instanceId,
          { operation: 'provision-tenant-database', desiredGeneration: 3 },
          { jobId: randomUUID() }
        );
        await appConsumer.query(statement.text, [...statement.values]);
        expect(
          (
            await publicConsumer.query(`SELECT EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
            AND table_name = 'waste_tours' AND column_name = 'waste_fraction_ids'
        ) AS legacy_column`)
          ).rows[0].legacy_column
        ).toBe(false);
      } finally {
        migrationClient.release();
      }
    } finally {
      await publicConsumer.end();
      await appConsumer.end();
      await tenantAdmin.end();
    }
    expect(completeProvisioning).toHaveBeenCalledTimes(3);
    expect(failProvisioning).not.toHaveBeenCalled();
    const roles = await admin.query<{
      rolsuper: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
    }>(
      'SELECT rolsuper, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = ANY($1::text[])',
      [[names.ownerRole, names.migratorRole, names.appRole, names.publicAppRole]]
    );
    expect(roles.rows).toHaveLength(4);
    expect(
      roles.rows.every((role) => !role.rolsuper && !role.rolreplication && !role.rolbypassrls)
    ).toBe(true);
  }, 30_000);
});
