import type { WasteCityListFilter, WasteCityRecord, WasteRegionListFilter, WasteRegionRecord } from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';
import { buildLikePattern } from './master-data.shared.js';

type WasteRegionRow = {
  readonly id: string;
  readonly name: string;
  readonly created_at: string;
  readonly updated_at: string;
};

type WasteCityRow = {
  readonly id: string;
  readonly name: string;
  readonly region_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

const mapWasteRegionRow = (row: WasteRegionRow): WasteRegionRecord => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWasteCityRow = (row: WasteCityRow): WasteCityRecord => ({
  id: row.id,
  name: row.name,
  regionId: row.region_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildRegionListStatement = (filter: WasteRegionListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.search?.trim()) {
    values.push(buildLikePattern(filter.search));
    conditions.push(`name ILIKE $${values.length}`);
  }

  return {
    text: `
SELECT
  id::text,
  name,
  created_at::text,
  updated_at::text
FROM waste_regions
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY name ASC;
`,
    values,
  };
};

const buildRegionSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  name,
  created_at::text,
  updated_at::text
FROM waste_regions
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildRegionUpsertStatement = (input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>): SqlStatement => ({
  text: `
INSERT INTO waste_regions (
  id,
  name
)
VALUES ($1::uuid, $2)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = NOW();
`,
  values: [input.id, input.name],
});

const buildCityListStatement = (filter: WasteCityListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.regionId?.trim()) {
    values.push(filter.regionId);
    conditions.push(`region_id = $${values.length}::uuid`);
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
  region_id::text,
  created_at::text,
  updated_at::text
FROM waste_cities
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY name ASC;
`,
    values,
  };
};

const buildCitySelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  name,
  region_id::text,
  created_at::text,
  updated_at::text
FROM waste_cities
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildCityUpsertStatement = (input: Omit<WasteCityRecord, 'createdAt' | 'updatedAt'>): SqlStatement => ({
  text: `
INSERT INTO waste_cities (
  id,
  name,
  region_id
)
VALUES ($1::uuid, $2, $3::uuid)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    region_id = EXCLUDED.region_id,
    updated_at = NOW();
`,
  values: [input.id, input.name, input.regionId ?? null],
});

export const createWasteRegionCityRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  'listWasteRegions' | 'getWasteRegionById' | 'upsertWasteRegion' | 'listWasteCities' | 'getWasteCityById' | 'upsertWasteCity'
> => ({
  async listWasteRegions(filter) {
    const result = await executor.execute<WasteRegionRow>(buildRegionListStatement(filter));
    return result.rows.map(mapWasteRegionRow);
  },
  async getWasteRegionById(id) {
    const result = await executor.execute<WasteRegionRow>(buildRegionSelectStatement(id));
    return result.rows[0] ? mapWasteRegionRow(result.rows[0]) : null;
  },
  async upsertWasteRegion(input) {
    await executor.execute(buildRegionUpsertStatement(input));
  },
  async listWasteCities(filter) {
    const result = await executor.execute<WasteCityRow>(buildCityListStatement(filter));
    return result.rows.map(mapWasteCityRow);
  },
  async getWasteCityById(id) {
    const result = await executor.execute<WasteCityRow>(buildCitySelectStatement(id));
    return result.rows[0] ? mapWasteCityRow(result.rows[0]) : null;
  },
  async upsertWasteCity(input) {
    await executor.execute(buildCityUpsertStatement(input));
  },
});

export const wasteRegionCityStatements = {
  listWasteRegions: buildRegionListStatement,
  getWasteRegionById: buildRegionSelectStatement,
  upsertWasteRegion: buildRegionUpsertStatement,
  listWasteCities: buildCityListStatement,
  getWasteCityById: buildCitySelectStatement,
  upsertWasteCity: buildCityUpsertStatement,
} as const;
