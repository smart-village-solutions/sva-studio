import type {
  WasteHolidayRuleConflictStatus,
  WasteHolidayRuleConfigurationStatus,
  WasteHolidayRuleListFilter,
  WasteHolidayRuleRecord,
  WasteHolidayRuleScope,
  WasteHolidayRuleSourceStatus,
  WasteHolidayRuleStrategy,
  WasteHolidayStateCode,
} from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';

type WasteHolidayRuleRow = {
  readonly id: string;
  readonly holiday_date: string;
  readonly holiday_name: string;
  readonly year: number;
  readonly state_code: WasteHolidayStateCode;
  readonly source_status: WasteHolidayRuleSourceStatus;
  readonly configuration_status: WasteHolidayRuleConfigurationStatus;
  readonly conflict_status: WasteHolidayRuleConflictStatus;
  readonly scope: string | null;
  readonly strategy: WasteHolidayRuleStrategy | null;
  readonly created_at: string;
  readonly updated_at: string;
};

const normalizeWasteHolidayRuleScope = (value: string | null): WasteHolidayRuleScope | undefined => {
  if (value === 'holiday-only' || value === 'full-week') {
    return value;
  }
  if (value === 'holiday_only') {
    return 'holiday-only';
  }
  if (value === 'full_week') {
    return 'full-week';
  }
  return undefined;
};

const mapWasteHolidayRuleRow = (row: WasteHolidayRuleRow): WasteHolidayRuleRecord => ({
  id: row.id,
  holidayDate: row.holiday_date,
  holidayName: row.holiday_name,
  year: row.year,
  stateCode: row.state_code,
  sourceStatus: row.source_status,
  configurationStatus: row.configuration_status,
  conflictStatus: row.conflict_status,
  scope: normalizeWasteHolidayRuleScope(row.scope),
  strategy: row.strategy ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildHolidayRuleListStatement = (filter: WasteHolidayRuleListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.stateCode) {
    values.push(filter.stateCode);
    conditions.push(`state_code = $${values.length}`);
  }
  if (typeof filter.year === 'number') {
    values.push(filter.year);
    conditions.push(`year = $${values.length}`);
  }
  if (filter.sourceStatus) {
    values.push(filter.sourceStatus);
    conditions.push(`source_status = $${values.length}`);
  }
  if (filter.configurationStatus) {
    values.push(filter.configurationStatus);
    conditions.push(`configuration_status = $${values.length}`);
  }
  if (filter.conflictStatus) {
    values.push(filter.conflictStatus);
    conditions.push(`conflict_status = $${values.length}`);
  }

  return {
    text: `
SELECT
  id::text,
  holiday_date,
  holiday_name,
  year,
  state_code,
  source_status,
  configuration_status,
  conflict_status,
  scope,
  strategy,
  created_at::text,
  updated_at::text
FROM waste_holiday_rules
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY holiday_date ASC, id ASC;
`,
    values,
  };
};

const buildHolidayRuleUpsertStatement = (
  input: Omit<WasteHolidayRuleRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_holiday_rules (
  id,
  holiday_date,
  holiday_name,
  year,
  state_code,
  source_status,
  configuration_status,
  conflict_status,
  scope,
  strategy
)
VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (id) DO UPDATE
SET holiday_date = EXCLUDED.holiday_date,
    holiday_name = EXCLUDED.holiday_name,
    year = EXCLUDED.year,
    state_code = EXCLUDED.state_code,
    source_status = EXCLUDED.source_status,
    configuration_status = EXCLUDED.configuration_status,
    conflict_status = EXCLUDED.conflict_status,
    scope = EXCLUDED.scope,
    strategy = EXCLUDED.strategy,
    updated_at = NOW();
`,
  values: [
    input.id,
    input.holidayDate,
    input.holidayName,
    input.year,
    input.stateCode,
    input.sourceStatus,
    input.configurationStatus,
    input.conflictStatus,
    input.scope ?? null,
    input.strategy ?? null,
  ],
});

export const createWasteHolidayRuleRepositoryPart = (
  executor: SqlExecutor
): Pick<WasteMasterDataRepository, 'listWasteHolidayRules' | 'upsertWasteHolidayRule'> => ({
  async listWasteHolidayRules(filter) {
    const result = await executor.execute<WasteHolidayRuleRow>(buildHolidayRuleListStatement(filter));
    return result.rows.map(mapWasteHolidayRuleRow);
  },
  async upsertWasteHolidayRule(input) {
    await executor.execute(buildHolidayRuleUpsertStatement(input));
  },
});

export const wasteHolidayRuleStatements = {
  listWasteHolidayRules: buildHolidayRuleListStatement,
  upsertWasteHolidayRule: buildHolidayRuleUpsertStatement,
} as const;
