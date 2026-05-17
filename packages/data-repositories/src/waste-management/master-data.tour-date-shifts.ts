import type {
  WasteDateShiftReasonType,
  WasteTourDateShiftFollowUpMode,
  WasteTourDateShiftListFilter,
  WasteTourDateShiftRecord,
} from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';

type WasteTourDateShiftRow = {
  readonly id: string;
  readonly tour_id: string;
  readonly original_date: string;
  readonly actual_date: string;
  readonly has_year: boolean;
  readonly reason_type: WasteDateShiftReasonType | null;
  readonly reason_key: string | null;
  readonly follow_up_mode: WasteTourDateShiftFollowUpMode | null;
  readonly description: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

const mapWasteTourDateShiftRow = (row: WasteTourDateShiftRow): WasteTourDateShiftRecord => ({
  id: row.id,
  tourId: row.tour_id,
  originalDate: row.original_date,
  actualDate: row.actual_date,
  hasYear: row.has_year,
  reasonType: row.reason_type ?? undefined,
  reasonKey: row.reason_key ?? undefined,
  followUpMode: row.follow_up_mode ?? undefined,
  description: row.description ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildTourDateShiftListStatement = (filter: WasteTourDateShiftListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.tourId?.trim()) {
    values.push(filter.tourId);
    conditions.push(`tour_id = $${values.length}::uuid`);
  }

  if (typeof filter.hasYear === 'boolean') {
    values.push(filter.hasYear);
    conditions.push(`has_year = $${values.length}`);
  }

  return {
    text: `
SELECT
  id::text,
  tour_id::text,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  follow_up_mode,
  description,
  created_at::text,
  updated_at::text
FROM waste_tour_date_shifts
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY original_date ASC, id ASC;
`,
    values,
  };
};

const buildTourDateShiftSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  tour_id::text,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  follow_up_mode,
  description,
  created_at::text,
  updated_at::text
FROM waste_tour_date_shifts
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildTourDateShiftUpsertStatement = (
  input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_tour_date_shifts (
  id,
  tour_id,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  follow_up_mode,
  description
)
VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (id) DO UPDATE
SET tour_id = EXCLUDED.tour_id,
    original_date = EXCLUDED.original_date,
    actual_date = EXCLUDED.actual_date,
    has_year = EXCLUDED.has_year,
    reason_type = EXCLUDED.reason_type,
    reason_key = EXCLUDED.reason_key,
    follow_up_mode = EXCLUDED.follow_up_mode,
    description = EXCLUDED.description,
    updated_at = NOW();
`,
  values: [
    input.id,
    input.tourId,
    input.originalDate,
    input.actualDate,
    input.hasYear,
    input.reasonType ?? null,
    input.reasonKey ?? null,
    input.followUpMode ?? null,
    input.description ?? null,
  ],
});

const buildTourDateShiftDeleteStatement = (id: string): SqlStatement => ({
  text: `
DELETE FROM waste_tour_date_shifts
WHERE id = $1::uuid;
`,
  values: [id],
});

export const createWasteTourDateShiftRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  'listWasteTourDateShifts' | 'getWasteTourDateShiftById' | 'upsertWasteTourDateShift' | 'deleteWasteTourDateShift'
> => ({
  async listWasteTourDateShifts(filter) {
    const result = await executor.execute<WasteTourDateShiftRow>(buildTourDateShiftListStatement(filter));
    return result.rows.map(mapWasteTourDateShiftRow);
  },
  async getWasteTourDateShiftById(id) {
    const result = await executor.execute<WasteTourDateShiftRow>(buildTourDateShiftSelectStatement(id));
    return result.rows[0] ? mapWasteTourDateShiftRow(result.rows[0]) : null;
  },
  async upsertWasteTourDateShift(input) {
    await executor.execute(buildTourDateShiftUpsertStatement(input));
  },
  async deleteWasteTourDateShift(id) {
    await executor.execute(buildTourDateShiftDeleteStatement(id));
  },
});

export const wasteTourDateShiftStatements = {
  listWasteTourDateShifts: buildTourDateShiftListStatement,
  getWasteTourDateShiftById: buildTourDateShiftSelectStatement,
  upsertWasteTourDateShift: buildTourDateShiftUpsertStatement,
  deleteWasteTourDateShift: buildTourDateShiftDeleteStatement,
} as const;
