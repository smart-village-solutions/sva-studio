import type {
  WasteLocationTourPickupDateListFilter,
  WasteLocationTourPickupDateRecord,
} from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';

type WasteLocationTourPickupDateRow = {
  readonly id: string;
  readonly location_id: string;
  readonly tour_id: string;
  readonly pickup_date: string;
  readonly created_at: string;
  readonly updated_at: string;
};

const mapWasteLocationTourPickupDateRow = (
  row: WasteLocationTourPickupDateRow
): WasteLocationTourPickupDateRecord => ({
  id: row.id,
  locationId: row.location_id,
  tourId: row.tour_id,
  pickupDate: row.pickup_date,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildLocationTourPickupDateListStatement = (
  filter: WasteLocationTourPickupDateListFilter = {}
): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.locationId?.trim()) {
    values.push(filter.locationId);
    conditions.push(`location_id = $${values.length}::uuid`);
  }

  if (filter.tourId?.trim()) {
    values.push(filter.tourId);
    conditions.push(`tour_id = $${values.length}::uuid`);
  }

  if (filter.pickupDate?.trim()) {
    values.push(filter.pickupDate);
    conditions.push(`pickup_date = $${values.length}::date`);
  }

  return {
    text: `
SELECT
  id::text,
  location_id::text,
  tour_id::text,
  pickup_date::text,
  created_at::text,
  updated_at::text
FROM waste_location_tour_pickup_dates
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY pickup_date ASC, created_at ASC, id ASC;
`,
    values,
  };
};

const buildLocationTourPickupDateSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  location_id::text,
  tour_id::text,
  pickup_date::text,
  created_at::text,
  updated_at::text
FROM waste_location_tour_pickup_dates
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildLocationTourPickupDateUpsertStatement = (
  input: Omit<WasteLocationTourPickupDateRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_location_tour_pickup_dates (
  id,
  location_id,
  tour_id,
  pickup_date
)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date)
ON CONFLICT (location_id, tour_id, pickup_date) DO UPDATE
SET updated_at = NOW();
`,
  values: [input.id, input.locationId, input.tourId, input.pickupDate],
});

export const createWasteLocationTourPickupDateRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  | 'listWasteLocationTourPickupDates'
  | 'getWasteLocationTourPickupDateById'
  | 'upsertWasteLocationTourPickupDate'
> => ({
  async listWasteLocationTourPickupDates(filter) {
    const result = await executor.execute<WasteLocationTourPickupDateRow>(
      buildLocationTourPickupDateListStatement(filter)
    );
    return result.rows.map(mapWasteLocationTourPickupDateRow);
  },
  async getWasteLocationTourPickupDateById(id) {
    const result = await executor.execute<WasteLocationTourPickupDateRow>(
      buildLocationTourPickupDateSelectStatement(id)
    );
    return result.rows[0] ? mapWasteLocationTourPickupDateRow(result.rows[0]) : null;
  },
  async upsertWasteLocationTourPickupDate(input) {
    await executor.execute(buildLocationTourPickupDateUpsertStatement(input));
  },
});

export const wasteLocationTourPickupDateStatements = {
  listWasteLocationTourPickupDates: buildLocationTourPickupDateListStatement,
  getWasteLocationTourPickupDateById: buildLocationTourPickupDateSelectStatement,
  upsertWasteLocationTourPickupDate: buildLocationTourPickupDateUpsertStatement,
} as const;
