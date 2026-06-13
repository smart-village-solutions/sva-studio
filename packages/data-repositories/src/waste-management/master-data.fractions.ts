import type {
  WasteFractionListFilter,
  WasteFractionRecord,
  WasteFractionReminderChannel,
  WasteFractionReminderChannelConfig,
  WasteFractionReminderSlot,
} from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';
import { buildLikePattern, normalizeLocalizedTextRecord } from './master-data.shared.js';

type WasteFractionRow = {
  readonly id: string;
  readonly name: string;
  readonly pdf_short_label: string | null;
  readonly label_translations: unknown;
  readonly container_size: string | null;
  readonly color: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly reminder_config: unknown;
  readonly reminder_count: WasteFractionRecord['reminderConfig']['reminderCount'] | null;
  readonly first_reminder_max_lead_days: number | null;
  readonly second_reminder_max_lead_days: number | null;
  readonly reminder_channel_push_enabled: boolean | null;
  readonly reminder_channel_email_enabled: boolean | null;
  readonly reminder_channel_calendar_enabled: boolean | null;
  readonly created_at: string;
  readonly updated_at: string;
};

type PersistedReminderSlot = {
  readonly id?: unknown;
  readonly max_lead_days?: unknown;
  readonly default_lead_days?: unknown;
  readonly maxLeadDays?: unknown;
  readonly defaultLeadDays?: unknown;
};

type PersistedReminderChannelConfig = {
  readonly slots?: unknown;
};

type PersistedReminderConfig = {
  readonly reminder_count?: unknown;
  readonly reminderCount?: unknown;
  readonly channels?: unknown;
  readonly push?: unknown;
  readonly email?: unknown;
  readonly calendar?: unknown;
};

const emptyWasteFractionReminderConfig: WasteFractionRecord['reminderConfig'] = {
  reminderCount: 'none',
  channels: {
    push: false,
    email: false,
    calendar: false,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isReminderCount = (
  value: unknown
): value is WasteFractionRecord['reminderConfig']['reminderCount'] =>
  value === 'none' || value === 'once' || value === 'twice';

const normalizeReminderSlot = (value: unknown): WasteFractionReminderSlot | null => {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value as PersistedReminderSlot;
  const maxLeadDays =
    typeof candidate.max_lead_days === 'number'
      ? candidate.max_lead_days
      : typeof candidate.maxLeadDays === 'number'
        ? candidate.maxLeadDays
        : null;
  const defaultLeadDays =
    typeof candidate.default_lead_days === 'number'
      ? candidate.default_lead_days
      : typeof candidate.defaultLeadDays === 'number'
        ? candidate.defaultLeadDays
        : null;

  if (
    typeof candidate.id !== 'string' ||
    maxLeadDays === null ||
    !Number.isFinite(maxLeadDays) ||
    defaultLeadDays === null ||
    !Number.isFinite(defaultLeadDays)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    maxLeadDays,
    defaultLeadDays,
  };
};

const normalizeReminderChannelConfig = (value: unknown): WasteFractionReminderChannelConfig | undefined => {
  if (!isRecord(value) || !Array.isArray(value.slots)) {
    return undefined;
  }

  return {
    slots: value.slots
      .map(normalizeReminderSlot)
      .filter((slot): slot is NonNullable<ReturnType<typeof normalizeReminderSlot>> => slot !== null),
  };
};

const buildReminderSlotsFromLegacy = (
  row: Pick<WasteFractionRow, 'id' | 'reminder_count' | 'first_reminder_max_lead_days' | 'second_reminder_max_lead_days'>,
  channel: WasteFractionReminderChannel
): readonly WasteFractionReminderSlot[] => {
  const slots: WasteFractionReminderSlot[] = [];

  if (typeof row.first_reminder_max_lead_days === 'number') {
    slots.push({
      id: `${row.id}:${channel}:first`,
      maxLeadDays: row.first_reminder_max_lead_days,
      defaultLeadDays: 1,
    });
  }

  if (row.reminder_count === 'twice' && typeof row.second_reminder_max_lead_days === 'number') {
    slots.push({
      id: `${row.id}:${channel}:second`,
      maxLeadDays: row.second_reminder_max_lead_days,
      defaultLeadDays: 1,
    });
  }

  return slots;
};

const normalizeReminderConfigFromLegacy = (row: WasteFractionRow): WasteFractionRecord['reminderConfig'] => {
  if (!row.reminder_count || row.reminder_count === 'none') {
    return emptyWasteFractionReminderConfig;
  }

  const channels = {
    push: row.reminder_channel_push_enabled ?? false,
    email: row.reminder_channel_email_enabled ?? false,
    calendar: row.reminder_channel_calendar_enabled ?? false,
  } as const;

  return {
    reminderCount: row.reminder_count,
    channels,
    ...(channels.push ? { push: { slots: buildReminderSlotsFromLegacy(row, 'push') } } : {}),
    ...(channels.email ? { email: { slots: buildReminderSlotsFromLegacy(row, 'email') } } : {}),
    ...(channels.calendar ? { calendar: { slots: buildReminderSlotsFromLegacy(row, 'calendar') } } : {}),
  };
};

const normalizeReminderConfigFromJson = (value: unknown): WasteFractionRecord['reminderConfig'] | null => {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value as PersistedReminderConfig;
  const reminderCount = isReminderCount(candidate.reminder_count)
    ? candidate.reminder_count
    : isReminderCount(candidate.reminderCount)
      ? candidate.reminderCount
      : null;

  if (reminderCount === null) {
    return null;
  }

  if (reminderCount === 'none') {
    return emptyWasteFractionReminderConfig;
  }

  const channelsRecord = isRecord(candidate.channels) ? candidate.channels : {};
  const channels = {
    push: channelsRecord.push === true,
    email: channelsRecord.email === true,
    calendar: channelsRecord.calendar === true,
  } as const;

  return {
    reminderCount,
    channels,
    ...(channels.push ? { push: normalizeReminderChannelConfig(candidate.push) ?? { slots: [] } } : {}),
    ...(channels.email ? { email: normalizeReminderChannelConfig(candidate.email) ?? { slots: [] } } : {}),
    ...(channels.calendar ? { calendar: normalizeReminderChannelConfig(candidate.calendar) ?? { slots: [] } } : {}),
  };
};

const serializeReminderConfig = (reminderConfig: WasteFractionRecord['reminderConfig']): string =>
  JSON.stringify({
    reminder_count: reminderConfig.reminderCount,
    channels: reminderConfig.channels,
    ...(reminderConfig.channels.push && reminderConfig.push
      ? {
          push: {
            slots: reminderConfig.push.slots.map((slot) => ({
              id: slot.id,
              max_lead_days: slot.maxLeadDays,
              default_lead_days: slot.defaultLeadDays,
            })),
          },
        }
      : {}),
    ...(reminderConfig.channels.email && reminderConfig.email
      ? {
          email: {
            slots: reminderConfig.email.slots.map((slot) => ({
              id: slot.id,
              max_lead_days: slot.maxLeadDays,
              default_lead_days: slot.defaultLeadDays,
            })),
          },
        }
      : {}),
    ...(reminderConfig.channels.calendar && reminderConfig.calendar
      ? {
          calendar: {
            slots: reminderConfig.calendar.slots.map((slot) => ({
              id: slot.id,
              max_lead_days: slot.maxLeadDays,
              default_lead_days: slot.defaultLeadDays,
            })),
          },
        }
      : {}),
  });

const toLegacyReminderColumns = (reminderConfig: WasteFractionRecord['reminderConfig']) => {
  const firstAvailableSlots =
    reminderConfig.push?.slots ??
    reminderConfig.email?.slots ??
    reminderConfig.calendar?.slots ??
    [];

  return {
    reminderCount: reminderConfig.reminderCount,
    firstReminderMaxLeadDays:
      reminderConfig.reminderCount === 'none' ? null : firstAvailableSlots[0]?.maxLeadDays ?? null,
    secondReminderMaxLeadDays:
      reminderConfig.reminderCount === 'twice' ? firstAvailableSlots[1]?.maxLeadDays ?? null : null,
    reminderChannelPushEnabled: reminderConfig.reminderCount === 'none' ? false : reminderConfig.channels.push,
    reminderChannelEmailEnabled: reminderConfig.reminderCount === 'none' ? false : reminderConfig.channels.email,
    reminderChannelCalendarEnabled: reminderConfig.reminderCount === 'none' ? false : reminderConfig.channels.calendar,
  };
};

const mapWasteFractionRow = (row: WasteFractionRow): WasteFractionRecord => ({
  id: row.id,
  name: row.name,
  pdfShortLabel: row.pdf_short_label ?? undefined,
  translations: normalizeLocalizedTextRecord(row.label_translations),
  containerSize: row.container_size ?? undefined,
  color: row.color,
  description: row.description ?? undefined,
  active: row.active,
  reminderConfig: normalizeReminderConfigFromJson(row.reminder_config) ?? normalizeReminderConfigFromLegacy(row),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

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
