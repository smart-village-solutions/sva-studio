import type { WasteFractionListFilter, WasteFractionRecord } from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';
import {
  mapWasteFractionRow,
  type WasteFractionRow,
} from './master-data.fractions.shared.js';
import {
  serializeReminderConfig,
  toLegacyReminderColumns,
} from './master-data.fractions.persistence.js';
import { buildLikePattern } from './master-data.shared.js';

const buildFractionListStatement = (filter: WasteFractionListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (typeof filter.active === 'boolean') {
    values.push(filter.active);
    conditions.push(`active = $${values.length}`);
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
  pdf_short_label,
  label_translations,
  container_size,
  color,
  description,
  active,
  reminder_config,
  reminder_count,
  first_reminder_max_lead_days,
  second_reminder_max_lead_days,
  reminder_channel_push_enabled,
  reminder_channel_email_enabled,
  reminder_channel_calendar_enabled,
  created_at::text,
  updated_at::text
FROM waste_fractions
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY name ASC;
`,
    values,
  };
};

const buildFractionSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  name,
  pdf_short_label,
  label_translations,
  container_size,
  color,
  description,
  active,
  reminder_config,
  reminder_count,
  first_reminder_max_lead_days,
  second_reminder_max_lead_days,
  reminder_channel_push_enabled,
  reminder_channel_email_enabled,
  reminder_channel_calendar_enabled,
  created_at::text,
  updated_at::text
FROM waste_fractions
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildFractionUpsertStatement = (
  input: Omit<WasteFractionRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => {
  const legacyReminderColumns = toLegacyReminderColumns(input.reminderConfig);

  return {
    text: `
INSERT INTO waste_fractions (
  id,
  name,
  pdf_short_label,
  label_translations,
  container_size,
  color,
  description,
  active,
  reminder_config,
  reminder_count,
  first_reminder_max_lead_days,
  second_reminder_max_lead_days,
  reminder_channel_push_enabled,
  reminder_channel_email_enabled,
  reminder_channel_calendar_enabled
)
VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    pdf_short_label = EXCLUDED.pdf_short_label,
    label_translations = EXCLUDED.label_translations,
    container_size = EXCLUDED.container_size,
    color = EXCLUDED.color,
    description = EXCLUDED.description,
    active = EXCLUDED.active,
    reminder_config = EXCLUDED.reminder_config,
    reminder_count = EXCLUDED.reminder_count,
    first_reminder_max_lead_days = EXCLUDED.first_reminder_max_lead_days,
    second_reminder_max_lead_days = EXCLUDED.second_reminder_max_lead_days,
    reminder_channel_push_enabled = EXCLUDED.reminder_channel_push_enabled,
    reminder_channel_email_enabled = EXCLUDED.reminder_channel_email_enabled,
    reminder_channel_calendar_enabled = EXCLUDED.reminder_channel_calendar_enabled,
    updated_at = NOW();
`,
    values: [
      input.id,
      input.name,
      input.pdfShortLabel ?? null,
      input.translations ? JSON.stringify(input.translations) : null,
      input.containerSize ?? null,
      input.color,
      input.description ?? null,
      input.active,
      serializeReminderConfig(input.reminderConfig),
      legacyReminderColumns.reminderCount,
      legacyReminderColumns.firstReminderMaxLeadDays,
      legacyReminderColumns.secondReminderMaxLeadDays,
      legacyReminderColumns.reminderChannelPushEnabled,
      legacyReminderColumns.reminderChannelEmailEnabled,
      legacyReminderColumns.reminderChannelCalendarEnabled,
    ],
  };
};

const buildFractionDeleteStatement = (id: string): SqlStatement => ({
  text: `
DELETE FROM waste_fractions
WHERE id = $1::uuid;
`,
  values: [id],
});

export const createWasteFractionRepositoryPart = (
  executor: SqlExecutor
): Pick<WasteMasterDataRepository, 'listWasteFractions' | 'getWasteFractionById' | 'upsertWasteFraction' | 'deleteWasteFraction'> => ({
  async listWasteFractions(filter) {
    const result = await executor.execute<WasteFractionRow>(buildFractionListStatement(filter));
    return result.rows.map(mapWasteFractionRow);
  },
  async getWasteFractionById(id) {
    const result = await executor.execute<WasteFractionRow>(buildFractionSelectStatement(id));
    return result.rows[0] ? mapWasteFractionRow(result.rows[0]) : null;
  },
  async upsertWasteFraction(input) {
    await executor.execute(buildFractionUpsertStatement(input));
  },
  async deleteWasteFraction(id) {
    await executor.execute(buildFractionDeleteStatement(id));
  },
});

export const wasteFractionStatements = {
  listWasteFractions: buildFractionListStatement,
  getWasteFractionById: buildFractionSelectStatement,
  upsertWasteFraction: buildFractionUpsertStatement,
  deleteWasteFraction: buildFractionDeleteStatement,
} as const;
