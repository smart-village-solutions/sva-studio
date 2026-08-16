import { createWasteMasterDataRepository } from '@sva/data-repositories';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applySchemaStatements } from './waste-management-operations.schema.js';
import { createSqlExecutor } from './waste-management-operations.shared.js';

const tourId = '10000000-0000-4000-8000-000000000001';
const firstShiftId = '20000000-0000-4000-8000-000000000001';
const secondShiftId = '20000000-0000-4000-8000-000000000002';
const annualShiftId = '20000000-0000-4000-8000-000000000003';

type PgFailure = Error & {
  readonly code?: string;
  readonly constraint?: string;
};

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('WASTE_DATE_SHIFT_TEST_DATABASE_URL is required for this integration test');
}

const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const repository = createWasteMasterDataRepository(createSqlExecutor(pool));

const buildShift = (id: string, hasYear: boolean) => ({
  id,
  tourId,
  originalDate: '2026-12-24',
  actualDate: '2026-12-23',
  hasYear,
  description: id,
});

const withClient = async <T>(work: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    return await work(client);
  } finally {
    client.release();
  }
};

describe('Waste tour date shifts against PostgreSQL', () => {
  beforeAll(async () => {
    for (const statement of applySchemaStatements('public')) {
      await pool.query(statement);
    }
    await pool.query(
      `INSERT INTO waste_tours (id, name, recurrence, first_date, end_date)
       VALUES ($1::uuid, 'Integration tour', 'weekly', '2026-01-01'::date, '2026-12-31'::date);`,
      [tourId]
    );
  }, 60_000);

  afterAll(async () => {
    await pool.end();
  });

  it('creates DATE columns and the two exact partial unique indexes', async () => {
    const columns = await pool.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'waste_tour_date_shifts'
         AND column_name IN ('original_date', 'actual_date')
       ORDER BY column_name;`
    );
    expect(columns.rows).toEqual([
      { column_name: 'actual_date', data_type: 'date' },
      { column_name: 'original_date', data_type: 'date' },
    ]);

    const indexes = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'uq_waste_tour_date_shifts_annual_origin',
           'uq_waste_tour_date_shifts_specific_origin'
         )
       ORDER BY indexname;`
    );
    expect(indexes.rows).toHaveLength(2);
    expect(indexes.rows[0]?.indexdef).toContain(
      'EXTRACT(month FROM original_date), EXTRACT(day FROM original_date)'
    );
    expect(indexes.rows[0]?.indexdef).toContain('WHERE (NOT has_year)');
    expect(indexes.rows[1]?.indexdef).toContain('(tour_id, original_date) WHERE has_year');
  });

  it('allows exactly one concurrent insert for equal specificity', async () => {
    const outcomes = await Promise.allSettled([
      repository.upsertWasteTourDateShift(buildShift(firstShiftId, true)),
      repository.upsertWasteTourDateShift(buildShift(secondShiftId, true)),
    ]);
    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const failure = rejected[0]?.reason as PgFailure;
    expect(failure.code).toBe('23505');
    expect(failure.constraint).toBe('uq_waste_tour_date_shifts_specific_origin');
  });

  it('allows annual and year-specific rules together and updates the existing row', async () => {
    await repository.upsertWasteTourDateShift(buildShift(annualShiftId, false));
    const specificRows = await repository.listWasteTourDateShifts({ hasYear: true });
    expect(specificRows).toHaveLength(1);

    const existing = specificRows[0];
    expect(existing).toBeDefined();
    if (!existing) return;

    await repository.upsertWasteTourDateShift({
      ...buildShift(existing.id, true),
      actualDate: '2026-12-22',
      description: 'updated own row',
    });

    const rows = await repository.listWasteTourDateShifts();
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === existing.id)).toMatchObject({
      actualDate: '2026-12-22',
      description: 'updated own row',
    });
  });

  it('returns ISO date-only strings under SQL DMY DateStyle', async () => {
    const rows = await withClient(async (client) => {
      await client.query(`SET datestyle TO 'SQL, DMY';`);
      const clientRepository = createWasteMasterDataRepository(createSqlExecutor(client));
      return await clientRepository.listWasteTourDateShifts();
    });

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.originalDate).toBe('2026-12-24');
      expect(row.actualDate).toMatch(/^2026-12-2[23]$/u);
      expect(typeof row.originalDate).toBe('string');
      expect(typeof row.actualDate).toBe('string');
      expect(row.originalDate).not.toBeInstanceOf(Date);
      expect(row.actualDate).not.toBeInstanceOf(Date);
    }
  });
});
