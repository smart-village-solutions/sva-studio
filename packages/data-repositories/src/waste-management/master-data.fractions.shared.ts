import type {
  WasteFractionRecord,
  WasteFractionReminderChannel,
  WasteFractionReminderChannelConfig,
  WasteFractionReminderSlot,
} from '@sva/core';

import { normalizeLocalizedTextRecord } from './master-data.shared.js';

export type WasteFractionRow = {
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

const hasEnabledReminderChannel = (
  channels: WasteFractionRecord['reminderConfig']['channels']
): boolean => channels.push || channels.email || channels.calendar;

const normalizeReminderConfigFromLegacy = (row: WasteFractionRow): WasteFractionRecord['reminderConfig'] => {
  if (!row.reminder_count || row.reminder_count === 'none') {
    return emptyWasteFractionReminderConfig;
  }

  const channels = {
    push: row.reminder_channel_push_enabled ?? false,
    email: row.reminder_channel_email_enabled ?? false,
    calendar: row.reminder_channel_calendar_enabled ?? false,
  } as const;

  if (!hasEnabledReminderChannel(channels)) {
    return emptyWasteFractionReminderConfig;
  }

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

export const mapWasteFractionRow = (row: WasteFractionRow): WasteFractionRecord => ({
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
