import { createWasteMasterDataRepository } from '@sva/data-repositories';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applySchemaStatements } from './waste-management-operations.schema.js';
import { createSqlExecutor } from './waste-management-operations.shared.js';

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('WASTE_DATE_SHIFT_TEST_DATABASE_URL is required for this integration test');
}

const schemaName = 'waste_location_sorting_test';
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
let client: PoolClient;
let repository: ReturnType<typeof createWasteMasterDataRepository>;

const ids = {
  northRegion: '10000000-0000-4000-8000-000000000001',
  southRegion: '10000000-0000-4000-8000-000000000002',
  city2: '20000000-0000-4000-8000-000000000001',
  city10: '20000000-0000-4000-8000-000000000002',
  umlautCity: '20000000-0000-4000-8000-000000000003',
  lowercaseCity: '20000000-0000-4000-8000-000000000004',
  street2: '30000000-0000-4000-8000-000000000001',
  street10: '30000000-0000-4000-8000-000000000002',
  house2: '40000000-0000-4000-8000-000000000001',
  house10: '40000000-0000-4000-8000-000000000002',
  house1: '40000000-0000-4000-8000-000000000003',
  tour: '50000000-0000-4000-8000-000000000001',
} as const;

const locationId = (suffix: number): string =>
  `60000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

const baseQuery = {
  q: undefined,
  status: 'all' as const,
  regionId: undefined,
  cityId: undefined,
  tourId: undefined,
  sortMode: 'address' as const,
  sortDirection: 'asc' as const,
  page: 1,
  pageSize: 10 as const,
};

describe('Waste collection-location projection against PostgreSQL', () => {
  beforeAll(async () => {
    client = await pool.connect();
    await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`);
    for (const statement of applySchemaStatements(schemaName)) await client.query(statement);
    await client.query(`SET search_path TO ${schemaName}, public;`);
    repository = createWasteMasterDataRepository(createSqlExecutor(client));

    await client.query(`INSERT INTO waste_regions (id, name) VALUES ($1, 'Nord'), ($2, 'Süd');`, [
      ids.northRegion,
      ids.southRegion,
    ]);
    await client.query(
      `INSERT INTO waste_cities (id, name, region_id)
       VALUES ($1, 'Ort 2', $2), ($3, 'Ort 10', $4);`,
      [ids.city2, ids.southRegion, ids.city10, ids.northRegion]
    );
    await client.query(
      `INSERT INTO waste_streets (id, name, city_id)
       VALUES ($1, 'Ährenweg', $2), ($3, 'Ackerweg', $4);`,
      [ids.street2, ids.city2, ids.street10, ids.city10]
    );
    await client.query(
      `INSERT INTO waste_house_numbers (id, number, street_id)
       VALUES ($1, '2', $2), ($3, '10', $2), ($4, '1', $5);`,
      [ids.house2, ids.street2, ids.house10, ids.house1, ids.street10]
    );
    await client.query(
      `INSERT INTO waste_tours (id, name, active) VALUES ($1, 'Tour Nord', TRUE);`,
      [ids.tour]
    );

    const locations = [
      [locationId(1), ids.city2, ids.southRegion, ids.street2, ids.house2, true],
      [locationId(2), ids.city2, ids.southRegion, ids.street2, ids.house10, true],
      [locationId(3), ids.city2, ids.southRegion, null, null, true],
      [locationId(4), ids.city10, ids.northRegion, ids.street10, ids.house1, false],
      ...Array.from({ length: 8 }, (_, index) => [
        locationId(index + 5),
        ids.city2,
        ids.southRegion,
        ids.street2,
        ids.house2,
        true,
      ]),
    ] as const;
    for (const location of locations) {
      await client.query(
        `INSERT INTO waste_collection_locations
          (id, city_id, region_id, street_id, house_number_id, active)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [...location]
      );
    }
    await client.query(
      `INSERT INTO waste_location_tour_links (location_id, tour_id)
       VALUES ($1, $3), ($2, $3);`,
      [locationId(2), locationId(4), ids.tour]
    );
  }, 60_000);

  afterAll(async () => {
    if (client) {
      await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`);
      client.release();
    }
    await pool.end();
  });

  it('sorts naturally before pagination and keeps nulls last in both directions', async () => {
    const firstPage = await repository.listWasteCollectionLocationPage(baseQuery);
    expect(firstPage).toMatchObject({ page: 1, pageSize: 10, total: 12, pageCount: 2 });
    expect(firstPage.items.map((item) => item.id)).toEqual([
      locationId(1),
      locationId(5),
      locationId(6),
      locationId(7),
      locationId(8),
      locationId(9),
      locationId(10),
      locationId(11),
      locationId(12),
      locationId(2),
    ]);

    const secondPage = await repository.listWasteCollectionLocationPage({
      ...baseQuery,
      page: 2,
    });
    expect(secondPage.items.map((item) => item.id)).toEqual([locationId(3), locationId(4)]);

    const descending = await repository.listWasteCollectionLocationPage({
      ...baseQuery,
      sortDirection: 'desc',
    });
    expect(descending.items[0]?.id).toBe(locationId(4));
    expect(descending.items.at(-1)?.id).not.toBe(locationId(3));
    const descendingSecondPage = await repository.listWasteCollectionLocationPage({
      ...baseQuery,
      sortDirection: 'desc',
      page: 2,
    });
    expect(descendingSecondPage.items.at(-1)?.id).toBe(locationId(3));
  });

  it('puts region first and applies tour, status, search, count, and id filters consistently', async () => {
    const byRegion = await repository.listWasteCollectionLocationPage({
      ...baseQuery,
      sortMode: 'addressWithRegion',
    });
    expect(byRegion.items[0]?.id).toBe(locationId(4));
    const byRegionDescending = await repository.listWasteCollectionLocationPage({
      ...baseQuery,
      sortMode: 'addressWithRegion',
      sortDirection: 'desc',
    });
    expect(byRegionDescending.items[0]?.id).toBe(locationId(2));

    const byTour = await repository.listWasteCollectionLocationPage({
      ...baseQuery,
      q: 'Nord',
      tourId: ids.tour,
    });
    expect(byTour.items.map((item) => item.id)).toEqual([locationId(2), locationId(4)]);
    expect(byTour.items.map((item) => item.tours)).toEqual([
      [{ id: ids.tour, name: 'Tour Nord' }],
      [{ id: ids.tour, name: 'Tour Nord' }],
    ]);
    expect(byTour.total).toBe(2);

    await expect(
      repository.listWasteCollectionLocationIds({
        q: undefined,
        status: 'inactive',
        regionId: ids.northRegion,
        cityId: undefined,
        tourId: ids.tour,
      })
    ).resolves.toEqual([locationId(4)]);

    const emptyPage = await repository.listWasteCollectionLocationPage({
      ...baseQuery,
      page: 99,
    });
    expect(emptyPage).toMatchObject({ items: [], total: 12, pageCount: 2 });
  });

  it('uses the same German case-insensitive umlaut order in both directions', async () => {
    await client.query('BEGIN;');
    try {
      await client.query(
        `INSERT INTO waste_cities (id, name, region_id)
         VALUES ($1, 'Sort Ähre', $2), ($3, 'sort acker', $2);`,
        [ids.umlautCity, ids.northRegion, ids.lowercaseCity]
      );
      await client.query(
        `INSERT INTO waste_collection_locations (id, city_id, region_id, active)
         VALUES ($1, $2, $3, TRUE), ($4, $5, $3, TRUE);`,
        [locationId(20), ids.umlautCity, ids.northRegion, locationId(21), ids.lowercaseCity]
      );

      const ascending = await repository.listWasteCollectionLocationPage({
        ...baseQuery,
        q: 'sort',
      });
      expect(ascending.items.map((item) => item.cityName)).toEqual(['sort acker', 'Sort Ähre']);

      const descending = await repository.listWasteCollectionLocationPage({
        ...baseQuery,
        q: 'sort',
        sortDirection: 'desc',
      });
      expect(descending.items.map((item) => item.cityName)).toEqual(['Sort Ähre', 'sort acker']);
    } finally {
      await client.query('ROLLBACK;');
    }
  });
});
