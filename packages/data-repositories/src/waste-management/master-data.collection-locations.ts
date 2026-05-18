import type {
  WasteCollectionLocationListFilter,
  WasteCollectionLocationRecord,
} from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';

type WasteCollectionLocationRow = {
  readonly id: string;
  readonly city_id: string;
  readonly region_id: string | null;
  readonly street_id: string | null;
  readonly house_number_id: string | null;
  readonly active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

const mapWasteCollectionLocationRow = (row: WasteCollectionLocationRow): WasteCollectionLocationRecord => ({
  id: row.id,
  cityId: row.city_id,
  regionId: row.region_id ?? undefined,
  streetId: row.street_id ?? undefined,
  houseNumberId: row.house_number_id ?? undefined,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildCollectionLocationListStatement = (filter: WasteCollectionLocationListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.cityId?.trim()) {
    values.push(filter.cityId);
    conditions.push(`city_id = $${values.length}::uuid`);
  }

  if (filter.regionId?.trim()) {
    values.push(filter.regionId);
    conditions.push(`region_id = $${values.length}::uuid`);
  }

  if (filter.streetId?.trim()) {
    values.push(filter.streetId);
    conditions.push(`street_id = $${values.length}::uuid`);
  }

  if (filter.houseNumberId?.trim()) {
    values.push(filter.houseNumberId);
    conditions.push(`house_number_id = $${values.length}::uuid`);
  }

  if (typeof filter.active === 'boolean') {
    values.push(filter.active);
    conditions.push(`active = $${values.length}`);
  }

  return {
    text: `
SELECT
  id::text,
  city_id::text,
  region_id::text,
  street_id::text,
  house_number_id::text,
  active,
  created_at::text,
  updated_at::text
FROM waste_collection_locations
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY created_at ASC, id ASC;
`,
    values,
  };
};

const buildCollectionLocationSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  city_id::text,
  region_id::text,
  street_id::text,
  house_number_id::text,
  active,
  created_at::text,
  updated_at::text
FROM waste_collection_locations
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildCollectionLocationUpsertStatement = (
  input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_collection_locations (
  id,
  city_id,
  region_id,
  street_id,
  house_number_id,
  active
)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6)
ON CONFLICT (id) DO UPDATE
SET city_id = EXCLUDED.city_id,
    region_id = EXCLUDED.region_id,
    street_id = EXCLUDED.street_id,
    house_number_id = EXCLUDED.house_number_id,
    active = EXCLUDED.active,
    updated_at = NOW();
`,
  values: [
    input.id,
    input.cityId,
    input.regionId ?? null,
    input.streetId ?? null,
    input.houseNumberId ?? null,
    input.active,
  ],
});

const buildCollectionLocationDeleteStatement = (id: string): SqlStatement => ({
  text: `
DELETE FROM waste_collection_locations
WHERE id = $1::uuid;
`,
  values: [id],
});

export const createWasteCollectionLocationRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  | 'listWasteCollectionLocations'
  | 'getWasteCollectionLocationById'
  | 'upsertWasteCollectionLocation'
  | 'deleteWasteCollectionLocation'
> => ({
  async listWasteCollectionLocations(filter) {
    const result = await executor.execute<WasteCollectionLocationRow>(
      buildCollectionLocationListStatement(filter)
    );
    return result.rows.map(mapWasteCollectionLocationRow);
  },
  async getWasteCollectionLocationById(id) {
    const result = await executor.execute<WasteCollectionLocationRow>(
      buildCollectionLocationSelectStatement(id)
    );
    return result.rows[0] ? mapWasteCollectionLocationRow(result.rows[0]) : null;
  },
  async upsertWasteCollectionLocation(input) {
    await executor.execute(buildCollectionLocationUpsertStatement(input));
  },
  async deleteWasteCollectionLocation(id) {
    await executor.execute(buildCollectionLocationDeleteStatement(id));
  },
});

export const wasteCollectionLocationStatements = {
  listWasteCollectionLocations: buildCollectionLocationListStatement,
  getWasteCollectionLocationById: buildCollectionLocationSelectStatement,
  upsertWasteCollectionLocation: buildCollectionLocationUpsertStatement,
  deleteWasteCollectionLocation: buildCollectionLocationDeleteStatement,
} as const;
