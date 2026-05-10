import type {
  WasteHouseNumberListFilter,
  WasteHouseNumberRecord,
  WasteStreetListFilter,
  WasteStreetRecord,
} from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';
import { buildLikePattern } from './master-data.shared.js';

type WasteStreetRow = {
  readonly id: string;
  readonly name: string;
  readonly city_id: string;
  readonly created_at: string;
  readonly updated_at: string;
};

type WasteHouseNumberRow = {
  readonly id: string;
  readonly number: string;
  readonly street_id: string;
  readonly created_at: string;
  readonly updated_at: string;
};

const mapWasteStreetRow = (row: WasteStreetRow): WasteStreetRecord => ({
  id: row.id,
  name: row.name,
  cityId: row.city_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWasteHouseNumberRow = (row: WasteHouseNumberRow): WasteHouseNumberRecord => ({
  id: row.id,
  number: row.number,
  streetId: row.street_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildStreetListStatement = (filter: WasteStreetListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.cityId?.trim()) {
    values.push(filter.cityId);
    conditions.push(`city_id = $${values.length}::uuid`);
  }

  if (filter.search?.trim()) {
    values.push(buildLikePattern(filter.search));
    conditions.push(`name ILIKE $${values.length}`);
  }

  return {
    text: `
SELECT
  id::text,
  name,
  city_id::text,
  created_at::text,
  updated_at::text
FROM waste_streets
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY name ASC;
`,
    values,
  };
};

const buildStreetSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  name,
  city_id::text,
  created_at::text,
  updated_at::text
FROM waste_streets
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildStreetUpsertStatement = (input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>): SqlStatement => ({
  text: `
INSERT INTO waste_streets (
  id,
  name,
  city_id
)
VALUES ($1::uuid, $2, $3::uuid)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    city_id = EXCLUDED.city_id,
    updated_at = NOW();
`,
  values: [input.id, input.name, input.cityId],
});

const buildHouseNumberListStatement = (filter: WasteHouseNumberListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.streetId?.trim()) {
    values.push(filter.streetId);
    conditions.push(`street_id = $${values.length}::uuid`);
  }

  if (filter.search?.trim()) {
    values.push(buildLikePattern(filter.search));
    conditions.push(`number ILIKE $${values.length}`);
  }

  return {
    text: `
SELECT
  id::text,
  number,
  street_id::text,
  created_at::text,
  updated_at::text
FROM waste_house_numbers
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY number ASC;
`,
    values,
  };
};

const buildHouseNumberSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  number,
  street_id::text,
  created_at::text,
  updated_at::text
FROM waste_house_numbers
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildHouseNumberUpsertStatement = (
  input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_house_numbers (
  id,
  number,
  street_id
)
VALUES ($1::uuid, $2, $3::uuid)
ON CONFLICT (id) DO UPDATE
SET number = EXCLUDED.number,
    street_id = EXCLUDED.street_id,
    updated_at = NOW();
`,
  values: [input.id, input.number, input.streetId],
});

export const createWasteStreetHouseNumberRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  | 'listWasteStreets'
  | 'getWasteStreetById'
  | 'upsertWasteStreet'
  | 'listWasteHouseNumbers'
  | 'getWasteHouseNumberById'
  | 'upsertWasteHouseNumber'
> => ({
  async listWasteStreets(filter) {
    const result = await executor.execute<WasteStreetRow>(buildStreetListStatement(filter));
    return result.rows.map(mapWasteStreetRow);
  },
  async getWasteStreetById(id) {
    const result = await executor.execute<WasteStreetRow>(buildStreetSelectStatement(id));
    return result.rows[0] ? mapWasteStreetRow(result.rows[0]) : null;
  },
  async upsertWasteStreet(input) {
    await executor.execute(buildStreetUpsertStatement(input));
  },
  async listWasteHouseNumbers(filter) {
    const result = await executor.execute<WasteHouseNumberRow>(buildHouseNumberListStatement(filter));
    return result.rows.map(mapWasteHouseNumberRow);
  },
  async getWasteHouseNumberById(id) {
    const result = await executor.execute<WasteHouseNumberRow>(buildHouseNumberSelectStatement(id));
    return result.rows[0] ? mapWasteHouseNumberRow(result.rows[0]) : null;
  },
  async upsertWasteHouseNumber(input) {
    await executor.execute(buildHouseNumberUpsertStatement(input));
  },
});

export const wasteStreetHouseNumberStatements = {
  listWasteStreets: buildStreetListStatement,
  getWasteStreetById: buildStreetSelectStatement,
  upsertWasteStreet: buildStreetUpsertStatement,
  listWasteHouseNumbers: buildHouseNumberListStatement,
  getWasteHouseNumberById: buildHouseNumberSelectStatement,
  upsertWasteHouseNumber: buildHouseNumberUpsertStatement,
} as const;
