import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPublicWasteRepository } from './public-waste-repository.server.js';

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
const schemaName = 'public_waste_tour_status_test';
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 4 }) : null;
let client: PoolClient;

// Only the relations read by the public repository are needed for this SQL integration test.
const createFixtureStatements = [
  `CREATE SCHEMA ${schemaName};`,
  `CREATE TABLE ${schemaName}.waste_regions (id UUID PRIMARY KEY, name TEXT NOT NULL);`,
  `CREATE TABLE ${schemaName}.waste_cities (id UUID PRIMARY KEY, name TEXT NOT NULL);`,
  `CREATE TABLE ${schemaName}.waste_streets (id UUID PRIMARY KEY, name TEXT NOT NULL);`,
  `CREATE TABLE ${schemaName}.waste_house_numbers (id UUID PRIMARY KEY, number TEXT NOT NULL);`,
  `CREATE TABLE ${schemaName}.waste_collection_locations (id UUID PRIMARY KEY, region_id UUID, city_id UUID, street_id UUID, house_number_id UUID, active BOOLEAN NOT NULL DEFAULT TRUE);`,
  `CREATE TABLE ${schemaName}.waste_fractions (id UUID PRIMARY KEY, name TEXT NOT NULL, description TEXT, pdf_short_label TEXT, color TEXT);`,
  `CREATE TABLE ${schemaName}.waste_custom_recurrence_presets (id UUID PRIMARY KEY, interval_days INTEGER NOT NULL);`,
  `CREATE TABLE ${schemaName}.waste_tours (id UUID PRIMARY KEY, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL CHECK (status IN ('published', 'draft', 'archived')), waste_fraction_ids TEXT[] NOT NULL, recurrence TEXT, custom_recurrence_id UUID, first_date DATE, end_date DATE, custom_dates JSONB);`,
  `CREATE TABLE ${schemaName}.waste_location_tour_links (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), location_id UUID NOT NULL, tour_id UUID NOT NULL);`,
  `CREATE TABLE ${schemaName}.waste_tour_date_shifts (id UUID PRIMARY KEY, tour_id UUID, original_date DATE, actual_date DATE, has_year BOOLEAN, description TEXT);`,
  `CREATE TABLE ${schemaName}.waste_global_date_shifts (id UUID PRIMARY KEY, original_date DATE, actual_date DATE, description TEXT, tour_ids TEXT[]);`,
  `CREATE TABLE ${schemaName}.waste_tour_assignments (id UUID PRIMARY KEY, tour_id UUID, pickup_date DATE, note TEXT);`,
  `CREATE TABLE ${schemaName}.waste_tour_assignment_locations (assignment_id UUID, collection_location_id UUID);`,
  `CREATE TABLE ${schemaName}.waste_holiday_rules (id UUID PRIMARY KEY, holiday_date DATE, holiday_name TEXT, year INTEGER, state_code TEXT, source_status TEXT, configuration_status TEXT, conflict_status TEXT, scope TEXT, strategy TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ);`,
] as const;

const ids = {
  fraction: '10000000-0000-4000-8000-000000000001',
  region: '20000000-0000-4000-8000-000000000001',
  city: '30000000-0000-4000-8000-000000000001',
  street: '40000000-0000-4000-8000-000000000001',
  location: '50000000-0000-4000-8000-000000000001',
  publishedTour: '60000000-0000-4000-8000-000000000001',
  draftTour: '60000000-0000-4000-8000-000000000002',
  archivedTour: '60000000-0000-4000-8000-000000000003',
} as const;

describe.skipIf(!databaseUrl)('Public Waste tour status against PostgreSQL', () => {
  beforeAll(async () => {
    if (!pool) throw new Error('WASTE_DATE_SHIFT_TEST_DATABASE_URL is required');
    client = await pool.connect();
    await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`);
    for (const statement of createFixtureStatements) await client.query(statement);

    await client.query(`INSERT INTO ${schemaName}.waste_regions (id, name) VALUES ($1, 'Prignitz');`, [
      ids.region,
    ]);
    await client.query(
      `INSERT INTO ${schemaName}.waste_cities (id, name) VALUES ($1, 'Wittenberge');`,
      [ids.city]
    );
    await client.query(
      `INSERT INTO ${schemaName}.waste_streets (id, name) VALUES ($1, 'Hauptstraße');`,
      [ids.street]
    );
    await client.query(
      `INSERT INTO ${schemaName}.waste_collection_locations (id, city_id, region_id, street_id)
       VALUES ($1, $2, $3, $4);`,
      [ids.location, ids.city, ids.region, ids.street]
    );
    await client.query(
      `INSERT INTO ${schemaName}.waste_fractions (id, name) VALUES ($1, 'Restmüll');`,
      [ids.fraction]
    );
    await client.query(
      `INSERT INTO ${schemaName}.waste_tours
         (id, name, status, waste_fraction_ids, recurrence, first_date, end_date)
       VALUES
         ($1, 'Veröffentlicht', 'published', ARRAY[$4::text], 'weekly', '2026-05-20', '2026-05-20'),
         ($2, 'Entwurf', 'draft', ARRAY[$4::text], 'weekly', '2026-05-20', '2026-05-20'),
         ($3, 'Archiviert', 'archived', ARRAY[$4::text], 'weekly', '2026-05-20', '2026-05-20');`,
      [ids.publishedTour, ids.draftTour, ids.archivedTour, ids.fraction]
    );
    await client.query(
      `INSERT INTO ${schemaName}.waste_location_tour_links (location_id, tour_id)
       VALUES ($1, $2), ($1, $3), ($1, $4);`,
      [ids.location, ids.publishedTour, ids.draftTour, ids.archivedTour]
    );
  }, 60_000);

  afterAll(async () => {
    if (client) {
      await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`);
      client.release();
    }
    await pool?.end();
  });

  it('exposes published tours and excludes draft and archived tours from the public calendar', async () => {
    if (!pool) throw new Error('WASTE_DATE_SHIFT_TEST_DATABASE_URL is required');
    const repository = createPublicWasteRepository({
      schemaName,
      execute: async <TRow>({ text, values }: { text: string; values?: readonly unknown[] }) => {
        const result = await pool.query(text, values ? [...values] : []);
        return {
          rowCount: result.rowCount ?? result.rows.length,
          rows: result.rows as readonly TRow[],
        };
      },
    });

    await expect(repository.listPublicRegions()).resolves.toEqual([
      { id: ids.region, label: 'Prignitz' },
    ]);
    await expect(repository.listPublicLocations()).resolves.toHaveLength(1);
    await expect(repository.listSelectionOptions({ selection: {} })).resolves.toEqual({
      step: 'city',
      options: [{ id: ids.city, label: 'Wittenberge' }],
    });

    const entries = await repository.loadCalendarEntries({
      selection: { regionId: ids.region, cityId: ids.city, streetId: ids.street },
      referenceDate: '2026-05-19',
    });
    expect(entries.map(({ tourName }) => tourName)).toEqual(['Veröffentlicht']);
    expect(entries[0]).toMatchObject({ date: '2026-05-20', fractionLabel: 'Restmüll' });

    await client.query(
      `UPDATE ${schemaName}.waste_tours SET status = 'archived' WHERE id = $1;`,
      [ids.publishedTour]
    );
    await expect(repository.listPublicRegions()).resolves.toEqual([]);
    await expect(repository.listPublicLocations()).resolves.toEqual([]);
    await expect(
      repository.loadCalendarEntries({
        selection: { regionId: ids.region, cityId: ids.city, streetId: ids.street },
        referenceDate: '2026-05-19',
      })
    ).resolves.toEqual([]);
  });
});
