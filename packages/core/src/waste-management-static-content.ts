import type { WasteFractionRecord } from './waste-management-master-data.js';
import type { WasteLocalizedTextRecord } from './waste-management/master-data-localized-text.js';

type WasteReminderChannel = keyof WasteFractionRecord['reminderConfig']['channels'];

type WasteReminderSlot = {
  readonly id: string;
  readonly max_lead_days: number;
  readonly default_lead_days: number;
};

type WasteReminderChannelConfig = {
  readonly slots: readonly WasteReminderSlot[];
};

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
    readonly reminder_count: WasteFractionRecord['reminderConfig']['reminderCount'];
    readonly channels: WasteFractionRecord['reminderConfig']['channels'];
    readonly push?: WasteReminderChannelConfig;
    readonly email?: WasteReminderChannelConfig;
    readonly calendar?: WasteReminderChannelConfig;
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
const toReminderChannelConfig = (
  channelConfig: WasteFractionRecord['reminderConfig'][WasteReminderChannel]
): WasteReminderChannelConfig | undefined => {
  if (!channelConfig) {
    return undefined;
  }

  return {
    slots: channelConfig.slots.map((slot) => ({
      id: slot.id,
      max_lead_days: slot.maxLeadDays,
      default_lead_days: slot.defaultLeadDays,
    })),
  };
};

const normalizeReminderConfigForStaticContent = (
  reminderConfig: WasteFractionRecord['reminderConfig']
): WasteFractionRecord['reminderConfig'] => {
  if (reminderConfig.reminderCount === 'none') {
    return {
      reminderCount: 'none',
      channels: {
        push: false,
        email: false,
        calendar: false,
      },
    };
  }

  return {
    reminderCount: reminderConfig.reminderCount,
    channels: reminderConfig.channels,
    ...(reminderConfig.channels.push && reminderConfig.push ? { push: reminderConfig.push } : {}),
    ...(reminderConfig.channels.email && reminderConfig.email ? { email: reminderConfig.email } : {}),
    ...(reminderConfig.channels.calendar && reminderConfig.calendar ? { calendar: reminderConfig.calendar } : {}),
  };
};

const compareWasteTypeKeys = (leftKey: string, rightKey: string): number => {
  if (leftKey === rightKey) {
    return 0;
  }

  return leftKey < rightKey ? -1 : 1;
};

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
  reminders: (() => {
    const reminderConfig = normalizeReminderConfigForStaticContent(fraction.reminderConfig);
    const push = toReminderChannelConfig(reminderConfig.push);
    const email = toReminderChannelConfig(reminderConfig.email);
    const calendar = toReminderChannelConfig(reminderConfig.calendar);

    return {
      reminder_count: reminderConfig.reminderCount,
      channels: reminderConfig.channels,
      ...(push ? { push } : {}),
      ...(email ? { email } : {}),
      ...(calendar ? { calendar } : {}),
    };
  })(),
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
    .sort(([leftKey], [rightKey]) => compareWasteTypeKeys(leftKey, rightKey));

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
