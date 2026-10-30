import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { wasteTourStatements } from '../repositories/master-data.tours.js';

import {
  buildWasteTourFractionsContractStatements,
  buildWasteTourFractionsExpandStatements,
} from './waste-tour-fractions.schema.js';

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('WASTE_DATE_SHIFT_TEST_DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const schema = 'waste_fraction_normalization_test';
const tourId = randomUUID();
const firstFraction = randomUUID();
const secondFraction = randomUUID();

const expand = async (client: PoolClient) => {
  await client.query('BEGIN');
  try {
    for (const sql of buildWasteTourFractionsExpandStatements(schema)) await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

const readFractions = async () => {
  const result = await pool.query<{ fraction_id: string }>(
    `SELECT fraction_id FROM ${schema}.waste_tour_fractions WHERE tour_id = $1 ORDER BY position`,
    [tourId]
  );
  return result.rows.map((row) => row.fraction_id);
};

describe('Waste tour fraction expand/contract against PostgreSQL', () => {
  beforeEach(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema};
      CREATE TABLE ${schema}.waste_fractions(id uuid PRIMARY KEY);
      CREATE TABLE ${schema}.waste_tours(id uuid PRIMARY KEY, name text,
        waste_fraction_ids text[] NOT NULL DEFAULT '{}', description text, recurrence text,
        custom_recurrence_id uuid, first_date date, end_date date, custom_dates jsonb,
        status text, active boolean, updated_at timestamptz DEFAULT now());`);
    await pool.query(`INSERT INTO ${schema}.waste_fractions VALUES ($1), ($2)`, [
      firstFraction,
      secondFraction,
    ]);
    await pool.query(
      `INSERT INTO ${schema}.waste_tours(id, name, waste_fraction_ids) VALUES ($1, 'Tour', $2)`,
      [tourId, [secondFraction, firstFraction]]
    );
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  });

  it('backfills order and blocks deleting a referenced fraction, including legacy array writes', async () => {
    const client = await pool.connect();
    try {
      await expand(client);
    } finally {
      client.release();
    }
    expect(await readFractions()).toEqual([secondFraction, firstFraction]);
    await expect(
      pool.query(`DELETE FROM ${schema}.waste_fractions WHERE id = $1`, [firstFraction])
    ).rejects.toMatchObject({ code: '23503' });
    await pool.query(`UPDATE ${schema}.waste_tours SET waste_fraction_ids = $2 WHERE id = $1`, [
      tourId,
      [firstFraction],
    ]);
    expect(await readFractions()).toEqual([firstFraction]);
    await pool.query(`DELETE FROM ${schema}.waste_fractions WHERE id = $1`, [secondFraction]);
    await pool.query(`DELETE FROM ${schema}.waste_tours WHERE id = $1`, [tourId]);
    expect(await readFractions()).toEqual([]);
    expect(
      (await pool.query(`SELECT count(*)::int AS n FROM ${schema}.waste_fractions`)).rows[0].n
    ).toBe(1);
  });

  it.each([
    ['invalid UUID', ['not-a-uuid']],
    ['NULL element', [null]],
    ['duplicate UUID', [firstFraction, firstFraction.toUpperCase()]],
    ['unknown fraction', [randomUUID()]],
  ])('rolls back the entire migration for %s', async (_label, ids) => {
    await pool.query(`UPDATE ${schema}.waste_tours SET waste_fraction_ids = $1`, [ids]);
    const client = await pool.connect();
    try {
      await expect(expand(client)).rejects.toThrow();
    } finally {
      client.release();
    }
    expect(
      (await pool.query(`SELECT to_regclass('${schema}.waste_tour_fractions') AS relation`)).rows[0]
        .relation
    ).toBeNull();
    expect(
      (await pool.query(`SELECT waste_fraction_ids FROM ${schema}.waste_tours`)).rows[0]
        .waste_fraction_ids
    ).toEqual(ids);
  });

  it('preserves historical empty arrays and rejects failed replacements atomically', async () => {
    await pool.query(`UPDATE ${schema}.waste_tours SET waste_fraction_ids = '{}'`);
    const client = await pool.connect();
    try {
      await expand(client);
      await expand(client);
    } finally {
      client.release();
    }
    expect(await readFractions()).toEqual([]);
    await pool.query(`SELECT ${schema}.replace_waste_tour_fractions($1, $2)`, [
      tourId,
      [firstFraction],
    ]);
    await expect(
      pool.query(`SELECT ${schema}.replace_waste_tour_fractions($1, $2)`, [
        tourId,
        [secondFraction, randomUUID()],
      ])
    ).rejects.toMatchObject({ code: '23503' });
    expect(await readFractions()).toEqual([firstFraction]);
  });

  it('rolls back an interrupted migration and permits a clean retry', async () => {
    const client = await pool.connect();
    client.on('error', () => undefined);
    try {
      await client.query('BEGIN');
      for (const sql of buildWasteTourFractionsExpandStatements(schema)) await client.query(sql);
      const pid = (await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]
        .pid;
      await pool.query('SELECT pg_terminate_backend($1)', [pid]);
      await expect(client.query('SELECT 1')).rejects.toThrow();
    } finally {
      client.release(true);
    }
    expect(
      (await pool.query(`SELECT to_regclass('${schema}.waste_tour_fractions') AS relation`)).rows[0]
        .relation
    ).toBeNull();
    const retry = await pool.connect();
    try {
      await expand(retry);
    } finally {
      retry.release();
    }
    expect(await readFractions()).toEqual([secondFraction, firstFraction]);
  });

  it('keeps the writer signature working after contract and on schema reinspection', async () => {
    const client = await pool.connect();
    try {
      await expand(client);
      await client.query('BEGIN');
      for (const sql of buildWasteTourFractionsContractStatements(schema)) await client.query(sql);
      await client.query('COMMIT');
      await expand(client);
      await client.query(`SELECT ${schema}.replace_waste_tour_fractions($1, $2)`, [
        tourId,
        [firstFraction],
      ]);
      expect(await readFractions()).toEqual([firstFraction]);
      await expect(
        client.query(`UPDATE ${schema}.waste_tours SET waste_fraction_ids = '{}'`)
      ).rejects.toMatchObject({ code: '42703' });
    } finally {
      client.release();
    }
  });

  it('executes the actual repository upsert atomically before and after contract', async () => {
    const client = await pool.connect();
    try {
      await expand(client);
      await client.query(`SET search_path TO ${schema}, public`);
      const statement = wasteTourStatements.upsertWasteTour({
        id: tourId,
        name: 'Changed',
        status: 'published',
        wasteFractionIds: [firstFraction],
      });
      await client.query(statement.text, [...statement.values]);
      expect(await readFractions()).toEqual([firstFraction]);
      const failed = wasteTourStatements.upsertWasteTour({
        id: tourId,
        name: 'Must roll back',
        status: 'draft',
        wasteFractionIds: [randomUUID()],
      });
      await expect(client.query(failed.text, [...failed.values])).rejects.toMatchObject({
        code: '23503',
      });
      expect(
        (await client.query(`SELECT name FROM ${schema}.waste_tours WHERE id = $1`, [tourId]))
          .rows[0].name
      ).toBe('Changed');
      expect(await readFractions()).toEqual([firstFraction]);
      await client.query('BEGIN');
      for (const sql of buildWasteTourFractionsContractStatements(schema)) await client.query(sql);
      await client.query('COMMIT');
      await client.query(statement.text, [...statement.values]);
      expect(await readFractions()).toEqual([firstFraction]);
    } finally {
      await client.query('RESET search_path');
      client.release();
    }
  });

  it('serializes concurrent replacements and blocks a concurrent referenced-fraction delete', async () => {
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await expand(first);
      await first.query('BEGIN');
      await first.query(`SELECT ${schema}.replace_waste_tour_fractions($1, $2)`, [
        tourId,
        [firstFraction],
      ]);
      const replacement = second.query(`SELECT ${schema}.replace_waste_tour_fractions($1, $2)`, [
        tourId,
        [secondFraction],
      ]);
      await first.query('COMMIT');
      await replacement;
      expect(await readFractions()).toEqual([secondFraction]);
      await first.query('BEGIN');
      await first.query(`SELECT ${schema}.replace_waste_tour_fractions($1, $2)`, [
        tourId,
        [firstFraction],
      ]);
      const deletion = second.query(`DELETE FROM ${schema}.waste_fractions WHERE id = $1`, [
        firstFraction,
      ]);
      const blockedDelete = expect(deletion).rejects.toMatchObject({ code: '23503' });
      await first.query('COMMIT');
      await blockedDelete;
      expect(await readFractions()).toEqual([firstFraction]);
    } finally {
      await first.query('ROLLBACK');
      first.release();
      second.release();
    }
  });
});
