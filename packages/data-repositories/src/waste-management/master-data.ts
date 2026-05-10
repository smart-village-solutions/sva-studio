import type {
  WasteCollectionLocationListFilter,
  WasteCollectionLocationRecord,
  WasteCustomTourDate,
  WasteCityListFilter,
  WasteDateShiftReasonType,
  WasteCityRecord,
  WasteFractionListFilter,
  WasteFractionRecord,
  WasteGlobalDateShiftListFilter,
  WasteGlobalDateShiftRecord,
  WasteHouseNumberListFilter,
  WasteHouseNumberRecord,
  WasteLocalizedTextRecord,
  WasteLocationTourLinkListFilter,
  WasteLocationTourLinkRecord,
  WasteRegionListFilter,
  WasteRegionRecord,
  WasteStreetListFilter,
  WasteStreetRecord,
  WasteTourDateShiftFollowUpMode,
  WasteTourDateShiftListFilter,
  WasteTourDateShiftRecord,
  WasteTourListFilter,
  WasteTourRecord,
} from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';

type WasteFractionRow = {
  readonly id: string;
  readonly name: string;
  readonly label_translations: unknown;
  readonly container_size: string | null;
  readonly color: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

type WasteRegionRow = {
  readonly id: string;
  readonly name: string;
  readonly created_at: string;
  readonly updated_at: string;
};

type WasteCityRow = {
  readonly id: string;
  readonly name: string;
  readonly region_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

type WasteStreetRow = {
  readonly id: string;
  readonly name: string;
  readonly city_id: string;
  readonly created_at: string;
  readonly updated_at: string;
};

type WasteHouseNumberRow = {
  readonly id: string;
  readonly number: string;
  readonly street_id: string;
  readonly created_at: string;
  readonly updated_at: string;
};

type WasteCollectionLocationRow = {
  readonly id: string;
  readonly city_id: string;
  readonly region_id: string | null;
  readonly street_id: string | null;
  readonly house_number_id: string | null;
  readonly active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

type WasteTourRow = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly waste_fraction_ids: readonly string[] | null;
  readonly recurrence: WasteTourRecord['recurrence'];
  readonly first_date: string | null;
  readonly end_date: string | null;
  readonly custom_dates: unknown;
  readonly active: boolean;
  readonly location_count?: number | null;
  readonly created_at: string;
  readonly updated_at: string;
};

type WasteLocationTourLinkRow = {
  readonly id: string;
  readonly location_id: string;
  readonly tour_id: string;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

type WasteTourDateShiftRow = {
  readonly id: string;
  readonly tour_id: string;
  readonly original_date: string;
  readonly actual_date: string;
  readonly has_year: boolean;
  readonly reason_type: WasteDateShiftReasonType | null;
  readonly reason_key: string | null;
  readonly follow_up_mode: WasteTourDateShiftFollowUpMode | null;
  readonly description: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

type WasteGlobalDateShiftRow = {
  readonly id: string;
  readonly original_date: string;
  readonly actual_date: string;
  readonly has_year: boolean;
  readonly reason_type: WasteDateShiftReasonType | null;
  readonly reason_key: string | null;
  readonly description: string | null;
  readonly tour_ids: readonly string[] | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type WasteMasterDataRepository = {
  listWasteFractions(filter?: WasteFractionListFilter): Promise<readonly WasteFractionRecord[]>;
  getWasteFractionById(id: string): Promise<WasteFractionRecord | null>;
  upsertWasteFraction(input: Omit<WasteFractionRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  listWasteRegions(filter?: WasteRegionListFilter): Promise<readonly WasteRegionRecord[]>;
  getWasteRegionById(id: string): Promise<WasteRegionRecord | null>;
  upsertWasteRegion(input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  listWasteCities(filter?: WasteCityListFilter): Promise<readonly WasteCityRecord[]>;
  getWasteCityById(id: string): Promise<WasteCityRecord | null>;
  upsertWasteCity(input: Omit<WasteCityRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  listWasteStreets(filter?: WasteStreetListFilter): Promise<readonly WasteStreetRecord[]>;
  getWasteStreetById(id: string): Promise<WasteStreetRecord | null>;
  upsertWasteStreet(input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  listWasteHouseNumbers(filter?: WasteHouseNumberListFilter): Promise<readonly WasteHouseNumberRecord[]>;
  getWasteHouseNumberById(id: string): Promise<WasteHouseNumberRecord | null>;
  upsertWasteHouseNumber(input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  listWasteCollectionLocations(
    filter?: WasteCollectionLocationListFilter
  ): Promise<readonly WasteCollectionLocationRecord[]>;
  getWasteCollectionLocationById(id: string): Promise<WasteCollectionLocationRecord | null>;
  upsertWasteCollectionLocation(
    input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>
  ): Promise<void>;
  listWasteTours(filter?: WasteTourListFilter): Promise<readonly WasteTourRecord[]>;
  getWasteTourById(id: string): Promise<WasteTourRecord | null>;
  upsertWasteTour(input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  listWasteLocationTourLinks(
    filter?: WasteLocationTourLinkListFilter
  ): Promise<readonly WasteLocationTourLinkRecord[]>;
  getWasteLocationTourLinkById(id: string): Promise<WasteLocationTourLinkRecord | null>;
  upsertWasteLocationTourLink(
    input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>
  ): Promise<void>;
  listWasteTourDateShifts(
    filter?: WasteTourDateShiftListFilter
  ): Promise<readonly WasteTourDateShiftRecord[]>;
  getWasteTourDateShiftById(id: string): Promise<WasteTourDateShiftRecord | null>;
  upsertWasteTourDateShift(
    input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>
  ): Promise<void>;
  listWasteGlobalDateShifts(
    filter?: WasteGlobalDateShiftListFilter
  ): Promise<readonly WasteGlobalDateShiftRecord[]>;
  getWasteGlobalDateShiftById(id: string): Promise<WasteGlobalDateShiftRecord | null>;
  upsertWasteGlobalDateShift(
    input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>
  ): Promise<void>;
};

const mapWasteFractionRow = (row: WasteFractionRow): WasteFractionRecord => ({
  id: row.id,
  name: row.name,
  translations: normalizeLocalizedTextRecord(row.label_translations),
  containerSize: row.container_size ?? undefined,
  color: row.color,
  description: row.description ?? undefined,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWasteRegionRow = (row: WasteRegionRow): WasteRegionRecord => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWasteCityRow = (row: WasteCityRow): WasteCityRecord => ({
  id: row.id,
  name: row.name,
  regionId: row.region_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWasteStreetRow = (row: WasteStreetRow): WasteStreetRecord => ({
  id: row.id,
  name: row.name,
  cityId: row.city_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWasteHouseNumberRow = (row: WasteHouseNumberRow): WasteHouseNumberRecord => ({
  id: row.id,
  number: row.number,
  streetId: row.street_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWasteCollectionLocationRow = (row: WasteCollectionLocationRow): WasteCollectionLocationRecord => ({
  id: row.id,
  cityId: row.city_id,
  regionId: row.region_id ?? undefined,
  streetId: row.street_id ?? undefined,
  houseNumberId: row.house_number_id ?? undefined,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeStringArray = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
};

const normalizeLocalizedTextRecord = (value: unknown): WasteLocalizedTextRecord | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value).flatMap(([locale, localizedValue]) => {
    if (!locale.trim() || typeof localizedValue !== 'string' || !localizedValue.trim()) {
      return [];
    }

    return [[locale, localizedValue] as const];
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.freeze(Object.fromEntries(entries));
};

const normalizeCustomDates = (value: unknown): readonly WasteCustomTourDate[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || !('date' in entry) || typeof entry.date !== 'string') {
      return [];
    }

    const description =
      'description' in entry && typeof entry.description === 'string' ? entry.description : undefined;

    return [{ date: entry.date, description }];
  });
};

const mapWasteTourRow = (row: WasteTourRow): WasteTourRecord => ({
  id: row.id,
  name: row.name,
  description: row.description ?? undefined,
  wasteFractionIds: normalizeStringArray(row.waste_fraction_ids),
  recurrence: row.recurrence ?? null,
  firstDate: row.first_date ?? undefined,
  endDate: row.end_date ?? undefined,
  customDates: normalizeCustomDates(row.custom_dates),
  active: row.active,
  locationCount: typeof row.location_count === 'number' ? row.location_count : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWasteLocationTourLinkRow = (row: WasteLocationTourLinkRow): WasteLocationTourLinkRecord => ({
  id: row.id,
  locationId: row.location_id,
  tourId: row.tour_id,
  startDate: row.start_date ?? undefined,
  endDate: row.end_date ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWasteTourDateShiftRow = (row: WasteTourDateShiftRow): WasteTourDateShiftRecord => ({
  id: row.id,
  tourId: row.tour_id,
  originalDate: row.original_date,
  actualDate: row.actual_date,
  hasYear: row.has_year,
  reasonType: row.reason_type ?? undefined,
  reasonKey: row.reason_key ?? undefined,
  followUpMode: row.follow_up_mode ?? undefined,
  description: row.description ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWasteGlobalDateShiftRow = (row: WasteGlobalDateShiftRow): WasteGlobalDateShiftRecord => ({
  id: row.id,
  originalDate: row.original_date,
  actualDate: row.actual_date,
  hasYear: row.has_year,
  reasonType: row.reason_type ?? undefined,
  reasonKey: row.reason_key ?? undefined,
  description: row.description ?? undefined,
  tourIds: row.tour_ids ? normalizeStringArray(row.tour_ids) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildLikePattern = (value: string): string => `%${value.trim()}%`;

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
  label_translations,
  container_size,
  color,
  description,
  active,
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
  label_translations,
  container_size,
  color,
  description,
  active,
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
): SqlStatement => ({
  text: `
INSERT INTO waste_fractions (
  id,
  name,
  label_translations,
  container_size,
  color,
  description,
  active
)
VALUES ($1::uuid, $2, $3::jsonb, $4, $5, $6, $7)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    label_translations = EXCLUDED.label_translations,
    container_size = EXCLUDED.container_size,
    color = EXCLUDED.color,
    description = EXCLUDED.description,
    active = EXCLUDED.active,
    updated_at = NOW();
`,
  values: [
    input.id,
    input.name,
    input.translations ? JSON.stringify(input.translations) : null,
    input.containerSize ?? null,
    input.color,
    input.description ?? null,
    input.active,
  ],
});

const buildRegionListStatement = (filter: WasteRegionListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.search?.trim()) {
    values.push(buildLikePattern(filter.search));
    conditions.push(`name ILIKE $${values.length}`);
  }

  return {
    text: `
SELECT
  id::text,
  name,
  created_at::text,
  updated_at::text
FROM waste_regions
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY name ASC;
`,
    values,
  };
};

const buildRegionSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  name,
  created_at::text,
  updated_at::text
FROM waste_regions
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildRegionUpsertStatement = (input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>): SqlStatement => ({
  text: `
INSERT INTO waste_regions (
  id,
  name
)
VALUES ($1::uuid, $2)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = NOW();
`,
  values: [input.id, input.name],
});

const buildCityListStatement = (filter: WasteCityListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.regionId?.trim()) {
    values.push(filter.regionId);
    conditions.push(`region_id = $${values.length}::uuid`);
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
  region_id::text,
  created_at::text,
  updated_at::text
FROM waste_cities
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY name ASC;
`,
    values,
  };
};

const buildCitySelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  name,
  region_id::text,
  created_at::text,
  updated_at::text
FROM waste_cities
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildCityUpsertStatement = (input: Omit<WasteCityRecord, 'createdAt' | 'updatedAt'>): SqlStatement => ({
  text: `
INSERT INTO waste_cities (
  id,
  name,
  region_id
)
VALUES ($1::uuid, $2, $3::uuid)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    region_id = EXCLUDED.region_id,
    updated_at = NOW();
`,
  values: [input.id, input.name, input.regionId ?? null],
});

const buildStreetListStatement = (filter: WasteStreetListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.cityId?.trim()) {
    values.push(filter.cityId);
    conditions.push(`city_id = $${values.length}::uuid`);
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
  city_id::text,
  created_at::text,
  updated_at::text
FROM waste_streets
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY name ASC;
`,
    values,
  };
};

const buildStreetSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  name,
  city_id::text,
  created_at::text,
  updated_at::text
FROM waste_streets
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildStreetUpsertStatement = (input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>): SqlStatement => ({
  text: `
INSERT INTO waste_streets (
  id,
  name,
  city_id
)
VALUES ($1::uuid, $2, $3::uuid)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    city_id = EXCLUDED.city_id,
    updated_at = NOW();
`,
  values: [input.id, input.name, input.cityId],
});

const buildHouseNumberListStatement = (filter: WasteHouseNumberListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.streetId?.trim()) {
    values.push(filter.streetId);
    conditions.push(`street_id = $${values.length}::uuid`);
  }

  if (filter.search?.trim()) {
    values.push(buildLikePattern(filter.search));
    conditions.push(`number ILIKE $${values.length}`);
  }

  return {
    text: `
SELECT
  id::text,
  number,
  street_id::text,
  created_at::text,
  updated_at::text
FROM waste_house_numbers
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY number ASC;
`,
    values,
  };
};

const buildHouseNumberSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  number,
  street_id::text,
  created_at::text,
  updated_at::text
FROM waste_house_numbers
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildHouseNumberUpsertStatement = (
  input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_house_numbers (
  id,
  number,
  street_id
)
VALUES ($1::uuid, $2, $3::uuid)
ON CONFLICT (id) DO UPDATE
SET number = EXCLUDED.number,
    street_id = EXCLUDED.street_id,
    updated_at = NOW();
`,
  values: [input.id, input.number, input.streetId],
});

const buildCollectionLocationListStatement = (filter: WasteCollectionLocationListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.cityId?.trim()) {
    values.push(filter.cityId);
    conditions.push(`city_id = $${values.length}::uuid`);
  }

  if (filter.regionId?.trim()) {
    values.push(filter.regionId);
    conditions.push(`region_id = $${values.length}::uuid`);
  }

  if (filter.streetId?.trim()) {
    values.push(filter.streetId);
    conditions.push(`street_id = $${values.length}::uuid`);
  }

  if (filter.houseNumberId?.trim()) {
    values.push(filter.houseNumberId);
    conditions.push(`house_number_id = $${values.length}::uuid`);
  }

  if (typeof filter.active === 'boolean') {
    values.push(filter.active);
    conditions.push(`active = $${values.length}`);
  }

  return {
    text: `
SELECT
  id::text,
  city_id::text,
  region_id::text,
  street_id::text,
  house_number_id::text,
  active,
  created_at::text,
  updated_at::text
FROM waste_collection_locations
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY created_at ASC, id ASC;
`,
    values,
  };
};

const buildCollectionLocationSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  city_id::text,
  region_id::text,
  street_id::text,
  house_number_id::text,
  active,
  created_at::text,
  updated_at::text
FROM waste_collection_locations
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildCollectionLocationUpsertStatement = (
  input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_collection_locations (
  id,
  city_id,
  region_id,
  street_id,
  house_number_id,
  active
)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6)
ON CONFLICT (id) DO UPDATE
SET city_id = EXCLUDED.city_id,
    region_id = EXCLUDED.region_id,
    street_id = EXCLUDED.street_id,
    house_number_id = EXCLUDED.house_number_id,
    active = EXCLUDED.active,
    updated_at = NOW();
`,
  values: [
    input.id,
    input.cityId,
    input.regionId ?? null,
    input.streetId ?? null,
    input.houseNumberId ?? null,
    input.active,
  ],
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
  t.first_date::text,
  t.end_date::text,
  t.custom_dates,
  t.active,
  COUNT(ltl.id)::int AS location_count,
  t.created_at::text,
  t.updated_at::text
FROM waste_tours t
LEFT JOIN waste_location_tour_links ltl
  ON ltl.tour_id = t.id
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
GROUP BY t.id
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
  t.first_date::text,
  t.end_date::text,
  t.custom_dates,
  t.active,
  COUNT(ltl.id)::int AS location_count,
  t.created_at::text,
  t.updated_at::text
FROM waste_tours t
LEFT JOIN waste_location_tour_links ltl
  ON ltl.tour_id = t.id
WHERE t.id = $1::uuid
GROUP BY t.id
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
  first_date,
  end_date,
  custom_dates,
  active
)
VALUES ($1::uuid, $2, $3, $4::text[], $5, $6::date, $7::date, $8::jsonb, $9)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    waste_fraction_ids = EXCLUDED.waste_fraction_ids,
    recurrence = EXCLUDED.recurrence,
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
    input.firstDate ?? null,
    input.endDate ?? null,
    input.customDates ? JSON.stringify(input.customDates) : null,
    input.active,
  ],
});

const buildLocationTourLinkListStatement = (filter: WasteLocationTourLinkListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.locationId?.trim()) {
    values.push(filter.locationId);
    conditions.push(`location_id = $${values.length}::uuid`);
  }

  if (filter.tourId?.trim()) {
    values.push(filter.tourId);
    conditions.push(`tour_id = $${values.length}::uuid`);
  }

  return {
    text: `
SELECT
  id::text,
  location_id::text,
  tour_id::text,
  start_date::text,
  end_date::text,
  created_at::text,
  updated_at::text
FROM waste_location_tour_links
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY created_at ASC, id ASC;
`,
    values,
  };
};

const buildLocationTourLinkSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  location_id::text,
  tour_id::text,
  start_date::text,
  end_date::text,
  created_at::text,
  updated_at::text
FROM waste_location_tour_links
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildLocationTourLinkUpsertStatement = (
  input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_location_tour_links (
  id,
  location_id,
  tour_id,
  start_date,
  end_date
)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, $5::date)
ON CONFLICT (id) DO UPDATE
SET location_id = EXCLUDED.location_id,
    tour_id = EXCLUDED.tour_id,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    updated_at = NOW();
`,
  values: [input.id, input.locationId, input.tourId, input.startDate ?? null, input.endDate ?? null],
});

const buildTourDateShiftListStatement = (filter: WasteTourDateShiftListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (filter.tourId?.trim()) {
    values.push(filter.tourId);
    conditions.push(`tour_id = $${values.length}::uuid`);
  }

  if (typeof filter.hasYear === 'boolean') {
    values.push(filter.hasYear);
    conditions.push(`has_year = $${values.length}`);
  }

  return {
    text: `
SELECT
  id::text,
  tour_id::text,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  follow_up_mode,
  description,
  created_at::text,
  updated_at::text
FROM waste_tour_date_shifts
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY original_date ASC, id ASC;
`,
    values,
  };
};

const buildTourDateShiftSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  tour_id::text,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  follow_up_mode,
  description,
  created_at::text,
  updated_at::text
FROM waste_tour_date_shifts
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildTourDateShiftUpsertStatement = (
  input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_tour_date_shifts (
  id,
  tour_id,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  follow_up_mode,
  description
)
VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (id) DO UPDATE
SET tour_id = EXCLUDED.tour_id,
    original_date = EXCLUDED.original_date,
    actual_date = EXCLUDED.actual_date,
    has_year = EXCLUDED.has_year,
    reason_type = EXCLUDED.reason_type,
    reason_key = EXCLUDED.reason_key,
    follow_up_mode = EXCLUDED.follow_up_mode,
    description = EXCLUDED.description,
    updated_at = NOW();
`,
  values: [
    input.id,
    input.tourId,
    input.originalDate,
    input.actualDate,
    input.hasYear,
    input.reasonType ?? null,
    input.reasonKey ?? null,
    input.followUpMode ?? null,
    input.description ?? null,
  ],
});

const buildGlobalDateShiftListStatement = (filter: WasteGlobalDateShiftListFilter = {}): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (typeof filter.hasYear === 'boolean') {
    values.push(filter.hasYear);
    conditions.push(`has_year = $${values.length}`);
  }

  if (filter.appliesToTourId?.trim()) {
    values.push(filter.appliesToTourId);
    conditions.push(`(tour_ids IS NULL OR $${values.length} = ANY(tour_ids))`);
  }

  return {
    text: `
SELECT
  id::text,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  description,
  tour_ids,
  created_at::text,
  updated_at::text
FROM waste_global_date_shifts
${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
ORDER BY original_date ASC, id ASC;
`,
    values,
  };
};

const buildGlobalDateShiftSelectStatement = (id: string): SqlStatement => ({
  text: `
SELECT
  id::text,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  description,
  tour_ids,
  created_at::text,
  updated_at::text
FROM waste_global_date_shifts
WHERE id = $1::uuid
LIMIT 1;
`,
  values: [id],
});

const buildGlobalDateShiftUpsertStatement = (
  input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
INSERT INTO waste_global_date_shifts (
  id,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  description,
  tour_ids
)
VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::text[])
ON CONFLICT (id) DO UPDATE
SET original_date = EXCLUDED.original_date,
    actual_date = EXCLUDED.actual_date,
    has_year = EXCLUDED.has_year,
    reason_type = EXCLUDED.reason_type,
    reason_key = EXCLUDED.reason_key,
    description = EXCLUDED.description,
    tour_ids = EXCLUDED.tour_ids,
    updated_at = NOW();
`,
  values: [
    input.id,
    input.originalDate,
    input.actualDate,
    input.hasYear,
    input.reasonType ?? null,
    input.reasonKey ?? null,
    input.description ?? null,
    input.tourIds ?? null,
  ],
});

export const createWasteMasterDataRepository = (executor: SqlExecutor): WasteMasterDataRepository => ({
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
  async listWasteRegions(filter) {
    const result = await executor.execute<WasteRegionRow>(buildRegionListStatement(filter));
    return result.rows.map(mapWasteRegionRow);
  },
  async getWasteRegionById(id) {
    const result = await executor.execute<WasteRegionRow>(buildRegionSelectStatement(id));
    return result.rows[0] ? mapWasteRegionRow(result.rows[0]) : null;
  },
  async upsertWasteRegion(input) {
    await executor.execute(buildRegionUpsertStatement(input));
  },
  async listWasteCities(filter) {
    const result = await executor.execute<WasteCityRow>(buildCityListStatement(filter));
    return result.rows.map(mapWasteCityRow);
  },
  async getWasteCityById(id) {
    const result = await executor.execute<WasteCityRow>(buildCitySelectStatement(id));
    return result.rows[0] ? mapWasteCityRow(result.rows[0]) : null;
  },
  async upsertWasteCity(input) {
    await executor.execute(buildCityUpsertStatement(input));
  },
  async listWasteStreets(filter) {
    const result = await executor.execute<WasteStreetRow>(buildStreetListStatement(filter));
    return result.rows.map(mapWasteStreetRow);
  },
  async getWasteStreetById(id) {
    const result = await executor.execute<WasteStreetRow>(buildStreetSelectStatement(id));
    return result.rows[0] ? mapWasteStreetRow(result.rows[0]) : null;
  },
  async upsertWasteStreet(input) {
    await executor.execute(buildStreetUpsertStatement(input));
  },
  async listWasteHouseNumbers(filter) {
    const result = await executor.execute<WasteHouseNumberRow>(buildHouseNumberListStatement(filter));
    return result.rows.map(mapWasteHouseNumberRow);
  },
  async getWasteHouseNumberById(id) {
    const result = await executor.execute<WasteHouseNumberRow>(buildHouseNumberSelectStatement(id));
    return result.rows[0] ? mapWasteHouseNumberRow(result.rows[0]) : null;
  },
  async upsertWasteHouseNumber(input) {
    await executor.execute(buildHouseNumberUpsertStatement(input));
  },
  async listWasteCollectionLocations(filter) {
    const result = await executor.execute<WasteCollectionLocationRow>(
      buildCollectionLocationListStatement(filter)
    );
    return result.rows.map(mapWasteCollectionLocationRow);
  },
  async getWasteCollectionLocationById(id) {
    const result = await executor.execute<WasteCollectionLocationRow>(
      buildCollectionLocationSelectStatement(id)
    );
    return result.rows[0] ? mapWasteCollectionLocationRow(result.rows[0]) : null;
  },
  async upsertWasteCollectionLocation(input) {
    await executor.execute(buildCollectionLocationUpsertStatement(input));
  },
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
  async listWasteLocationTourLinks(filter) {
    const result = await executor.execute<WasteLocationTourLinkRow>(buildLocationTourLinkListStatement(filter));
    return result.rows.map(mapWasteLocationTourLinkRow);
  },
  async getWasteLocationTourLinkById(id) {
    const result = await executor.execute<WasteLocationTourLinkRow>(buildLocationTourLinkSelectStatement(id));
    return result.rows[0] ? mapWasteLocationTourLinkRow(result.rows[0]) : null;
  },
  async upsertWasteLocationTourLink(input) {
    await executor.execute(buildLocationTourLinkUpsertStatement(input));
  },
  async listWasteTourDateShifts(filter) {
    const result = await executor.execute<WasteTourDateShiftRow>(buildTourDateShiftListStatement(filter));
    return result.rows.map(mapWasteTourDateShiftRow);
  },
  async getWasteTourDateShiftById(id) {
    const result = await executor.execute<WasteTourDateShiftRow>(buildTourDateShiftSelectStatement(id));
    return result.rows[0] ? mapWasteTourDateShiftRow(result.rows[0]) : null;
  },
  async upsertWasteTourDateShift(input) {
    await executor.execute(buildTourDateShiftUpsertStatement(input));
  },
  async listWasteGlobalDateShifts(filter) {
    const result = await executor.execute<WasteGlobalDateShiftRow>(buildGlobalDateShiftListStatement(filter));
    return result.rows.map(mapWasteGlobalDateShiftRow);
  },
  async getWasteGlobalDateShiftById(id) {
    const result = await executor.execute<WasteGlobalDateShiftRow>(buildGlobalDateShiftSelectStatement(id));
    return result.rows[0] ? mapWasteGlobalDateShiftRow(result.rows[0]) : null;
  },
  async upsertWasteGlobalDateShift(input) {
    await executor.execute(buildGlobalDateShiftUpsertStatement(input));
  },
});

export const wasteMasterDataStatements = {
  listWasteFractions: buildFractionListStatement,
  getWasteFractionById: buildFractionSelectStatement,
  upsertWasteFraction: buildFractionUpsertStatement,
  listWasteRegions: buildRegionListStatement,
  getWasteRegionById: buildRegionSelectStatement,
  upsertWasteRegion: buildRegionUpsertStatement,
  listWasteCities: buildCityListStatement,
  getWasteCityById: buildCitySelectStatement,
  upsertWasteCity: buildCityUpsertStatement,
  listWasteStreets: buildStreetListStatement,
  getWasteStreetById: buildStreetSelectStatement,
  upsertWasteStreet: buildStreetUpsertStatement,
  listWasteHouseNumbers: buildHouseNumberListStatement,
  getWasteHouseNumberById: buildHouseNumberSelectStatement,
  upsertWasteHouseNumber: buildHouseNumberUpsertStatement,
  listWasteCollectionLocations: buildCollectionLocationListStatement,
  getWasteCollectionLocationById: buildCollectionLocationSelectStatement,
  upsertWasteCollectionLocation: buildCollectionLocationUpsertStatement,
  listWasteTours: buildTourListStatement,
  getWasteTourById: buildTourSelectStatement,
  upsertWasteTour: buildTourUpsertStatement,
  listWasteLocationTourLinks: buildLocationTourLinkListStatement,
  getWasteLocationTourLinkById: buildLocationTourLinkSelectStatement,
  upsertWasteLocationTourLink: buildLocationTourLinkUpsertStatement,
  listWasteTourDateShifts: buildTourDateShiftListStatement,
  getWasteTourDateShiftById: buildTourDateShiftSelectStatement,
  upsertWasteTourDateShift: buildTourDateShiftUpsertStatement,
  listWasteGlobalDateShifts: buildGlobalDateShiftListStatement,
  getWasteGlobalDateShiftById: buildGlobalDateShiftSelectStatement,
  upsertWasteGlobalDateShift: buildGlobalDateShiftUpsertStatement,
} as const;
