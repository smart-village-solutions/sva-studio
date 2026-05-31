import type { WasteTourListFilter, WasteTourRecord } from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';
import { buildLikePattern, normalizeCustomDates, normalizeStringArray } from './master-data.shared.js';

type WasteTourRow = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly waste_fraction_ids: readonly string[] | null;
  readonly recurrence: WasteTourRecord['recurrence'];
  readonly custom_recurrence_id: string | null;
  readonly custom_recurrence_name: string | null;
  readonly custom_recurrence_interval_days: number | null;
  readonly first_date: string | null;
  readonly end_date: string | null;
  readonly custom_dates: unknown;
  readonly active: boolean;
  readonly location_count?: number | null;
  readonly created_at: string;
  readonly updated_at: string;
};

const mapWasteTourRow = (row: WasteTourRow): WasteTourRecord => ({
  id: row.id,
  name: row.name,
  description: row.description ?? undefined,
  wasteFractionIds: normalizeStringArray(row.waste_fraction_ids),
  recurrence: row.recurrence ?? null,
  customRecurrenceId: row.custom_recurrence_id ?? undefined,
  customRecurrenceName: row.custom_recurrence_name ?? undefined,
  customRecurrenceIntervalDays: row.custom_recurrence_interval_days ?? undefined,
  firstDate: row.first_date ?? undefined,
  endDate: row.end_date ?? undefined,
  customDates: normalizeCustomDates(row.custom_dates),
  active: row.active,
  locationCount: typeof row.location_count === 'number' ? row.location_count : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildTourListStatement = (filter: WasteTourListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (typeof filter.active === 'boolean') {
    values.push(filter.active);
    conditions.push(`t.active = $${values.length}`);
  }

  if (filter.recurrence) {
    values.push(filter.recurrence);
    conditions.push(`t.recurrence = $${values.length}`);
  }

  if (filter.wasteFractionId?.trim()) {
    values.push(filter.wasteFractionId);
    conditions.push(`$${values.length} = ANY(t.waste_fraction_ids)`);
  }

  if (filter.search?.trim()) {
    values.push(buildLikePattern(filter.search));
    conditions.push(`t.name ILIKE $${values.length}`);
  }

  return {
    text: `
SELECT
  t.id::text,
  t.name,
  t.description,
  t.waste_fraction_ids,
  t.recurrence,
  t.custom_recurrence_id::text,
  crp.name AS custom_recurrence_name,
  crp.interval_days AS custom_recurrence_interval_days,
  t.first_date::text,
  t.end_date::text,
  t.custom_dates,
  t.active,
  COUNT(ltl.id)::int AS location_count,
  t.created_at::text,
  t.updated_at::text
FROM waste_tours t
LEFT JOIN waste_custom_recurrence_presets crp
  ON crp.id = t.custom_recurrence_id
LEFT JOIN waste_location_tour_links ltl
  ON ltl.tour_id = t.id
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
GROUP BY t.id, crp.id
ORDER BY t.name ASC;
`,
    values,
  };
};

const buildTourSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  t.id::text,
  t.name,
  t.description,
  t.waste_fraction_ids,
  t.recurrence,
  t.custom_recurrence_id::text,
  crp.name AS custom_recurrence_name,
  crp.interval_days AS custom_recurrence_interval_days,
  t.first_date::text,
  t.end_date::text,
  t.custom_dates,
  t.active,
  COUNT(ltl.id)::int AS location_count,
  t.created_at::text,
  t.updated_at::text
FROM waste_tours t
LEFT JOIN waste_custom_recurrence_presets crp
  ON crp.id = t.custom_recurrence_id
LEFT JOIN waste_location_tour_links ltl
  ON ltl.tour_id = t.id
WHERE t.id = $1::uuid
GROUP BY t.id, crp.id
LIMIT 1;
`,
  values: [id],
});

const buildTourUpsertStatement = (input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>): SqlStatement => ({
  text: `
INSERT INTO waste_tours (
  id,
  name,
  description,
  waste_fraction_ids,
  recurrence,
  custom_recurrence_id,
  first_date,
  end_date,
  custom_dates,
  active
)
VALUES ($1::uuid, $2, $3, $4::text[], $5, $6::uuid, $7::date, $8::date, $9::jsonb, $10)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    waste_fraction_ids = EXCLUDED.waste_fraction_ids,
    recurrence = EXCLUDED.recurrence,
    custom_recurrence_id = EXCLUDED.custom_recurrence_id,
    first_date = EXCLUDED.first_date,
    end_date = EXCLUDED.end_date,
    custom_dates = EXCLUDED.custom_dates,
    active = EXCLUDED.active,
    updated_at = NOW();
`,
  values: [
    input.id,
    input.name,
    input.description ?? null,
    input.wasteFractionIds,
    input.recurrence ?? null,
    input.customRecurrenceId ?? null,
    input.firstDate ?? null,
    input.endDate ?? null,
    input.customDates ? JSON.stringify(input.customDates) : null,
    input.active,
  ],
});

const buildTourDeleteStatement = (id: string): SqlStatement => ({
  text: `
DELETE FROM waste_tours
WHERE id = $1::uuid;
`,
  values: [id],
});

export const createWasteTourRepositoryPart = (
  executor: SqlExecutor
): Pick<WasteMasterDataRepository, 'listWasteTours' | 'getWasteTourById' | 'upsertWasteTour' | 'deleteWasteTour'> => ({
  async listWasteTours(filter) {
    const result = await executor.execute<WasteTourRow>(buildTourListStatement(filter));
    return result.rows.map(mapWasteTourRow);
  },
  async getWasteTourById(id) {
    const result = await executor.execute<WasteTourRow>(buildTourSelectStatement(id));
    return result.rows[0] ? mapWasteTourRow(result.rows[0]) : null;
  },
  async upsertWasteTour(input) {
    await executor.execute(buildTourUpsertStatement(input));
  },
  async deleteWasteTour(id) {
    await executor.execute(buildTourDeleteStatement(id));
  },
});

export const wasteTourStatements = {
  listWasteTours: buildTourListStatement,
  getWasteTourById: buildTourSelectStatement,
  upsertWasteTour: buildTourUpsertStatement,
  deleteWasteTour: buildTourDeleteStatement,
} as const;
