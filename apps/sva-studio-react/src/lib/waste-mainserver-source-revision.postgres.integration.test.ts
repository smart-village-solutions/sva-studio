import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { applySchemaStatements } from './waste-management-operations.schema.js';

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('WASTE_DATE_SHIFT_TEST_DATABASE_URL is required for this integration test');
}

const schemaName = 'waste_mainserver_revision_test';
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
let client: PoolClient;

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

  it('increments once per relevant statement and ignores irrelevant update columns', async () => {
    await client.query(
      `INSERT INTO waste_cities (id, name) VALUES ($1, 'Ort A'), ($2, 'Ort B');`,
      [ids.city, ids.secondCity]
    );
    expect(await readRevision()).toBe(1n);

    await client.query(`UPDATE waste_cities SET updated_at = NOW() WHERE id = $1;`, [ids.city]);
    expect(await readRevision()).toBe(1n);

    await client.query(`UPDATE waste_cities SET postal_code = '12345' WHERE id = $1;`, [ids.city]);
    expect(await readRevision()).toBe(2n);

    await client.query(`DELETE FROM waste_cities WHERE id = $1;`, [ids.secondCity]);
    expect(await readRevision()).toBe(3n);
  });

  it('keeps revisions monotone across bulk writes and cascading deletes', async () => {
    await client.query(`INSERT INTO waste_regions (id, name) VALUES ($1, 'Region');`, [ids.region]);
    await client.query(
      `INSERT INTO waste_cities (id, name, region_id) VALUES ($1, 'Ort', $2);`,
      [ids.city, ids.region]
    );
    await client.query(
      `INSERT INTO waste_streets (id, name, city_id) VALUES ($1, 'Straße', $2);`,
      [ids.street, ids.city]
    );
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
    await client.query(`DELETE FROM waste_tours WHERE id = $1;`, [ids.tour]);
    const afterCascade = await readRevision();

    expect(afterCascade).toBeGreaterThan(beforeCascade);
    await expect(
      client.query('SELECT id FROM waste_location_tour_links WHERE id = $1;', [ids.link])
    ).resolves.toMatchObject({ rowCount: 0 });
  });
});
