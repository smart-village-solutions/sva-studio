import type {
  WasteCollectionLocationQuery,
  WasteCollectionLocationSelectionFilter,
} from '@sva/core';

import type { SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';

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

export const buildCollectionLocationPageStatement = (
  query: WasteCollectionLocationQuery
): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const where = buildCollectionLocationFilter(query, values);
  values.push(query.pageSize, (query.page - 1) * query.pageSize);
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
  LIMIT $${values.length - 1}
  OFFSET $${values.length}
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

export const buildCollectionLocationIdsStatement = (
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
