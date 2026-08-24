import type {
  WasteCollectionLocationListItem,
  WasteCollectionLocationListFilter,
  WasteCollectionLocationPage,
  WasteCollectionLocationQuery,
  WasteCollectionLocationRecord,
  WasteCollectionLocationSelectionFilter,
} from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';

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

type WasteCollectionLocationPageRow = {
  readonly id: string | null;
  readonly city_id: string | null;
  readonly region_id: string | null;
  readonly street_id: string | null;
  readonly house_number_id: string | null;
  readonly active: boolean | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
  readonly region_name: string | null;
  readonly city_name: string | null;
  readonly city_sort_name: string | null;
  readonly street_name: string | null;
  readonly house_number: string | null;
  readonly tour_ids: readonly string[] | null;
  readonly tour_names: readonly string[] | null;
  readonly total_count: string | number;
};

type WasteCollectionLocationIdRow = {
  readonly id: string;
};

const mapWasteCollectionLocationRow = (
  row: WasteCollectionLocationRow
): WasteCollectionLocationRecord => ({
  id: row.id,
  cityId: row.city_id,
  regionId: row.region_id ?? undefined,
  streetId: row.street_id ?? undefined,
  houseNumberId: row.house_number_id ?? undefined,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWasteCollectionLocationPageRow = (
  row: WasteCollectionLocationPageRow
): WasteCollectionLocationListItem => {
  if (
    row.id === null ||
    row.city_id === null ||
    row.active === null ||
    row.created_at === null ||
    row.updated_at === null ||
    row.city_name === null
  ) {
    throw new Error('invalid_waste_collection_location_page_row');
  }
  const tourIds = row.tour_ids ?? [];
  const tourNames = row.tour_names ?? [];
  return {
    ...mapWasteCollectionLocationRow({
      id: row.id,
      city_id: row.city_id,
      region_id: row.region_id,
      street_id: row.street_id,
      house_number_id: row.house_number_id,
      active: row.active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }),
    regionName: row.region_name ?? undefined,
    cityName: row.city_name,
    streetName: row.street_name ?? undefined,
    houseNumber: row.house_number ?? undefined,
    tours: tourIds.map((id, index) => ({ id, name: tourNames[index] ?? '' })),
  };
};

const buildCollectionLocationFilter = (
  filter: WasteCollectionLocationSelectionFilter,
  values: SqlPrimitive[]
): string => {
  const conditions: string[] = [];
  const addValue = (value: SqlPrimitive): string => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filter.q?.trim()) {
    const parameter = addValue(filter.q.trim());
    conditions.push(`(
      city.name ILIKE '%' || ${parameter} || '%'
      OR region.name ILIKE '%' || ${parameter} || '%'
      OR street.name ILIKE '%' || ${parameter} || '%'
      OR house_number.number ILIKE '%' || ${parameter} || '%'
      OR EXISTS (
        SELECT 1
        FROM waste_location_tour_links AS search_link
        INNER JOIN waste_tours AS search_tour ON search_tour.id = search_link.tour_id
        WHERE search_link.location_id = location.id
          AND search_tour.name ILIKE '%' || ${parameter} || '%'
      )
    )`);
  }

  if (filter.status !== 'all') {
    conditions.push(`location.active = ${addValue(filter.status === 'active')}`);
  }
  if (filter.regionId?.trim()) {
    conditions.push(`location.region_id = ${addValue(filter.regionId.trim())}::uuid`);
  }
  if (filter.cityId?.trim()) {
    conditions.push(`location.city_id = ${addValue(filter.cityId.trim())}::uuid`);
  }
  if (filter.tourId?.trim()) {
    const parameter = addValue(filter.tourId.trim());
    conditions.push(`EXISTS (
      SELECT 1
      FROM waste_location_tour_links AS filter_link
      WHERE filter_link.location_id = location.id
        AND filter_link.tour_id = ${parameter}::uuid
    )`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join('\n  AND ')}` : '';
};

const collectionLocationProjection = `
  location.id::text,
  location.city_id::text,
  location.region_id::text,
  location.street_id::text,
  location.house_number_id::text,
  location.active,
  location.created_at::text,
  location.updated_at::text,
  NULLIF(BTRIM(region.name), '') AS region_name,
  city.name AS city_name,
  NULLIF(BTRIM(city.name), '') AS city_sort_name,
  NULLIF(BTRIM(street.name), '') AS street_name,
  NULLIF(BTRIM(house_number.number), '') AS house_number`;

const collectionLocationJoins = `
FROM waste_collection_locations AS location
INNER JOIN waste_cities AS city ON city.id = location.city_id
LEFT JOIN waste_regions AS region ON region.id = location.region_id
LEFT JOIN waste_streets AS street ON street.id = location.street_id
LEFT JOIN waste_house_numbers AS house_number ON house_number.id = location.house_number_id`;

const buildCollectionLocationOrder = (
  query: Pick<WasteCollectionLocationQuery, 'sortMode' | 'sortDirection'>,
  prefix = ''
): string => {
  const direction = query.sortDirection === 'desc' ? 'DESC' : 'ASC';
  const expression = (name: string) => `${prefix}${name}`;
  const criteria =
    query.sortMode === 'addressWithRegion'
      ? ['region_name', 'city_sort_name', 'street_name', 'house_number']
      : ['city_sort_name', 'street_name', 'house_number'];
  return [
    ...criteria.map(
      (name) => `${expression(name)} COLLATE public.sva_de_numeric ${direction} NULLS LAST`
    ),
    `${expression('id')} ASC`,
  ].join(',\n  ');
};

const buildCollectionLocationPageStatement = (
  query: WasteCollectionLocationQuery
): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const where = buildCollectionLocationFilter(query, values);
  values.push(query.pageSize, (query.page - 1) * query.pageSize);
  const limitParameter = `$${values.length - 1}`;
  const offsetParameter = `$${values.length}`;
  const order = buildCollectionLocationOrder(query);
  const pageOrder = buildCollectionLocationOrder(query, 'page.');

  return {
    text: `
WITH filtered AS (
  SELECT${collectionLocationProjection}
  ${collectionLocationJoins}
  ${where}
),
total AS (
  SELECT COUNT(*)::text AS total_count FROM filtered
),
page AS (
  SELECT *
  FROM filtered
  ORDER BY ${order}
  LIMIT ${limitParameter}
  OFFSET ${offsetParameter}
)
SELECT
  page.*,
  tours.tour_ids,
  tours.tour_names,
  total.total_count
FROM total
LEFT JOIN page ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COALESCE(ARRAY_AGG(tour.id::text ORDER BY tour.name COLLATE public.sva_de_numeric ASC, tour.id ASC), ARRAY[]::text[]) AS tour_ids,
    COALESCE(ARRAY_AGG(tour.name ORDER BY tour.name COLLATE public.sva_de_numeric ASC, tour.id ASC), ARRAY[]::text[]) AS tour_names
  FROM waste_location_tour_links AS link
  INNER JOIN waste_tours AS tour ON tour.id = link.tour_id
  WHERE link.location_id = page.id::uuid
) AS tours ON TRUE
ORDER BY ${pageOrder};
`,
    values,
  };
};

const buildCollectionLocationIdsStatement = (
  filter: WasteCollectionLocationSelectionFilter
): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const where = buildCollectionLocationFilter(filter, values);
  return {
    text: `
SELECT location.id::text
${collectionLocationJoins}
${where}
ORDER BY location.id ASC;
`,
    values,
  };
};

const buildCollectionLocationListStatement = (
  filter: WasteCollectionLocationListFilter = {}
): SqlStatement => {
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

const buildCollectionLocationDeleteStatement = (id: string): SqlStatement => ({
  text: `
DELETE FROM waste_collection_locations
WHERE id = $1::uuid;
`,
  values: [id],
});

export const createWasteCollectionLocationRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  | 'listWasteCollectionLocations'
  | 'listWasteCollectionLocationPage'
  | 'listWasteCollectionLocationIds'
  | 'getWasteCollectionLocationById'
  | 'upsertWasteCollectionLocation'
  | 'deleteWasteCollectionLocation'
> => ({
  async listWasteCollectionLocations(filter) {
    const result = await executor.execute<WasteCollectionLocationRow>(
      buildCollectionLocationListStatement(filter)
    );
    return result.rows.map(mapWasteCollectionLocationRow);
  },
  async listWasteCollectionLocationPage(query): Promise<WasteCollectionLocationPage> {
    const result = await executor.execute<WasteCollectionLocationPageRow>(
      buildCollectionLocationPageStatement(query)
    );
    const total = Number(result.rows[0]?.total_count ?? 0);
    return {
      items: result.rows.filter((row) => row.id !== null).map(mapWasteCollectionLocationPageRow),
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  },
  async listWasteCollectionLocationIds(filter) {
    const result = await executor.execute<WasteCollectionLocationIdRow>(
      buildCollectionLocationIdsStatement(filter)
    );
    return result.rows.map((row) => row.id);
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
  async deleteWasteCollectionLocation(id) {
    await executor.execute(buildCollectionLocationDeleteStatement(id));
  },
});

export const wasteCollectionLocationStatements = {
  listWasteCollectionLocations: buildCollectionLocationListStatement,
  listWasteCollectionLocationPage: buildCollectionLocationPageStatement,
  listWasteCollectionLocationIds: buildCollectionLocationIdsStatement,
  getWasteCollectionLocationById: buildCollectionLocationSelectStatement,
  upsertWasteCollectionLocation: buildCollectionLocationUpsertStatement,
  deleteWasteCollectionLocation: buildCollectionLocationDeleteStatement,
} as const;
