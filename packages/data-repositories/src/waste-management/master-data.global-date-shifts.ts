import type {
  WasteDateShiftReasonType,
  WasteGlobalDateShiftListFilter,
  WasteGlobalDateShiftRecord,
} from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';
import { normalizeStringArray } from './master-data.shared.js';

type WasteGlobalDateShiftRow = {
  readonly id: string;
  readonly original_date: string;
  readonly actual_date: string;
  readonly has_year: boolean;
  readonly reason_type: WasteDateShiftReasonType | null;
  readonly reason_key: string | null;
  readonly description: string | null;
  readonly tour_ids: readonly string[] | null;
  readonly created_at: string;
  readonly updated_at: string;
};

const mapWasteGlobalDateShiftRow = (row: WasteGlobalDateShiftRow): WasteGlobalDateShiftRecord => ({
  id: row.id,
  originalDate: row.original_date,
  actualDate: row.actual_date,
  hasYear: row.has_year,
  reasonType: row.reason_type ?? undefined,
  reasonKey: row.reason_key ?? undefined,
  description: row.description ?? undefined,
  tourIds: row.tour_ids ? normalizeStringArray(row.tour_ids) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildGlobalDateShiftListStatement = (filter: WasteGlobalDateShiftListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (typeof filter.hasYear === 'boolean') {
    values.push(filter.hasYear);
    conditions.push(`has_year = $${values.length}`);
  }

  if (filter.appliesToTourId?.trim()) {
    values.push(filter.appliesToTourId);
    conditions.push(`(tour_ids IS NULL OR $${values.length} = ANY(tour_ids))`);
  }

  return {
    text: `
SELECT
  id::text,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  description,
  tour_ids,
  created_at::text,
  updated_at::text
FROM waste_global_date_shifts
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY original_date ASC, id ASC;
`,
    values,
  };
};

const buildGlobalDateShiftSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  description,
  tour_ids,
  created_at::text,
  updated_at::text
FROM waste_global_date_shifts
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildGlobalDateShiftUpsertStatement = (
  input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_global_date_shifts (
  id,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  description,
  tour_ids
)
VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::text[])
ON CONFLICT (id) DO UPDATE
SET original_date = EXCLUDED.original_date,
    actual_date = EXCLUDED.actual_date,
    has_year = EXCLUDED.has_year,
    reason_type = EXCLUDED.reason_type,
    reason_key = EXCLUDED.reason_key,
    description = EXCLUDED.description,
    tour_ids = EXCLUDED.tour_ids,
    updated_at = NOW();
`,
  values: [
    input.id,
    input.originalDate,
    input.actualDate,
    input.hasYear,
    input.reasonType ?? null,
    input.reasonKey ?? null,
    input.description ?? null,
    input.tourIds ?? null,
  ],
});

export const createWasteGlobalDateShiftRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  'listWasteGlobalDateShifts' | 'getWasteGlobalDateShiftById' | 'upsertWasteGlobalDateShift'
> => ({
  async listWasteGlobalDateShifts(filter) {
    const result = await executor.execute<WasteGlobalDateShiftRow>(buildGlobalDateShiftListStatement(filter));
    return result.rows.map(mapWasteGlobalDateShiftRow);
  },
  async getWasteGlobalDateShiftById(id) {
    const result = await executor.execute<WasteGlobalDateShiftRow>(buildGlobalDateShiftSelectStatement(id));
    return result.rows[0] ? mapWasteGlobalDateShiftRow(result.rows[0]) : null;
  },
  async upsertWasteGlobalDateShift(input) {
    await executor.execute(buildGlobalDateShiftUpsertStatement(input));
  },
});

export const wasteGlobalDateShiftStatements = {
  listWasteGlobalDateShifts: buildGlobalDateShiftListStatement,
  getWasteGlobalDateShiftById: buildGlobalDateShiftSelectStatement,
  upsertWasteGlobalDateShift: buildGlobalDateShiftUpsertStatement,
} as const;
