import type { WasteFractionRecord, WasteLocalizedTextRecord } from './waste-management-master-data.js';

export type WasteTypeStaticContentEntry = {
  readonly label: string;
  readonly color: string;
  readonly selected_color: string;
  readonly id: string;
  readonly short_label: string;
  readonly active: boolean;
  readonly description: string | null;
  readonly container_size: string | null;
  readonly translations: WasteLocalizedTextRecord;
  readonly reminders: {
    readonly reminder_count: WasteFractionRecord['reminderCount'];
    readonly first_reminder_max_lead_days: number | null;
    readonly second_reminder_max_lead_days: number | null;
    readonly channels: {
      readonly push: boolean;
      readonly email: boolean;
      readonly calendar: boolean;
    };
  };
};

export type WasteTypesStaticContentArtifact = {
  readonly name: 'wasteTypes';
  readonly dataType: 'JSON';
  readonly version: `sha256:${string}`;
  readonly content: string;
  readonly fractionCount: number;
};

const normalizeWasteTypeKey = (value: string): string => value.trim().toUpperCase();

const toWasteTypeEntry = (fraction: WasteFractionRecord, shortLabel: string): WasteTypeStaticContentEntry => ({
  label: fraction.name,
  color: fraction.color,
  selected_color: fraction.color,
  id: fraction.id,
  short_label: shortLabel,
  active: fraction.active,
  description: fraction.description ?? null,
  container_size: fraction.containerSize ?? null,
  translations: fraction.translations ?? {},
  reminders: {
    reminder_count: fraction.reminderCount,
    first_reminder_max_lead_days: fraction.firstReminderMaxLeadDays ?? null,
    second_reminder_max_lead_days: fraction.secondReminderMaxLeadDays ?? null,
    channels: {
      push: fraction.reminderChannelPushEnabled,
      email: fraction.reminderChannelEmailEnabled,
      calendar: fraction.reminderChannelCalendarEnabled,
    },
  },
});

const hashContent = async (value: string): Promise<`sha256:${string}`> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('crypto_subtle_unavailable');
  }

  const buffer = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  const hash = Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hash}`;
};

export const buildWasteTypesStaticContent = async (
  fractions: readonly WasteFractionRecord[]
): Promise<WasteTypesStaticContentArtifact> => {
  const entries = fractions
    .filter((fraction) => fraction.active)
    .map((fraction) => {
      if (!fraction.pdfShortLabel?.trim()) {
        throw new Error(`missing_waste_type_short_label:${fraction.id}`);
      }
      const key = normalizeWasteTypeKey(fraction.pdfShortLabel);
      if (key.length === 0) {
        throw new Error(`invalid_waste_type_key:${fraction.id}`);
      }
      return [key, toWasteTypeEntry(fraction, key)] as const;
    })
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  const payload: Record<string, WasteTypeStaticContentEntry> = {};
  for (const [key, entry] of entries) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      throw new Error(`duplicate_waste_type_key:${key}`);
    }
    payload[key] = entry;
  }

  const content = JSON.stringify(payload, null, 2);

  return {
    name: 'wasteTypes',
    dataType: 'JSON',
    version: await hashContent(content),
    content,
    fractionCount: entries.length,
  };
};
