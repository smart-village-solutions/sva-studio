import type { WasteLocationTourLinkListFilter, WasteLocationTourLinkRecord } from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';

type WasteLocationTourLinkRow = {
  readonly id: string;
  readonly location_id: string;
  readonly tour_id: string;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

const mapWasteLocationTourLinkRow = (
  row: WasteLocationTourLinkRow
): WasteLocationTourLinkRecord => ({
  id: row.id,
  locationId: row.location_id,
  tourId: row.tour_id,
  startDate: row.start_date ?? undefined,
  endDate: row.end_date ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildLocationTourLinkListStatement = (
  filter: WasteLocationTourLinkListFilter = {}
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

  return {
    text: `
SELECT
  id::text,
  location_id::text,
  tour_id::text,
  start_date::text,
  end_date::text,
  created_at::text,
  updated_at::text
FROM waste_location_tour_links
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY created_at ASC, id ASC;
`,
    values,
  };
};

const buildLocationTourLinkSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  location_id::text,
  tour_id::text,
  start_date::text,
  end_date::text,
  created_at::text,
  updated_at::text
FROM waste_location_tour_links
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildLocationTourLinkUpsertStatement = (
  input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_location_tour_links (
  id,
  location_id,
  tour_id,
  start_date,
  end_date
)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, $5::date)
ON CONFLICT (id) DO UPDATE
SET location_id = EXCLUDED.location_id,
    tour_id = EXCLUDED.tour_id,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    updated_at = NOW();
`,
  values: [input.id, input.locationId, input.tourId, input.startDate ?? null, input.endDate ?? null],
});

const buildLocationTourLinkDeleteStatement = (id: string): SqlStatement => ({
  text: `
DELETE FROM waste_location_tour_links
WHERE id = $1::uuid;
`,
  values: [id],
});

export const createWasteLocationTourLinkRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  | 'listWasteLocationTourLinks'
  | 'listWasteLocationTourLinksByTourId'
  | 'getWasteLocationTourLinkById'
  | 'upsertWasteLocationTourLink'
  | 'deleteWasteLocationTourLink'
> => ({
  async listWasteLocationTourLinks(filter) {
    const result = await executor.execute<WasteLocationTourLinkRow>(
      buildLocationTourLinkListStatement(filter)
    );
    return result.rows.map(mapWasteLocationTourLinkRow);
  },
  async listWasteLocationTourLinksByTourId(tourId) {
    const result = await executor.execute<WasteLocationTourLinkRow>(
      buildLocationTourLinkListStatement({ tourId })
    );
    return result.rows.map(mapWasteLocationTourLinkRow);
  },
  async getWasteLocationTourLinkById(id) {
    const result = await executor.execute<WasteLocationTourLinkRow>(
      buildLocationTourLinkSelectStatement(id)
    );
    return result.rows[0] ? mapWasteLocationTourLinkRow(result.rows[0]) : null;
  },
  async upsertWasteLocationTourLink(input) {
    await executor.execute(buildLocationTourLinkUpsertStatement(input));
  },
  async deleteWasteLocationTourLink(id) {
    await executor.execute(buildLocationTourLinkDeleteStatement(id));
  },
});

export const wasteLocationTourLinkStatements = {
  listWasteLocationTourLinks: buildLocationTourLinkListStatement,
  getWasteLocationTourLinkById: buildLocationTourLinkSelectStatement,
  upsertWasteLocationTourLink: buildLocationTourLinkUpsertStatement,
  deleteWasteLocationTourLink: buildLocationTourLinkDeleteStatement,
} as const;
