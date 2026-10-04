import type {
  PublicWasteLocationCatalogEntry,
  PublicWasteReminderChannel,
  PublicWasteReminderFractionOption,
  PublicWasteReminderFractionSlotOption,
  PublicWasteResolvedSelection,
  PublicWasteSelectableEntry,
} from './public-waste-contract.js';
import {
  buildPublicWasteLocationKey,
  PUBLIC_WASTE_CATCH_ALL_HOUSE_NUMBER_ID,
  PUBLIC_WASTE_CATCH_ALL_STREET_ID,
} from './public-waste-contract.js';

export type SelectionRow = {
  readonly id: string;
  readonly label: string;
  readonly is_catch_all?: boolean;
  readonly sort_priority?: number;
};

export type PublicLocationRow = {
  readonly region_id: string | null;
  readonly region_name: string | null;
  readonly city_id: string;
  readonly city_name: string;
  readonly street_id: string | null;
  readonly street_name: string | null;
  readonly house_number_id: string | null;
  readonly house_number_label: string | null;
};

export type ReminderFractionRow = {
  readonly fraction_id: string;
  readonly fraction_label: string;
  readonly fraction_color: string | null;
  readonly reminder_config: unknown;
};

type PersistedReminderSlot = {
  readonly id?: unknown;
  readonly maxLeadDays?: unknown;
  readonly defaultLeadDays?: unknown;
  readonly max_lead_days?: unknown;
  readonly default_lead_days?: unknown;
};

type PersistedReminderConfig = {
  readonly channels?: unknown;
  readonly email?: unknown;
  readonly calendar?: unknown;
};

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const quoteIdentifier = (value: string): string => {
  if (!schemaIdentifierPattern.test(value)) {
    throw new Error(`invalid_waste_schema:${value}`);
  }
  return `"${value}"`;
};

export const mapOptions = (rows: readonly SelectionRow[]): readonly PublicWasteSelectableEntry[] =>
  rows.map((row) => ({
    id: row.id,
    label: row.label,
  }));

const PUBLIC_WASTE_ALL_STREETS_LABEL = 'Alle Straßen';
const PUBLIC_WASTE_ALL_HOUSE_NUMBERS_LABEL = 'Alle Hausnummern';

const requirePublicLocationLabel = (value: string | null, field: string): string => {
  if (!value) {
    throw new Error(`invalid_public_waste_location:${field}`);
  }
  return value;
};

export const mapPublicLocation = (row: PublicLocationRow): PublicWasteLocationCatalogEntry => {
  const selection: PublicWasteResolvedSelection = {
    ...(row.region_id ? { regionId: row.region_id } : {}),
    cityId: row.city_id,
    streetId: row.street_id ?? PUBLIC_WASTE_CATCH_ALL_STREET_ID,
    ...(row.house_number_id ? { houseNumberId: row.house_number_id } : {}),
  };
  const base = {
    id: buildPublicWasteLocationKey(selection),
    district: { id: row.city_id, name: row.city_name },
    streetOrCollectionDistrict: row.street_id
      ? {
          id: row.street_id,
          name: requirePublicLocationLabel(row.street_name, 'street_name'),
        }
      : {
          id: PUBLIC_WASTE_CATCH_ALL_STREET_ID,
          name: PUBLIC_WASTE_ALL_STREETS_LABEL,
        },
    houseNumber: row.house_number_id
      ? {
          id: row.house_number_id,
          label: requirePublicLocationLabel(row.house_number_label, 'house_number_label'),
        }
      : {
          id: PUBLIC_WASTE_CATCH_ALL_HOUSE_NUMBER_ID,
          label: PUBLIC_WASTE_ALL_HOUSE_NUMBERS_LABEL,
        },
    calendarQuery: selection,
  };

  return row.region_id
    ? {
        ...base,
        municipality: {
          id: row.region_id,
          name: requirePublicLocationLabel(row.region_name, 'region_name'),
        },
        mappingComplete: true,
        missingFields: [],
      }
    : {
        ...base,
        municipality: null,
        mappingComplete: false,
        missingFields: ['municipality'],
      };
};

export const comparePublicLocations = (
  left: PublicWasteLocationCatalogEntry,
  right: PublicWasteLocationCatalogEntry
): number =>
  (left.municipality?.name ?? left.district.name).localeCompare(
    right.municipality?.name ?? right.district.name,
    'de'
  ) ||
  left.district.name.localeCompare(right.district.name, 'de') ||
  left.streetOrCollectionDistrict.name.localeCompare(right.streetOrCollectionDistrict.name, 'de') ||
  left.houseNumber.label.localeCompare(right.houseNumber.label, 'de') ||
  left.id.localeCompare(right.id);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeReminderSlot = (value: unknown): PublicWasteReminderFractionSlotOption | null => {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value as PersistedReminderSlot;
  const maxLeadDays =
    typeof candidate.maxLeadDays === 'number'
      ? candidate.maxLeadDays
      : typeof candidate.max_lead_days === 'number'
        ? candidate.max_lead_days
        : null;
  const defaultLeadDays =
    typeof candidate.defaultLeadDays === 'number'
      ? candidate.defaultLeadDays
      : typeof candidate.default_lead_days === 'number'
        ? candidate.default_lead_days
        : null;

  if (
    typeof candidate.id !== 'string' ||
    typeof maxLeadDays !== 'number' ||
    typeof defaultLeadDays !== 'number' ||
    !Number.isInteger(maxLeadDays) ||
    !Number.isInteger(defaultLeadDays) ||
    maxLeadDays < 1 ||
    defaultLeadDays < 1
  ) {
    return null;
  }

  return {
    id: candidate.id,
    maxLeadDays,
    defaultLeadDays,
  };
};

export const normalizeReminderFraction = (
  row: ReminderFractionRow,
  channel: PublicWasteReminderChannel
): PublicWasteReminderFractionOption | null => {
  if (!isRecord(row.reminder_config)) {
    return null;
  }

  const config = row.reminder_config as PersistedReminderConfig;
  const channels = isRecord(config.channels) ? config.channels : null;
  if (!channels || channels[channel] !== true) {
    return null;
  }

  const channelConfig = isRecord(config[channel]) ? config[channel] : null;
  if (!channelConfig || !Array.isArray(channelConfig.slots)) {
    return null;
  }

  const slots = channelConfig.slots
    .map(normalizeReminderSlot)
    .filter((slot): slot is PublicWasteReminderFractionSlotOption => slot !== null);
  if (slots.length === 0) {
    return null;
  }

  return {
    id: row.fraction_id,
    label: row.fraction_label,
    ...(row.fraction_color ? { color: row.fraction_color } : {}),
    slots,
  };
};
