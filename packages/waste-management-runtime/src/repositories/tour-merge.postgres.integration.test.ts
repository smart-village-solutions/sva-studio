import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildMaterializedLocationTourPickupDates } from '../operations/waste-management-mainserver-sync.materialization.js';
import { applySchemaStatements } from '../operations/waste-management-operations.schema.js';
import { createSqlExecutor } from '../operations/waste-management-operations.shared.js';
import { createWasteMasterDataRepository } from './master-data.js';
import { processWasteTourMerge } from './tour-merge.js';

const url = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
if (!url)
  throw new Error('WASTE_DATE_SHIFT_TEST_DATABASE_URL is required for this integration test');

const pool = new Pool({ connectionString: url, max: 3 });
const schema = `tour_merge_${randomUUID().replaceAll('-', '')}`;
const tourIds = Array.from({ length: 3 }, randomUUID);
const target = tourIds[0]!;
const source = tourIds[1]!;
const fraction = randomUUID();
const locationIds = Array.from({ length: 26 }, randomUUID);
const groups = [
  locationIds.slice(0, 13),
  [locationIds[0], ...locationIds.slice(13, 21)],
  [locationIds[0], ...locationIds.slice(21)],
];
const input = { tourIds, targetTourId: target };
let client: PoolClient;

const previewMerge = async () => {
  const result = await processWasteTourMerge(client, input);
  if (result?.kind !== 'preview') throw new Error('Expected a merge preview');
  return result.preview;
};

const repository = () => createWasteMasterDataRepository(createSqlExecutor(client));

const readEffectivePickups = async () => {
  const repo = repository();
  return buildMaterializedLocationTourPickupDates({
    tours: await repo.listWasteTours(),
    links: await repo.listWasteLocationTourLinks(),
    tourDateShifts: await repo.listWasteTourDateShifts(),
    globalDateShifts: [],
    holidayRules: [],
    currentYear: 2027,
    nextYear: 2028,
  })
    .map(({ locationId, pickupDate, note }) => JSON.stringify([locationId, pickupDate, note]))
    .sort();
};

const expectOriginalAssignments = async () => {
  expect(
    (await repository().listWasteTours()).map((tour) => [tour.status, tour.locationCount]).sort()
  ).toEqual([
    ['published', 13],
    ['published', 6],
    ['published', 9],
  ]);
};

describe('Tour merge against PostgreSQL', () => {
  beforeAll(async () => {
    client = await pool.connect();
    for (const sql of applySchemaStatements(schema)) await client.query(sql);
    await client.query(`SET search_path TO ${schema}, public`);
  }, 60_000);

  beforeEach(async () => {
    await client.query(
      'TRUNCATE waste_fractions, waste_cities, waste_tours, waste_global_date_shifts CASCADE'
    );
    await client.query(
      "INSERT INTO waste_fractions(id, name, pdf_short_label) VALUES ($1, 'Gelbe Tonne', 'GT')",
      [fraction]
    );

    const cityIds = Array.from({ length: 26 }, randomUUID);
    await client.query(
      `
      INSERT INTO waste_cities(id, name)
      SELECT id, CASE WHEN ord = 1 THEN 'Grenzbahnhof / Oderbrücke' ELSE 'Abholort ' || ord END
      FROM unnest($1::uuid[]) WITH ORDINALITY AS c(id, ord)`,
      [cityIds]
    );
    await client.query(
      `
      INSERT INTO waste_collection_locations(id, city_id)
      SELECT * FROM unnest($1::uuid[], $2::uuid[])`,
      [locationIds, cityIds]
    );
    await client.query(
      `
      INSERT INTO waste_tours(id, name, description, waste_fraction_ids, status, active, recurrence, first_date, end_date)
      SELECT id, 'Frankfurt 2027 · Gelbe Tonne · Bezirk 12', 'Hinweis', $2, 'published', true, 'fourweekly', '2027-01-20', '2027-12-31'
      FROM unnest($1::uuid[]) AS id`,
      [tourIds, [fraction]]
    );
    for (const [index, locations] of groups.entries()) {
      await client.query(
        `
        INSERT INTO waste_location_tour_links(location_id, tour_id)
        SELECT id, $2::uuid FROM unnest($1::uuid[]) AS id`,
        [locations, tourIds[index]]
      );
    }
    await client.query(
      `
      INSERT INTO waste_tour_date_shifts(tour_id, original_date, actual_date, has_year, description)
      SELECT id, '2027-01-20', '2027-01-21', true, 'Ausweichtermin'
      FROM unnest($1::uuid[]) AS id`,
      [tourIds]
    );
  });

  afterAll(async () => {
    if (client) {
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      client.release();
    }
    await pool.end();
  });

  it('adds 13 new locations to the target and archives both sources with their data intact', async () => {
    const preview = await previewMerge();
    expect(preview).toMatchObject({
      addedCount: 13,
      totalCount: 26,
      sharedCount: 1,
      sharedLocationLabel: 'Grenzbahnhof / Oderbrücke',
      conflicts: [],
    });

    const readPlanning = async () =>
      (
        await client.query(`
      SELECT id, waste_fraction_ids, recurrence, description, first_date, end_date
      FROM waste_tours ORDER BY id`)
      ).rows;
    const readShifts = async () =>
      (await client.query('SELECT * FROM waste_tour_date_shifts ORDER BY id')).rows;
    const readSourceLinks = async () =>
      (
        await client.query(
          'SELECT * FROM waste_location_tour_links WHERE tour_id <> $1 ORDER BY id',
          [target]
        )
      ).rows;
    const planning = await readPlanning();
    const shifts = await readShifts();
    const sourceLinks = await readSourceLinks();
    const previousPickups = await readEffectivePickups();
    expect(previousPickups.length).toBeGreaterThan(26);
    expect(previousPickups.length).toBeGreaterThan(new Set(previousPickups).size);
    const sourceRevision = await repository().getWasteMainserverSourceRevision();
    const result = await processWasteTourMerge(client, {
      ...input,
      confirmationToken: preview.token,
    });
    expect(result).toEqual({ kind: 'merged', archivedCount: 2, totalCount: 26 });
    const tours = await repository().listWasteTours();
    expect(tours.find((tour) => tour.id === target)).toMatchObject({
      locationCount: 26,
      status: 'published',
    });
    expect(tours.filter((tour) => tour.id !== target).map((tour) => tour.status)).toEqual([
      'archived',
      'archived',
    ]);
    expect(
      (
        await client.query(
          'SELECT location_id FROM waste_location_tour_links WHERE tour_id = $1 ORDER BY location_id',
          [target]
        )
      ).rows.map((row) => row.location_id)
    ).toEqual([...locationIds].sort());
    expect(await readEffectivePickups()).toEqual([...new Set(previousPickups)]);
    expect(await repository().getWasteMainserverSourceRevision()).not.toEqual(sourceRevision);
    expect(await readPlanning()).toEqual(planning);
    expect(await readShifts()).toEqual(shifts);
    expect(await readSourceLinks()).toEqual(sourceLinks);
    await expect(
      processWasteTourMerge(client, { ...input, confirmationToken: preview.token })
    ).resolves.toEqual({ kind: 'stale' });
  });

  it('names conflicting planning and refuses to execute even with that preview token', async () => {
    await client.query("UPDATE waste_tours SET recurrence = 'biweekly' WHERE id = $1", [source]);
    await client.query(
      `
      INSERT INTO waste_global_date_shifts(original_date, actual_date, has_year, tour_ids)
      VALUES ('2027-03-17', '2027-03-18', true, ARRAY[$1::text])`,
      [source]
    );
    const preview = await previewMerge();
    expect(preview.conflicts).toEqual(
      expect.arrayContaining([
        { tourId: source, reason: 'recurrence' },
        { tourId: source, reason: 'shifts' },
      ])
    );
    await expect(
      processWasteTourMerge(client, { ...input, confirmationToken: preview.token })
    ).resolves.toEqual({ kind: 'stale' });
    await expectOriginalAssignments();
  });

  it('rejects a missing tour and a stale preview without exposing data or changing the batch', async () => {
    await expect(
      processWasteTourMerge(client, { ...input, tourIds: [target, randomUUID()] })
    ).resolves.toBeNull();
    const preview = await previewMerge();
    await client.query("UPDATE waste_tours SET description = 'Neu' WHERE id = $1", [source]);
    await expect(
      processWasteTourMerge(client, { ...input, confirmationToken: preview.token })
    ).resolves.toEqual({ kind: 'stale' });
    await expectOriginalAssignments();
  });

  it('rolls back after a successful point insert if archiving subsequently fails', async () => {
    const preview = await previewMerge();
    await client.query(
      "ALTER TABLE waste_tours ADD CONSTRAINT test_no_archive CHECK (status <> 'archived')"
    );
    try {
      await expect(
        processWasteTourMerge(client, { ...input, confirmationToken: preview.token })
      ).resolves.toEqual({ kind: 'rolled-back' });
      await expectOriginalAssignments();
    } finally {
      await client.query('ALTER TABLE waste_tours DROP CONSTRAINT test_no_archive');
    }
  });

  it('releases its locks and returns rollback when a writer is still changing the batch', async () => {
    const preview = await previewMerge();
    const writer = await pool.connect();
    try {
      await writer.query(`SET search_path TO ${schema}, public`);
      await writer.query('BEGIN');
      await writer.query("UPDATE waste_tours SET description = 'Andere Sitzung' WHERE id = $1", [
        source,
      ]);
      await expect(
        processWasteTourMerge(client, { ...input, confirmationToken: preview.token })
      ).resolves.toEqual({ kind: 'rolled-back' });
    } finally {
      await writer.query('ROLLBACK');
      writer.release();
    }
    await expectOriginalAssignments();
  });
});
