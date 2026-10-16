import { createHash } from 'node:crypto';
import type { WasteAddressEntityType, WasteAddressMutationPreviewInput } from '@sva/waste-management-contracts';
import { asId, ids, parentColumnByType, queryRows, tableByType, unique, type QueryClient, type Row } from './address-mutation-shared.js';

export type AddressHierarchy = Readonly<{
  regions: readonly Row[];
  cities: readonly Row[];
  streets: readonly Row[];
  houses: readonly Row[];
}>;
export type AddressHierarchyIds = Readonly<{ regionIds: readonly string[]; cityIds: readonly string[]; streetIds: readonly string[]; houseNumberIds: readonly string[] }>;
type AddressLocation = Row & { id: string; city_id: string; region_id: string | null; street_id: string | null; house_number_id: string | null };

export const loadAddressHierarchy = async (client: QueryClient, entityType: WasteAddressEntityType, entityId: string): Promise<AddressHierarchy> => {
  const selected = await queryRows(client, `SELECT id${parentColumnByType[entityType] ? `, ${parentColumnByType[entityType]}` : ''} FROM ${tableByType[entityType]} WHERE id = $1::uuid`, [entityId]);
  if (selected.length !== 1) throw new Error('address_entity_not_found');
  const item = selected[0] as Row;
  const result = { regions: [] as Row[], cities: [] as Row[], streets: [] as Row[], houses: [] as Row[] };
  if (entityType === 'region') {
    result.regions = [...selected];
    result.cities = [...await queryRows(client, 'SELECT id, region_id FROM waste_cities WHERE region_id = $1::uuid ORDER BY id', [entityId])];
  } else if (entityType === 'city') result.cities = [...selected];
  else if (entityType === 'street') result.streets = [...selected];
  else result.houses = [...selected];
  const cityIds = entityType === 'city' || entityType === 'region' ? ids(result.cities) : entityType === 'street' ? unique([String(item.city_id)]) : [];
  if (cityIds.length && entityType !== 'street') result.streets = [...await queryRows(client, 'SELECT id, city_id FROM waste_streets WHERE city_id = ANY($1::uuid[]) ORDER BY id', [cityIds])];
  const streetIds = entityType === 'houseNumber' ? unique([String(item.street_id)]) : ids(result.streets);
  if (streetIds.length && entityType !== 'houseNumber') result.houses = [...await queryRows(client, 'SELECT id, street_id FROM waste_house_numbers WHERE street_id = ANY($1::uuid[]) ORDER BY id', [streetIds])];
  return result;
};

export const addressHierarchyIds = (hierarchy: AddressHierarchy): AddressHierarchyIds => ({
  regionIds: ids(hierarchy.regions), cityIds: ids(hierarchy.cities), streetIds: ids(hierarchy.streets), houseNumberIds: ids(hierarchy.houses),
});

export const loadMoveTargetState = async (client: QueryClient, input: WasteAddressMutationPreviewInput, hierarchy: AddressHierarchy): Promise<readonly Row[]> => {
  if (input.mode !== 'move') return [];
  if (input.entityType === 'region') throw new Error('invalid_address_move');
  if (!input.targetParentId) {
    if (input.entityType !== 'city') throw new Error('address_move_target_not_found');
    assertMoveChanged(input, hierarchy);
    return [];
  }
  const config = {
    city: { table: 'waste_regions', columns: 'id, name, updated_at' },
    street: { table: 'waste_cities', columns: 'id, region_id, name, updated_at' },
    houseNumber: { table: 'waste_streets', columns: 'id, city_id, name, updated_at' },
    region: { table: '', columns: '' },
  }[input.entityType];
  const target = await queryRows(client, `SELECT ${config.columns} FROM ${config.table} WHERE id = $1::uuid`, [input.targetParentId]);
  if (target.length !== 1) throw new Error('address_move_target_not_found');
  let result = [...target];
  if (input.entityType === 'houseNumber') {
    const cityId = String(target[0]?.city_id);
    const city = await queryRows(client, 'SELECT id, region_id, name, updated_at FROM waste_cities WHERE id = $1::uuid', [cityId]);
    result = [...result, ...city];
    const regionId = city[0]?.region_id;
    if (regionId) result = [...result, ...await queryRows(client, 'SELECT id, name, updated_at FROM waste_regions WHERE id = $1::uuid', [regionId])];
  }
  assertMoveChanged(input, hierarchy);
  return result;
};

const assertMoveChanged = (input: WasteAddressMutationPreviewInput, hierarchy: AddressHierarchy): void => {
  const sourceParent = {
    city: hierarchy.cities[0]?.region_id,
    street: hierarchy.streets[0]?.city_id,
    houseNumber: hierarchy.houses[0]?.street_id,
    region: undefined,
  }[input.entityType];
  if (String(sourceParent ?? '') === (input.targetParentId ?? '')) throw new Error('address_move_unchanged');
};

const locationPredicates = {
  move: {
    city: 'city_id = ANY($1::uuid[])',
    street: '(street_id = ANY($1::uuid[]) OR house_number_id = ANY($2::uuid[]))',
    houseNumber: 'house_number_id = ANY($1::uuid[])',
    region: '',
  },
  delete: {
    region: '(city_id = ANY($1::uuid[]) OR region_id = ANY($2::uuid[]) OR street_id = ANY($3::uuid[]) OR house_number_id = ANY($4::uuid[]))',
    city: '(city_id = ANY($1::uuid[]) OR street_id = ANY($2::uuid[]) OR house_number_id = ANY($3::uuid[]))',
    street: '(street_id = ANY($1::uuid[]) OR house_number_id = ANY($2::uuid[]))',
    houseNumber: 'house_number_id = ANY($1::uuid[])',
  },
} as const;
const locationParams = (input: WasteAddressMutationPreviewInput, ids: AddressHierarchyIds): readonly unknown[] => ({
  move: { city: [ids.cityIds], street: [ids.streetIds, ids.houseNumberIds], houseNumber: [ids.houseNumberIds], region: [] },
  delete: { region: [ids.cityIds, ids.regionIds, ids.streetIds, ids.houseNumberIds], city: [ids.cityIds, ids.streetIds, ids.houseNumberIds], street: [ids.streetIds, ids.houseNumberIds], houseNumber: [ids.houseNumberIds] },
})[input.mode][input.entityType];

export const loadAffectedLocations = (client: QueryClient, input: WasteAddressMutationPreviewInput, hierarchyIds: AddressHierarchyIds): Promise<readonly AddressLocation[]> =>
  queryRows(client, `SELECT id, city_id, region_id, street_id, house_number_id FROM waste_collection_locations WHERE ${locationPredicates[input.mode][input.entityType]} ORDER BY id`, locationParams(input, hierarchyIds));

const differs = (actual: string | null, expected: string | null): boolean => actual !== expected;
const locationIsInconsistent = (location: AddressLocation, cityRegion: ReadonlyMap<string, string | null>, streetCity: ReadonlyMap<string, string>, houseStreet: ReadonlyMap<string, string>): boolean => {
  const cityId = String(location.city_id);
  const regionId = location.region_id == null ? null : String(location.region_id);
  const streetId = location.street_id == null ? null : String(location.street_id);
  const houseId = location.house_number_id == null ? null : String(location.house_number_id);
  return Boolean((regionId && cityRegion.has(cityId) && cityRegion.get(cityId) !== regionId)
    || (streetId && (!streetCity.has(streetId) || differs(streetCity.get(streetId) ?? null, cityId)))
    || (houseId && (!houseStreet.has(houseId) || differs(houseStreet.get(houseId) ?? null, streetId))));
};

export const inconsistentLocationIds = async (client: QueryClient, locations: readonly AddressLocation[]): Promise<ReadonlySet<string>> => {
  const cityIds = unique(locations.map((row) => String(row.city_id)));
  const streetIds = unique(locations.map((row) => row.street_id == null ? '' : String(row.street_id)).filter(Boolean));
  const houseIds = unique(locations.map((row) => row.house_number_id == null ? '' : String(row.house_number_id)).filter(Boolean));
  const cityRows = cityIds.length ? await queryRows(client, 'SELECT id, region_id FROM waste_cities WHERE id = ANY($1::uuid[])', [cityIds]) : [];
  const streetRows = streetIds.length ? await queryRows(client, 'SELECT id, city_id FROM waste_streets WHERE id = ANY($1::uuid[])', [streetIds]) : [];
  const houseRows = houseIds.length ? await queryRows(client, 'SELECT id, street_id FROM waste_house_numbers WHERE id = ANY($1::uuid[])', [houseIds]) : [];
  const cityRegion = new Map(cityRows.map((row) => [String(row.id), row.region_id == null ? null : String(row.region_id)]));
  const streetCity = new Map(streetRows.map((row) => [String(row.id), String(row.city_id)]));
  const houseStreet = new Map(houseRows.map((row) => [String(row.id), String(row.street_id)]));
  return new Set(locations.filter((row) => locationIsInconsistent(row, cityRegion, streetCity, houseStreet)).map(asId));
};

const subscriptionQueries = {
  region: 'SELECT id FROM waste_email_reminder_subscriptions WHERE city_id = ANY($1::uuid[]) OR region_id = ANY($2::uuid[]) ORDER BY id',
  city: 'SELECT id FROM waste_email_reminder_subscriptions WHERE city_id = ANY($1::uuid[]) ORDER BY id',
  street: 'SELECT id FROM waste_email_reminder_subscriptions WHERE street_id = ANY($1::text[]) OR house_number_id = ANY($2::uuid[]) ORDER BY id',
  houseNumber: 'SELECT id FROM waste_email_reminder_subscriptions WHERE house_number_id = ANY($1::uuid[]) ORDER BY id',
} as const;
export const loadAffectedSubscriptions = (client: QueryClient, type: WasteAddressEntityType, ids: AddressHierarchyIds): Promise<readonly Row[]> => {
  if (type === 'city' && !ids.cityIds.length) return Promise.resolve([]);
  const params = {
    region: [ids.cityIds, ids.regionIds], city: [ids.cityIds], street: [ids.streetIds, ids.houseNumberIds], houseNumber: [ids.houseNumberIds],
  }[type];
  return queryRows(client, subscriptionQueries[type], params);
};

export const addressPreviewToken = (snapshot: Readonly<Record<string, unknown>>): string =>
  createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
