import type {
  WasteCollectionLocationQuery,
  WasteCollectionLocationSelectionFilter,
} from '@sva/waste-management-contracts';

import type { SqlPrimitive, SqlStatement } from '@sva/data-repositories';

const escapeLikePattern = (value: string): string => value.replace(/[!%_]/g, '!$&');

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
    const parameter = addValue(escapeLikePattern(filter.q.trim()));
    conditions.push(`(
      location.id::text ILIKE '%' || ${parameter} || '%' ESCAPE '!'
      OR city.name ILIKE '%' || ${parameter} || '%' ESCAPE '!'
      OR region.name ILIKE '%' || ${parameter} || '%' ESCAPE '!'
      OR street.name ILIKE '%' || ${parameter} || '%' ESCAPE '!'
      OR house_number.number ILIKE '%' || ${parameter} || '%' ESCAPE '!'
      OR EXISTS (
        SELECT 1
        FROM waste_location_tour_links AS search_link
        INNER JOIN waste_tours AS search_tour ON search_tour.id = search_link.tour_id
        WHERE search_link.location_id = location.id
          AND search_tour.name ILIKE '%' || ${parameter} || '%' ESCAPE '!'
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
  if (filter.streetId) {
    conditions.push(`location.street_id = ${addValue(filter.streetId)}::uuid`);
  }
  if (filter.houseNumberId) {
    conditions.push(`location.house_number_id = ${addValue(filter.houseNumberId)}::uuid`);
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

const sortColumns = {
  address: ['city_sort_name', 'street_name', 'house_number'],
  addressWithRegion: ['region_name', 'city_sort_name', 'street_name', 'house_number'],
  region: ['region_name'],
  city: ['city_sort_name'],
  street: ['street_name'],
  houseNumber: ['house_number'],
  tourCount: ['tour_count'],
  status: ['active'],
} satisfies Record<WasteCollectionLocationQuery['sortMode'], readonly string[]>;

const buildTourCounts = (query: WasteCollectionLocationQuery, values: SqlPrimitive[]): string => {
  if (query.sortMode !== 'tourCount') return '';
  const bind = (value: SqlPrimitive) => {
    values.push(value);
    return `$${values.length}`;
  };
  const predicates: string[] = [];
  if (query.tourYear !== undefined) {
    const start = bind(`${query.tourYear}-01-01`);
    const end = bind(`${query.tourYear}-12-31`);
    predicates.push(`(
      ((tour.first_date IS NULL OR tour.first_date <= ${end}::date)
       AND (tour.end_date IS NULL OR tour.end_date >= ${start}::date))
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(tour.custom_dates) = 'array' THEN tour.custom_dates ELSE '[]'::jsonb END
        ) AS custom
        WHERE custom->>'date' BETWEEN ${start}::text AND ${end}::text
      )
    )`);
  }
  if (query.tourStatus) predicates.push(`tour.status = ${bind(query.tourStatus)}`);
  const where = predicates.length ? `WHERE ${predicates.join(' AND ')}` : '';
  return `, tour_counts AS (
  SELECT link.location_id, COUNT(*) AS tour_count
  FROM filtered
  JOIN waste_location_tour_links AS link ON link.location_id = filtered.id::uuid
  JOIN waste_tours AS tour ON tour.id = link.tour_id
  ${where}
  GROUP BY link.location_id
), ranked AS (
  SELECT filtered.*, COALESCE(tour_counts.tour_count, 0) AS tour_count
  FROM filtered
  LEFT JOIN tour_counts ON tour_counts.location_id = filtered.id::uuid
)`;
};

const buildCollectionLocationOrder = (
  query: Pick<WasteCollectionLocationQuery, 'sortMode' | 'sortDirection'>,
  prefix = ''
): string => {
  const direction = query.sortDirection === 'desc' ? 'DESC' : 'ASC';
  const expression = (name: string) => `${prefix}${name}`;
  const criteria: readonly string[] = sortColumns[query.sortMode];
  return [
    ...criteria.map((name) => {
      if (name === 'active') return `CASE WHEN ${expression(name)} THEN 0 ELSE 1 END ${direction}`;
      if (name === 'tour_count') return `${expression(name)} ${direction}`;
      return `${expression(name)} COLLATE public.sva_de_numeric ${direction} NULLS LAST`;
    }),
    `${expression('id')} ASC`,
  ].join(',\n  ');
};

export const buildCollectionLocationPageStatement = (
  query: WasteCollectionLocationQuery
): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const where = buildCollectionLocationFilter(query, values);
  const tourCounts = buildTourCounts(query, values);
  const pageSource = query.sortMode === 'tourCount' ? 'ranked' : 'filtered';
  values.push(query.pageSize, (query.page - 1) * query.pageSize);
  const order = buildCollectionLocationOrder(query);
  const pageOrder = buildCollectionLocationOrder(query, 'page.');

  return {
    text: `
WITH filtered AS (
  SELECT${collectionLocationProjection}
  ${collectionLocationJoins}
  ${where}
)${tourCounts},
total AS (
  SELECT COUNT(*)::text AS total_count FROM filtered
),
page AS (
  SELECT *
  FROM ${pageSource}
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
