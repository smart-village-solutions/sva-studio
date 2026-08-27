import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { wasteTenantMigrations } from '../../../../deploy/portainer/waste-tenant-migration-catalog.mjs';
import { applySchemaStatements } from './waste-management-operations.schema.js';

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('WASTE_DATE_SHIFT_TEST_DATABASE_URL is required for this integration test');
}

const schemaName = 'waste_mainserver_revision_test';
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
let client: PoolClient;
let catalogMigrationSatisfied = false;

const sourceRevisionMigration = wasteTenantMigrations.find(
  ({ id }) => id === '20260827_01_add_mainserver_source_revision'
);
if (!sourceRevisionMigration) {
  throw new Error('waste_mainserver_source_revision_migration_missing');
}

const ids = {
  region: '10000000-0000-4000-8000-000000000001',
  city: '20000000-0000-4000-8000-000000000001',
  secondCity: '20000000-0000-4000-8000-000000000002',
  street: '30000000-0000-4000-8000-000000000001',
  houseNumber: '40000000-0000-4000-8000-000000000001',
  location: '50000000-0000-4000-8000-000000000001',
  tour: '60000000-0000-4000-8000-000000000001',
  link: '70000000-0000-4000-8000-000000000001',
} as const;

const readRevision = async (): Promise<bigint> => {
  const result = await client.query<{ source_revision: string }>(
    'SELECT source_revision::text FROM waste_mainserver_source_state WHERE id = TRUE;'
  );
  const value = result.rows[0]?.source_revision;
  if (value === undefined) throw new Error('waste_mainserver_source_state_missing');
  return BigInt(value);
};

describe('Waste Mainserver source revision against PostgreSQL', () => {
  beforeAll(async () => {
    client = await pool.connect();
    await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`);
    for (const statement of applySchemaStatements(schemaName)) await client.query(statement);

    for (const statement of applySchemaStatements('public')) await client.query(statement);
    await client.query(`
      DO $$
      DECLARE trigger_record RECORD;
      BEGIN
        FOR trigger_record IN
          SELECT namespace_row.nspname, table_row.relname, trigger_row.tgname
          FROM pg_trigger AS trigger_row
          INNER JOIN pg_class AS table_row ON table_row.oid = trigger_row.tgrelid
          INNER JOIN pg_namespace AS namespace_row ON namespace_row.oid = table_row.relnamespace
          WHERE namespace_row.nspname = 'public'
            AND NOT trigger_row.tgisinternal
            AND trigger_row.tgname LIKE 'sva_mainserver_revision_%'
        LOOP
          EXECUTE format(
            'DROP TRIGGER %I ON %I.%I',
            trigger_record.tgname,
            trigger_record.nspname,
            trigger_record.relname
          );
        END LOOP;
      END $$;
      DROP FUNCTION IF EXISTS public.sva_bump_waste_mainserver_source_revision();
      DROP TABLE IF EXISTS public.waste_mainserver_source_state;
    `);
    for (const statement of sourceRevisionMigration.statements) await client.query(statement);
    const verification = await client.query<{ satisfied: boolean }>(
      sourceRevisionMigration.verification.sql,
      [...sourceRevisionMigration.verification.values]
    );
    catalogMigrationSatisfied = verification.rows[0]?.satisfied === true;

    await client.query(`SET search_path TO ${schemaName}, public;`);
  }, 60_000);

  beforeEach(async () => {
    await client.query(`
      TRUNCATE TABLE
        waste_location_tour_links,
        waste_collection_locations,
        waste_house_numbers,
        waste_streets,
        waste_cities,
        waste_regions,
        waste_tours
      CASCADE;
    `);
    await client.query(
      'UPDATE waste_mainserver_source_state SET source_revision = 0, changed_at = NULL WHERE id = TRUE;'
    );
  });

  afterAll(async () => {
    if (client) {
      await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`);
      client.release();
    }
    await pool.end();
  });

  it('applies and verifies the versioned source-revision migration against PostgreSQL', () => {
    expect(catalogMigrationSatisfied).toBe(true);
  });

  it('increments once for direct writes, ignores irrelevant updates, and advances on deletes', async () => {
    await client.query(`INSERT INTO waste_cities (id, name) VALUES ($1, 'Ort A'), ($2, 'Ort B');`, [
      ids.city,
      ids.secondCity,
    ]);
    expect(await readRevision()).toBe(1n);

    await client.query(`UPDATE waste_cities SET updated_at = NOW() WHERE id = $1;`, [ids.city]);
    expect(await readRevision()).toBe(1n);

    await client.query(`UPDATE waste_cities SET postal_code = '12345' WHERE id = $1;`, [ids.city]);
    expect(await readRevision()).toBe(2n);

    await client.query(`DELETE FROM waste_cities WHERE id = $1;`, [ids.secondCity]);
    expect(await readRevision()).toBeGreaterThan(2n);
  });

  it('keeps revisions monotone across bulk writes and cascading deletes', async () => {
    await client.query(`INSERT INTO waste_regions (id, name) VALUES ($1, 'Region');`, [ids.region]);
    await client.query(`INSERT INTO waste_cities (id, name, region_id) VALUES ($1, 'Ort', $2);`, [
      ids.city,
      ids.region,
    ]);
    await client.query(`INSERT INTO waste_streets (id, name, city_id) VALUES ($1, 'Straße', $2);`, [
      ids.street,
      ids.city,
    ]);
    await client.query(
      `INSERT INTO waste_house_numbers (id, number, street_id) VALUES ($1, '1', $2);`,
      [ids.houseNumber, ids.street]
    );
    await client.query(
      `INSERT INTO waste_collection_locations
        (id, city_id, region_id, street_id, house_number_id)
       VALUES ($1, $2, $3, $4, $5);`,
      [ids.location, ids.city, ids.region, ids.street, ids.houseNumber]
    );
    await client.query(`INSERT INTO waste_tours (id, name, active) VALUES ($1, 'Tour', TRUE);`, [
      ids.tour,
    ]);
    await client.query(
      `INSERT INTO waste_location_tour_links (id, location_id, tour_id)
       VALUES ($1, $2, $3);`,
      [ids.link, ids.location, ids.tour]
    );

    const beforeCascade = await readRevision();
    try {
      await client.query(`
        DO $$
        DECLARE trigger_record RECORD;
        BEGIN
          FOR trigger_record IN
            SELECT namespace_row.nspname, table_row.relname, trigger_row.tgname
            FROM pg_trigger AS trigger_row
            INNER JOIN pg_class AS table_row ON table_row.oid = trigger_row.tgrelid
            INNER JOIN pg_namespace AS namespace_row ON namespace_row.oid = table_row.relnamespace
            WHERE namespace_row.nspname = '${schemaName}'
              AND NOT trigger_row.tgisinternal
              AND trigger_row.tgname LIKE 'sva_mainserver_revision_%'
              AND trigger_row.tgname <> 'sva_mainserver_revision_location_tour_links_change'
          LOOP
            EXECUTE format(
              'ALTER TABLE %I.%I DISABLE TRIGGER %I',
              trigger_record.nspname,
              trigger_record.relname,
              trigger_record.tgname
            );
          END LOOP;
        END $$;
      `);

      await client.query(`DELETE FROM waste_tours WHERE id = $1;`, [ids.tour]);

      expect(await readRevision()).toBe(beforeCascade + 1n);
      await expect(
        client.query('SELECT id FROM waste_location_tour_links WHERE id = $1;', [ids.link])
      ).resolves.toMatchObject({ rowCount: 0 });
    } finally {
      await client.query(`
        DO $$
        DECLARE trigger_record RECORD;
        BEGIN
          FOR trigger_record IN
            SELECT namespace_row.nspname, table_row.relname, trigger_row.tgname
            FROM pg_trigger AS trigger_row
            INNER JOIN pg_class AS table_row ON table_row.oid = trigger_row.tgrelid
            INNER JOIN pg_namespace AS namespace_row ON namespace_row.oid = table_row.relnamespace
            WHERE namespace_row.nspname = '${schemaName}'
              AND NOT trigger_row.tgisinternal
              AND trigger_row.tgname LIKE 'sva_mainserver_revision_%'
          LOOP
            EXECUTE format(
              'ALTER TABLE %I.%I ENABLE TRIGGER %I',
              trigger_record.nspname,
              trigger_record.relname,
              trigger_record.tgname
            );
          END LOOP;
        END $$;
      `);
    }
  });
});
