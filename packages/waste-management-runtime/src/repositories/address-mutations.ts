import { createHash } from 'node:crypto';
import type {
  WasteAddressEntityType,
  WasteAddressImpactCounts,
  WasteAddressImpactPreview,
  WasteAddressMutationPreviewInput,
} from '@sva/waste-management-contracts';

type QueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ readonly rowCount: number | null; readonly rows: readonly TRow[] }>;
};

type Row = Readonly<Record<string, unknown>>;
type AddressSnapshot = Readonly<{
  preview: WasteAddressImpactPreview;
  regionIds: readonly string[];
  cityIds: readonly string[];
  streetIds: readonly string[];
  houseNumberIds: readonly string[];
  locationIds: readonly string[];
  subscriptionIds: readonly string[];
  assignmentIds: readonly string[];
}>;

const tableByType: Readonly<Record<WasteAddressEntityType, string>> = {
  region: 'waste_regions',
  city: 'waste_cities',
  street: 'waste_streets',
  houseNumber: 'waste_house_numbers',
};
const parentColumnByType: Readonly<Partial<Record<WasteAddressEntityType, string>>> = {
  city: 'region_id',
  street: 'city_id',
  houseNumber: 'street_id',
};

const asId = (row: Row): string => String(row.id);
const ids = (rows: readonly Row[]): readonly string[] => rows.map(asId).sort();
const unique = (values: readonly string[]): readonly string[] => [...new Set(values)].sort();
const emptyCounts = (): WasteAddressImpactCounts => ({
  regions: 0,
  cities: 0,
  streets: 0,
  houseNumbers: 0,
  collectionLocations: 0,
  locationTourLinks: 0,
  locationTourPickupDates: 0,
  tourAssignmentLocations: 0,
  fullyRemovedTourAssignments: 0,
  retainedTourAssignments: 0,
  emailReminderSubscriptions: 0,
  emailReminderSubscriptionItems: 0,
  emailReminderOutbox: 0,
  sentEmailReminderOutbox: 0,
  inconsistentCollectionLocations: 0,
});

const queryRows = async (client: QueryClient, text: string, values: readonly unknown[] = []) =>
  (await client.query<Row>(text, values)).rows;

const lockIds = async (client: QueryClient, table: string, values: readonly string[]) => {
  if (values.length) await queryRows(client, `SELECT id FROM ${table} WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [values]);
};

const lockAddressHierarchy = async (
  client: QueryClient,
  input: WasteAddressMutationPreviewInput
): Promise<void> => {
  const parentColumn = parentColumnByType[input.entityType];
  const current = await queryRows(client, `SELECT id${parentColumn ? `, ${parentColumn}` : ''} FROM ${tableByType[input.entityType]} WHERE id = $1::uuid FOR UPDATE`, [input.entityId]);
  if (!current[0]) throw new Error('address_entity_not_found');
  const selected = current[0];
  if (input.entityType === 'region') {
    const cityRows = await queryRows(client, 'SELECT id FROM waste_cities WHERE region_id = $1::uuid ORDER BY id FOR UPDATE', [input.entityId]);
    const cityIds = ids(cityRows);
    const streetRows = cityIds.length ? await queryRows(client, 'SELECT id FROM waste_streets WHERE city_id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [cityIds]) : [];
    const streetIds = ids(streetRows);
    if (streetIds.length) await queryRows(client, 'SELECT id FROM waste_house_numbers WHERE street_id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [streetIds]);
  } else if (input.entityType === 'city') {
    await lockIds(client, 'waste_regions', unique([String(selected.region_id ?? ''), input.targetParentId ?? ''].filter(Boolean)));
    const streetRows = await queryRows(client, 'SELECT id FROM waste_streets WHERE city_id = $1::uuid ORDER BY id FOR UPDATE', [input.entityId]);
    const streetIds = ids(streetRows);
    if (streetIds.length) await queryRows(client, 'SELECT id FROM waste_house_numbers WHERE street_id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [streetIds]);
  } else if (input.entityType === 'street') {
    await lockIds(client, 'waste_cities', unique([String(selected.city_id), input.targetParentId ?? ''].filter(Boolean)));
    await queryRows(client, 'SELECT id FROM waste_house_numbers WHERE street_id = $1::uuid ORDER BY id FOR UPDATE', [input.entityId]);
  } else {
    const targetStreetId = input.targetParentId;
    const streetRows = await queryRows(client, 'SELECT id, city_id FROM waste_streets WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [unique([String(selected.street_id), targetStreetId ?? ''].filter(Boolean))]);
    await lockIds(client, 'waste_cities', unique(streetRows.map((row) => String(row.city_id))));
  }
};

const lockSnapshotChildren = async (client: QueryClient, snapshot: AddressSnapshot): Promise<void> => {
  await lockIds(client, 'waste_collection_locations', snapshot.locationIds);
  await lockIds(client, 'waste_email_reminder_subscriptions', snapshot.subscriptionIds);
  await lockIds(client, 'waste_tour_assignments', snapshot.assignmentIds);
  if (snapshot.locationIds.length) {
    await queryRows(client, 'SELECT id FROM waste_location_tour_links WHERE location_id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [snapshot.locationIds]);
    await queryRows(client, 'SELECT id FROM waste_location_tour_pickup_dates WHERE location_id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [snapshot.locationIds]);
    await queryRows(client, 'SELECT assignment_id FROM waste_tour_assignment_locations WHERE collection_location_id = ANY($1::uuid[]) ORDER BY assignment_id, collection_location_id FOR UPDATE', [snapshot.locationIds]);
  }
  if (snapshot.subscriptionIds.length) {
    await queryRows(client, 'SELECT id FROM waste_email_reminder_subscription_items WHERE subscription_id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [snapshot.subscriptionIds]);
    await queryRows(client, 'SELECT id FROM waste_email_reminder_outbox WHERE subscription_id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [snapshot.subscriptionIds]);
  }
};

const parentRows = async (
  client: QueryClient,
  entityType: WasteAddressEntityType,
  entityId: string
): Promise<{
  regions: readonly Row[];
  cities: readonly Row[];
  streets: readonly Row[];
  houses: readonly Row[];
}> => {
  const selected = await queryRows(
    client,
    `SELECT id${parentColumnByType[entityType] ? `, ${parentColumnByType[entityType]}` : ''} FROM ${tableByType[entityType]} WHERE id = $1::uuid`,
    [entityId]
  );
  if (selected.length !== 1) throw new Error('address_entity_not_found');
  const item = selected[0] as Row;
  const result = { regions: [] as Row[], cities: [] as Row[], streets: [] as Row[], houses: [] as Row[] };
  if (entityType === 'region') {
    result.regions = selected as Row[];
    result.cities = [...(await queryRows(client, 'SELECT id, region_id FROM waste_cities WHERE region_id = $1::uuid', [entityId]))];
  } else if (entityType === 'city') {
    result.cities = selected as Row[];
  } else if (entityType === 'street') {
    result.streets = selected as Row[];
  } else {
    result.houses = selected as Row[];
  }

  const cityIds = entityType === 'city' || entityType === 'region' ? ids(result.cities) :
    entityType === 'street' ? unique([String(item.city_id)]) : [];
  if (cityIds.length > 0 && entityType !== 'street') {
    result.streets = [...(await queryRows(client, 'SELECT id, city_id FROM waste_streets WHERE city_id = ANY($1::uuid[])', [cityIds]))];
  }
  if (entityType === 'street') result.streets = selected as Row[];
  const streetIds = entityType === 'houseNumber' ? unique([String(item.street_id)]) : ids(result.streets);
  if (streetIds.length > 0 && entityType !== 'houseNumber') {
    result.houses = [...(await queryRows(client, 'SELECT id, street_id FROM waste_house_numbers WHERE street_id = ANY($1::uuid[])', [streetIds]))];
  }
  if (entityType === 'houseNumber') result.houses = selected as Row[];

  return result;
};

const buildAddressSnapshot = async (
  client: QueryClient,
  input: WasteAddressMutationPreviewInput
): Promise<AddressSnapshot> => {
  if (input.mode === 'move' && input.entityType === 'region') {
    throw new Error('invalid_address_move');
  }
  const hierarchy = await parentRows(client, input.entityType, input.entityId);
  const selectedColumns: Readonly<Record<WasteAddressEntityType, string>> = {
    region: 'id, name, updated_at',
    city: 'id, name, postal_code, region_id, updated_at',
    street: 'id, name, city_id, updated_at',
    houseNumber: 'id, number, street_id, updated_at',
  };
  const selectedState = (await queryRows(client, `SELECT ${selectedColumns[input.entityType]} FROM ${tableByType[input.entityType]} WHERE id = $1::uuid`, [input.entityId]))[0];
  if (!selectedState) throw new Error('address_entity_not_found');
  const regionIds = ids(hierarchy.regions);
  const cityIds = ids(hierarchy.cities);
  const streetIds = ids(hierarchy.streets);
  const houseNumberIds = ids(hierarchy.houses);

  if (input.mode === 'move') {
    const targetType = input.entityType === 'city' ? 'waste_regions' : input.entityType === 'street' ? 'waste_cities' : 'waste_streets';
    if (input.targetParentId) {
      const target = await queryRows(client, `SELECT id FROM ${targetType} WHERE id = $1::uuid`, [input.targetParentId]);
      if (target.length !== 1) throw new Error('address_move_target_not_found');
    } else if (input.entityType !== 'city') {
      throw new Error('address_move_target_not_found');
    }
    const sourceParent = input.entityType === 'city'
      ? hierarchy.cities[0]?.region_id
      : input.entityType === 'street'
        ? hierarchy.streets[0]?.city_id
        : hierarchy.houses[0]?.street_id;
    if (String(sourceParent ?? '') === (input.targetParentId ?? '')) throw new Error('address_move_unchanged');
  }

  const locationFilter = input.mode === 'move'
    ? input.entityType === 'city' ? 'city_id = ANY($1::uuid[])'
      : input.entityType === 'street' ? '(street_id = ANY($1::uuid[]) OR house_number_id = ANY($2::uuid[]))'
        : 'house_number_id = ANY($1::uuid[])'
    : input.entityType === 'region' ? '(city_id = ANY($1::uuid[]) OR region_id = ANY($2::uuid[]) OR street_id = ANY($3::uuid[]) OR house_number_id = ANY($4::uuid[]))'
      : input.entityType === 'city' ? '(city_id = ANY($1::uuid[]) OR street_id = ANY($2::uuid[]) OR house_number_id = ANY($3::uuid[]))'
        : input.entityType === 'street' ? '(street_id = ANY($1::uuid[]) OR house_number_id = ANY($2::uuid[]))'
          : 'house_number_id = ANY($1::uuid[])';
  const locationParams = input.mode === 'move'
    ? input.entityType === 'city' ? [cityIds]
      : input.entityType === 'street' ? [streetIds, houseNumberIds]
        : [houseNumberIds]
    : input.entityType === 'region' ? [cityIds, regionIds, streetIds, houseNumberIds]
      : input.entityType === 'city' ? [cityIds, streetIds, houseNumberIds]
        : input.entityType === 'street' ? [streetIds, houseNumberIds]
          : [houseNumberIds];
  const locations = await queryRows(client, `SELECT id, city_id, region_id, street_id, house_number_id FROM waste_collection_locations WHERE ${locationFilter} ORDER BY id`, locationParams);
  const locationIds = ids(locations);

  const inconsistentIds = new Set<string>();
  const referencedCityIds = unique(locations.map((row) => String(row.city_id)));
  const referencedStreetIds = unique(locations.map((row) => row.street_id == null ? '' : String(row.street_id)).filter(Boolean));
  const referencedHouseIds = unique(locations.map((row) => row.house_number_id == null ? '' : String(row.house_number_id)).filter(Boolean));
  const cityRows = referencedCityIds.length ? await queryRows(client, 'SELECT id, region_id FROM waste_cities WHERE id = ANY($1::uuid[])', [referencedCityIds]) : [];
  const cityRegion = new Map(cityRows.map((row) => [String(row.id), row.region_id == null ? null : String(row.region_id)]));
  const streetsForCheck = referencedStreetIds.length ? await queryRows(client, 'SELECT id, city_id FROM waste_streets WHERE id = ANY($1::uuid[])', [referencedStreetIds]) : [];
  const streetCity = new Map(streetsForCheck.map((row) => [String(row.id), String(row.city_id)]));
  const housesForCheck = referencedHouseIds.length ? await queryRows(client, 'SELECT id, street_id FROM waste_house_numbers WHERE id = ANY($1::uuid[])', [referencedHouseIds]) : [];
  const houseStreet = new Map(housesForCheck.map((row) => [String(row.id), String(row.street_id)]));
  for (const location of locations) {
    const cityId = String(location.city_id);
    const regionId = location.region_id == null ? null : String(location.region_id);
    const streetId = location.street_id == null ? null : String(location.street_id);
    const houseId = location.house_number_id == null ? null : String(location.house_number_id);
    if (regionId && cityRegion.has(cityId) && cityRegion.get(cityId) !== regionId) inconsistentIds.add(asId(location));
    if (streetId && (!streetCity.has(streetId) || streetCity.get(streetId) !== cityId)) inconsistentIds.add(asId(location));
    if (houseId && (!houseStreet.has(houseId) || houseStreet.get(houseId) !== streetId)) inconsistentIds.add(asId(location));
  }

  let subscriptions: readonly Row[] = [];
  if (input.entityType === 'region') {
    subscriptions = await queryRows(client, 'SELECT id FROM waste_email_reminder_subscriptions WHERE city_id = ANY($1::uuid[]) OR region_id = ANY($2::uuid[]) ORDER BY id', [cityIds, regionIds]);
  } else if (input.entityType === 'city' && cityIds.length > 0) {
    subscriptions = await queryRows(client, 'SELECT id FROM waste_email_reminder_subscriptions WHERE city_id = ANY($1::uuid[]) ORDER BY id', [cityIds]);
  } else if (input.entityType === 'street') {
    subscriptions = await queryRows(client, 'SELECT id FROM waste_email_reminder_subscriptions WHERE street_id = ANY($1::text[]) OR house_number_id = ANY($2::uuid[]) ORDER BY id', [streetIds, houseNumberIds]);
  } else if (input.entityType === 'houseNumber') {
    subscriptions = await queryRows(client, 'SELECT id FROM waste_email_reminder_subscriptions WHERE house_number_id = ANY($1::uuid[]) ORDER BY id', [houseNumberIds]);
  }
  const subscriptionIds = ids(subscriptions);
  const subscriptionItems = subscriptionIds.length ? await queryRows(client, 'SELECT id, subscription_id FROM waste_email_reminder_subscription_items WHERE subscription_id = ANY($1::uuid[]) ORDER BY id', [subscriptionIds]) : [];
  const outbox = subscriptionIds.length ? await queryRows(client, 'SELECT id, subscription_id, status FROM waste_email_reminder_outbox WHERE subscription_id = ANY($1::uuid[]) ORDER BY id', [subscriptionIds]) : [];
  const links = locationIds.length ? await queryRows(client, 'SELECT id, location_id FROM waste_location_tour_links WHERE location_id = ANY($1::uuid[]) ORDER BY id', [locationIds]) : [];
  const pickupDates = locationIds.length ? await queryRows(client, 'SELECT id, location_id FROM waste_location_tour_pickup_dates WHERE location_id = ANY($1::uuid[]) ORDER BY id', [locationIds]) : [];
  const assignmentLocations = locationIds.length ? await queryRows(client, 'SELECT assignment_id, collection_location_id FROM waste_tour_assignment_locations WHERE collection_location_id = ANY($1::uuid[]) ORDER BY assignment_id, collection_location_id', [locationIds]) : [];
  const assignmentIds = unique(assignmentLocations.map((row) => String(row.assignment_id)));
  const counts = emptyCounts();
  const nextCounts: WasteAddressImpactCounts = {
    ...counts,
    regions: input.mode === 'delete' ? regionIds.length : 0,
    cities: input.mode === 'delete' ? cityIds.length : 0,
    streets: input.mode === 'delete' ? streetIds.length : 0,
    houseNumbers: input.mode === 'delete' ? houseNumberIds.length : 0,
    collectionLocations: locationIds.length,
    locationTourLinks: links.length,
    locationTourPickupDates: pickupDates.length,
    tourAssignmentLocations: assignmentLocations.length,
    emailReminderSubscriptions: subscriptionIds.length,
    emailReminderSubscriptionItems: subscriptionItems.length,
    emailReminderOutbox: outbox.length,
    sentEmailReminderOutbox: outbox.filter((row) => row.status === 'sent').length,
    inconsistentCollectionLocations: inconsistentIds.size,
  };

  const assignmentRows = assignmentIds.length ? await queryRows(client, 'SELECT id FROM waste_tour_assignments WHERE id = ANY($1::uuid[])', [assignmentIds]) : [];
  let fullyRemovedTourAssignments = 0;
  let retainedTourAssignments = 0;
  for (const assignment of assignmentRows) {
    const remaining = await queryRows(client, 'SELECT 1 FROM waste_tour_assignment_locations WHERE assignment_id = $1::uuid AND NOT (collection_location_id = ANY($2::uuid[])) LIMIT 1', [String(assignment.id), locationIds]);
    if (remaining.length === 0) fullyRemovedTourAssignments += 1;
    else retainedTourAssignments += 1;
  }
  const finalCounts = { ...nextCounts, fullyRemovedTourAssignments, retainedTourAssignments };
  const tokenBody = JSON.stringify({
    input: {
      entityType: input.entityType,
      entityId: input.entityId,
      mode: input.mode,
      ...(input.targetParentId ? { targetParentId: input.targetParentId } : {}),
    },
    hierarchy: { regionIds, cityIds, streetIds, houseNumberIds },
    parents: {
      cities: hierarchy.cities.map((row) => [row.id, row.region_id]),
      streets: hierarchy.streets.map((row) => [row.id, row.city_id]),
      houseNumbers: hierarchy.houses.map((row) => [row.id, row.street_id]),
    },
    selectedState,
    locations: locations.map((row) => [row.id, row.city_id, row.region_id, row.street_id, row.house_number_id]),
    subscriptions: subscriptionIds,
    subscriptionItems: subscriptionItems.map((row) => row.id),
    outbox: outbox.map((row) => [row.id, row.status]),
    links: links.map((row) => row.id),
    pickupDates: pickupDates.map((row) => row.id),
    assignmentLocations,
    counts: finalCounts,
  });
  const token = createHash('sha256').update(tokenBody).digest('hex');
  return {
    regionIds,
    cityIds,
    streetIds,
    houseNumberIds,
    locationIds,
    subscriptionIds,
    assignmentIds,
    preview: {
      entityType: input.entityType,
      entityId: input.entityId,
      mode: input.mode,
      ...(input.targetParentId ? { targetParentId: input.targetParentId } : {}),
      token,
      counts: finalCounts,
    },
  };
};

export const previewWasteAddressMutation = async (
  client: QueryClient,
  input: WasteAddressMutationPreviewInput
): Promise<WasteAddressImpactPreview> => (await buildAddressSnapshot(client, input)).preview;

export const mutateWasteAddressInTransaction = async (
  client: QueryClient,
  input: WasteAddressMutationPreviewInput & {
    readonly confirmationToken: string;
    readonly name?: string;
    readonly postalCode?: string | null;
    readonly number?: string;
  }
): Promise<WasteAddressImpactCounts> => {
  await lockAddressHierarchy(client, input);
  const beforeLocks = await buildAddressSnapshot(client, input);
  await lockSnapshotChildren(client, beforeLocks);
  const current = await buildAddressSnapshot(client, input);
  if (current.preview.token !== input.confirmationToken) throw new Error('address_preview_stale');
  if (current.preview.counts.inconsistentCollectionLocations > 0) throw new Error('address_data_inconsistent');

  const { entityType, entityId, mode, targetParentId } = input;
  if (mode === 'delete') {
    if (current.subscriptionIds.length) await client.query('DELETE FROM waste_email_reminder_subscriptions WHERE id = ANY($1::uuid[])', [current.subscriptionIds]);
    if (current.locationIds.length) await client.query('DELETE FROM waste_collection_locations WHERE id = ANY($1::uuid[])', [current.locationIds]);
    if (current.assignmentIds.length) await client.query('DELETE FROM waste_tour_assignments a WHERE a.id = ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM waste_tour_assignment_locations l WHERE l.assignment_id = a.id)', [current.assignmentIds]);
    if (current.houseNumberIds.length) await client.query('DELETE FROM waste_house_numbers WHERE id = ANY($1::uuid[])', [current.houseNumberIds]);
    if (current.streetIds.length) await client.query('DELETE FROM waste_streets WHERE id = ANY($1::uuid[])', [current.streetIds]);
    if (current.cityIds.length) await client.query('DELETE FROM waste_cities WHERE id = ANY($1::uuid[])', [current.cityIds]);
    if (current.regionIds.length) await client.query('DELETE FROM waste_regions WHERE id = ANY($1::uuid[])', [current.regionIds]);
  } else if (entityType === 'city') {
    await client.query('UPDATE waste_cities SET region_id = $2::uuid, name = COALESCE($3, name), postal_code = CASE WHEN $4::boolean THEN $5::text ELSE postal_code END, updated_at = NOW() WHERE id = $1::uuid', [entityId, targetParentId ?? null, input.name ?? null, input.postalCode !== undefined, input.postalCode ?? null]);
    if (current.locationIds.length) await client.query('UPDATE waste_collection_locations SET region_id = $2::uuid, updated_at = NOW() WHERE id = ANY($1::uuid[])', [current.locationIds, targetParentId ?? null]);
    if (current.subscriptionIds.length) await client.query('DELETE FROM waste_email_reminder_subscriptions WHERE id = ANY($1::uuid[])', [current.subscriptionIds]);
  } else if (entityType === 'street') {
    const targetCity = await queryRows(client, 'SELECT region_id FROM waste_cities WHERE id = $1::uuid', [targetParentId]);
    await client.query('UPDATE waste_streets SET city_id = $2::uuid, name = COALESCE($3, name), updated_at = NOW() WHERE id = $1::uuid', [entityId, targetParentId, input.name ?? null]);
    if (current.locationIds.length) await client.query('UPDATE waste_collection_locations SET city_id = $2::uuid, region_id = $3::uuid, street_id = $4::uuid, updated_at = NOW() WHERE id = ANY($1::uuid[])', [current.locationIds, targetParentId, targetCity[0]?.region_id ?? null, entityId]);
    if (current.subscriptionIds.length) await client.query('DELETE FROM waste_email_reminder_subscriptions WHERE id = ANY($1::uuid[])', [current.subscriptionIds]);
  } else {
    const targetStreet = await queryRows(client, 'SELECT city_id FROM waste_streets WHERE id = $1::uuid', [targetParentId]);
    const targetCityId = targetStreet[0]?.city_id;
    const targetCity = await queryRows(client, 'SELECT region_id FROM waste_cities WHERE id = $1::uuid', [targetCityId]);
    await client.query('UPDATE waste_house_numbers SET street_id = $2::uuid, number = COALESCE($3, number), updated_at = NOW() WHERE id = $1::uuid', [entityId, targetParentId, input.number ?? null]);
    if (current.locationIds.length) await client.query('UPDATE waste_collection_locations SET city_id = $2::uuid, region_id = $3::uuid, street_id = $4::uuid, house_number_id = $5::uuid, updated_at = NOW() WHERE id = ANY($1::uuid[])', [current.locationIds, targetCityId, targetCity[0]?.region_id ?? null, targetParentId, entityId]);
    if (current.subscriptionIds.length) await client.query('DELETE FROM waste_email_reminder_subscriptions WHERE id = ANY($1::uuid[])', [current.subscriptionIds]);
  }
  return current.preview.counts;
};
