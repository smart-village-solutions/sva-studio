import type { WasteCustomRecurrencePresetRecord } from '@sva/core';

import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';

type WasteCustomRecurrencePresetRow = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly interval_days: number;
  readonly created_at: string;
  readonly updated_at: string;
};

const mapWasteCustomRecurrencePresetRow = (
  row: WasteCustomRecurrencePresetRow
): WasteCustomRecurrencePresetRecord => ({
  id: row.id,
  name: row.name,
  description: row.description ?? undefined,
  intervalDays: row.interval_days,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildCustomRecurrencePresetListStatement = (): SqlStatement => ({
  text: `
SELECT
  id::text,
  name,
  description,
  interval_days,
  created_at::text,
  updated_at::text
FROM waste_custom_recurrence_presets
ORDER BY name ASC;
`,
  values: [],
});

const buildCustomRecurrencePresetSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  name,
  description,
  interval_days,
  created_at::text,
  updated_at::text
FROM waste_custom_recurrence_presets
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildCustomRecurrencePresetUpsertStatement = (
  input: Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_custom_recurrence_presets (
  id,
  name,
  description,
  interval_days
)
VALUES ($1::uuid, $2, $3, $4)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    interval_days = EXCLUDED.interval_days,
    updated_at = NOW();
`,
  values: [input.id, input.name, input.description ?? null, input.intervalDays],
});

const buildCustomRecurrencePresetDeleteStatement = (id: string): SqlStatement => ({
  text: `
DELETE FROM waste_custom_recurrence_presets
WHERE id = $1::uuid;
`,
  values: [id],
});

export const createWasteCustomRecurrencePresetRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  | 'listWasteCustomRecurrencePresets'
  | 'getWasteCustomRecurrencePresetById'
  | 'upsertWasteCustomRecurrencePreset'
  | 'deleteWasteCustomRecurrencePreset'
> => ({
  async listWasteCustomRecurrencePresets() {
    const result = await executor.execute<WasteCustomRecurrencePresetRow>(buildCustomRecurrencePresetListStatement());
    return result.rows.map(mapWasteCustomRecurrencePresetRow);
  },
  async getWasteCustomRecurrencePresetById(id) {
    const result = await executor.execute<WasteCustomRecurrencePresetRow>(buildCustomRecurrencePresetSelectStatement(id));
    return result.rows[0] ? mapWasteCustomRecurrencePresetRow(result.rows[0]) : null;
  },
  async upsertWasteCustomRecurrencePreset(input) {
    await executor.execute(buildCustomRecurrencePresetUpsertStatement(input));
  },
  async deleteWasteCustomRecurrencePreset(id) {
    await executor.execute(buildCustomRecurrencePresetDeleteStatement(id));
  },
});

export const wasteCustomRecurrencePresetStatements = {
  listWasteCustomRecurrencePresets: buildCustomRecurrencePresetListStatement,
  getWasteCustomRecurrencePresetById: buildCustomRecurrencePresetSelectStatement,
  upsertWasteCustomRecurrencePreset: buildCustomRecurrencePresetUpsertStatement,
  deleteWasteCustomRecurrencePreset: buildCustomRecurrencePresetDeleteStatement,
} as const;
