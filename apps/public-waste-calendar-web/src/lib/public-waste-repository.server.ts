import {
  loadPublicWasteCalendarEntries,
  type SqlExecutor,
} from './public-waste-calendar-loader.server.js';
import type {
  PublicWasteCalendarEntry,
  PublicWasteLocationCatalogEntry,
  PublicWasteReminderChannel,
  PublicWasteReminderFractionOption,
  PublicWasteReminderFractionSlotOption,
  PublicWasteResolvedSelection,
  PublicWasteSelectableEntry,
  PublicWasteSelectionState,
  PublicWasteSelectionStep,
} from './public-waste-contract.js';
import {
  buildPublicWasteLocationKey,
  PUBLIC_WASTE_CATCH_ALL_HOUSE_NUMBER_ID,
  PUBLIC_WASTE_CATCH_ALL_STREET_ID,
} from './public-waste-contract.js';
import {
  createStreetSelectionFilter,
  isCatchAllStreetSelection,
} from './public-waste-repository-selection.server.js';

type SelectionRow = {
  readonly id: string;
  readonly label: string;
  readonly is_catch_all?: boolean;
  readonly sort_priority?: number;
};

type PublicLocationRow = {
  readonly region_id: string | null;
  readonly region_name: string | null;
  readonly city_id: string;
  readonly city_name: string;
  readonly street_id: string | null;
  readonly street_name: string | null;
  readonly house_number_id: string | null;
  readonly house_number_label: string | null;
};

type ReminderFractionRow = {
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

export type PublicWasteRepository = ReturnType<typeof createPublicWasteRepository>;

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const quoteIdentifier = (value: string): string => {
  if (!schemaIdentifierPattern.test(value)) {
    throw new Error(`invalid_waste_schema:${value}`);
  }
  return `"${value}"`;
};

const mapOptions = (rows: readonly SelectionRow[]): readonly PublicWasteSelectableEntry[] =>
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

const mapPublicLocation = (row: PublicLocationRow): PublicWasteLocationCatalogEntry => {
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

const comparePublicLocations = (
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

const normalizeReminderFraction = (
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

export const createPublicWasteRepository = (input: {
  readonly schemaName: string;
  readonly execute: SqlExecutor;
}) => {
  const schemaName = quoteIdentifier(input.schemaName);

  return {
    async listPublicRegions(): Promise<readonly PublicWasteSelectableEntry[]> {
      const result = await input.execute<SelectionRow>({
        text: `
          SELECT DISTINCT r.id, r.name AS label
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
          INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
          INNER JOIN ${schemaName}.waste_regions r ON r.id = cl.region_id
          WHERE cl.active = true
            AND t.active = true
          ORDER BY label ASC;
        `,
      });
      return mapOptions(result.rows);
    },

    async listPublicLocations(): Promise<readonly PublicWasteLocationCatalogEntry[]> {
      const result = await input.execute<PublicLocationRow>({
        text: `
          SELECT
            cl.region_id::text AS region_id,
            r.name AS region_name,
            cl.city_id::text AS city_id,
            c.name AS city_name,
            cl.street_id::text AS street_id,
            s.name AS street_name,
            cl.house_number_id::text AS house_number_id,
            hn.number AS house_number_label
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_cities c ON c.id = cl.city_id
          LEFT JOIN ${schemaName}.waste_regions r ON r.id = cl.region_id
          LEFT JOIN ${schemaName}.waste_streets s ON s.id = cl.street_id
          LEFT JOIN ${schemaName}.waste_house_numbers hn ON hn.id = cl.house_number_id
          WHERE cl.active = true
            AND EXISTS (
              SELECT 1
              FROM ${schemaName}.waste_location_tour_links ltl
              INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
              WHERE ltl.location_id = cl.id
                AND t.active = true
            )
          ORDER BY
            r.name ASC NULLS FIRST,
            c.name ASC,
            s.name ASC NULLS FIRST,
            hn.number ASC NULLS FIRST,
            cl.region_id ASC NULLS FIRST,
            cl.city_id ASC,
            cl.street_id ASC NULLS FIRST,
            cl.house_number_id ASC NULLS FIRST;
        `,
      });
      const locationsByKey = new Map<string, PublicWasteLocationCatalogEntry>();
      for (const row of result.rows) {
        const location = mapPublicLocation(row);
        if (!locationsByKey.has(location.id)) {
          locationsByKey.set(location.id, location);
        }
      }
      return [...locationsByKey.values()].sort(comparePublicLocations);
    },

    async listSelectionOptions(query: { readonly selection: PublicWasteSelectionState }): Promise<{
      readonly step: Exclude<PublicWasteSelectionStep, 'complete'>;
      readonly options: readonly PublicWasteSelectableEntry[];
    }> {
      const regionsResult = await input.execute<SelectionRow>({
        text: `
          SELECT DISTINCT r.id, r.name AS label
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
          INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
          INNER JOIN ${schemaName}.waste_regions r ON r.id = cl.region_id
          WHERE cl.active = true
            AND t.active = true
          ORDER BY label ASC;
        `,
      });

      let effectiveRegionId = query.selection.regionId?.toLowerCase();
      if (
        effectiveRegionId &&
        !regionsResult.rows.some((region) => region.id.toLowerCase() === effectiveRegionId)
      ) {
        return { step: 'city', options: [] };
      }
      if (!effectiveRegionId && regionsResult.rows.length > 1) {
        return { step: 'region', options: mapOptions(regionsResult.rows) };
      }
      effectiveRegionId ??= regionsResult.rows[0]?.id;

      if (!query.selection.cityId) {
        const result = await input.execute<SelectionRow>({
          text: `
            SELECT DISTINCT c.id, c.name AS label
            FROM ${schemaName}.waste_collection_locations cl
            INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
            INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
            INNER JOIN ${schemaName}.waste_cities c ON c.id = cl.city_id
            WHERE cl.active = true
              AND t.active = true
              AND ($1::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $1::uuid)
            ORDER BY label ASC;
          `,
          values: [effectiveRegionId ?? null],
        });
        return { step: 'city', options: mapOptions(result.rows) };
      }

      if (!query.selection.streetId) {
        const result = await input.execute<SelectionRow>({
          text: `
            SELECT DISTINCT *
            FROM (
              SELECT
                s.id::text AS id,
                s.name AS label,
                false AS is_catch_all,
                1 AS sort_priority
              FROM ${schemaName}.waste_collection_locations cl
              INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
              INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
              INNER JOIN ${schemaName}.waste_streets s ON s.id = cl.street_id
              WHERE cl.active = true
                AND t.active = true
                AND cl.city_id = $1::uuid
                AND ($2::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $2::uuid)
              UNION
              SELECT
                '${PUBLIC_WASTE_CATCH_ALL_STREET_ID}' AS id,
                'Alle Straßen' AS label,
                true AS is_catch_all,
                0 AS sort_priority
              FROM ${schemaName}.waste_collection_locations cl
              INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
              INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
              WHERE cl.active = true
                AND t.active = true
                AND cl.city_id = $1::uuid
                AND cl.street_id IS NULL
                AND ($2::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $2::uuid)
            ) street_options
            ORDER BY
              sort_priority ASC,
              label ASC;
          `,
          values: [query.selection.cityId, effectiveRegionId ?? null],
        });
        return { step: 'street', options: mapOptions(result.rows) };
      }

      if (isCatchAllStreetSelection(query.selection.streetId)) {
        return { step: 'houseNumber', options: [] };
      }

      if (query.selection.houseNumberId) {
        return { step: 'houseNumber', options: [] };
      }

      const result = await input.execute<SelectionRow>({
        text: `
          SELECT DISTINCT hn.id, hn.number AS label
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
          INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
          INNER JOIN ${schemaName}.waste_house_numbers hn ON hn.id = cl.house_number_id
          WHERE cl.active = true
            AND t.active = true
            AND cl.city_id = $1::uuid
            AND cl.street_id = $2::uuid
            AND ($3::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $3::uuid)
          ORDER BY label ASC;
        `,
        values: [query.selection.cityId, query.selection.streetId, effectiveRegionId ?? null],
      });
      return { step: 'houseNumber', options: mapOptions(result.rows) };
    },

    async loadCalendarEntries(query: {
      readonly selection: PublicWasteResolvedSelection;
      readonly referenceDate: string;
    }): Promise<readonly PublicWasteCalendarEntry[]> {
      return loadPublicWasteCalendarEntries({
        schemaName,
        execute: input.execute,
        query,
      });
    },
    async loadSelectionSummary(query: {
      readonly selection: PublicWasteResolvedSelection;
    }): Promise<string> {
      const streetSelectionFilter = createStreetSelectionFilter(query.selection.streetId);
      const result = await input.execute<{
        readonly city_label: string;
        readonly street_label: string | null;
        readonly house_number_label: string | null;
      }>({
        text: `
          SELECT
            c.name AS city_label,
            COALESCE(s.name, 'Alle Straßen') AS street_label,
            hn.number AS house_number_label
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_cities c ON c.id = cl.city_id
          LEFT JOIN ${schemaName}.waste_streets s ON s.id = cl.street_id
          LEFT JOIN ${schemaName}.waste_house_numbers hn ON hn.id = cl.house_number_id
          WHERE cl.active = true
            AND cl.city_id = $1::uuid
            ${streetSelectionFilter.text}
            AND ($4::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $4::uuid)
            AND ($5::uuid IS NULL OR cl.house_number_id = $5::uuid)
          ORDER BY
            CASE WHEN cl.street_id = $3::uuid THEN 0 ELSE 1 END ASC,
            CASE WHEN $5::uuid IS NOT NULL AND cl.house_number_id = $5::uuid THEN 0 ELSE 1 END ASC
          LIMIT 1;
        `,
        values: [
          query.selection.cityId,
          ...streetSelectionFilter.values,
          query.selection.regionId ?? null,
          query.selection.houseNumberId ?? null,
        ],
      });

      const row = result.rows[0];
      if (!row) {
        return [
          query.selection.cityId,
          [
            isCatchAllStreetSelection(query.selection.streetId)
              ? 'Alle Straßen'
              : query.selection.streetId,
            query.selection.houseNumberId,
          ]
            .filter(Boolean)
            .join(' '),
        ]
          .filter(Boolean)
          .join(', ');
      }

      return [row.city_label, [row.street_label, row.house_number_label].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ');
    },

    async loadReminderOptions(query: {
      readonly selection: PublicWasteResolvedSelection;
      readonly channel: PublicWasteReminderChannel;
    }): Promise<readonly PublicWasteReminderFractionOption[]> {
      const streetSelectionFilter = createStreetSelectionFilter(query.selection.streetId);
      const result = await input.execute<ReminderFractionRow>({
        text: `
          SELECT DISTINCT
            f.id AS fraction_id,
            f.name AS fraction_label,
            f.color AS fraction_color,
            f.reminder_config
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
          INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
          INNER JOIN ${schemaName}.waste_fractions f ON f.id::text = ANY(t.waste_fraction_ids)
          WHERE cl.active = true
            AND t.active = true
            AND f.active = true
            AND cl.city_id = $1::uuid
            ${streetSelectionFilter.text}
            AND ($4::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $4::uuid)
            AND ($5::uuid IS NULL OR cl.house_number_id IS NULL OR cl.house_number_id = $5::uuid)
          ORDER BY f.name ASC;
        `,
        values: [
          query.selection.cityId,
          ...streetSelectionFilter.values,
          query.selection.regionId ?? null,
          query.selection.houseNumberId ?? null,
        ],
      });

      return result.rows
        .map((row) => normalizeReminderFraction(row, query.channel))
        .filter((fraction): fraction is PublicWasteReminderFractionOption => fraction !== null);
    },
  };
};
