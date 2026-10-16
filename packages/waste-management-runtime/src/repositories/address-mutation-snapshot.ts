import { createHash } from 'node:crypto';
import type {
  WasteAddressEntityType,
  WasteAddressImpactCounts,
  WasteAddressImpactPreview,
  WasteAddressMutationPreviewInput,
} from '@sva/waste-management-contracts';
import { asId, emptyCounts, ids, parentColumnByType, queryRows, tableByType, unique, type QueryClient, type Row, type AddressSnapshot } from './address-mutation-shared.js';

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

export const buildAddressSnapshot = async (
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

  let targetState: readonly Row[] = [];
  if (input.mode === 'move') {
    const targetType = input.entityType === 'city' ? 'waste_regions' : input.entityType === 'street' ? 'waste_cities' : 'waste_streets';
    if (input.targetParentId) {
      const targetColumns = input.entityType === 'city' ? 'id, name, updated_at'
        : input.entityType === 'street' ? 'id, region_id, name, updated_at'
          : 'id, city_id, name, updated_at';
      const target = await queryRows(client, `SELECT ${targetColumns} FROM ${targetType} WHERE id = $1::uuid`, [input.targetParentId]);
      if (target.length !== 1) throw new Error('address_move_target_not_found');
      targetState = target;
      if (input.entityType === 'houseNumber') {
        const cityId = String(target[0]?.city_id);
        targetState = [...targetState, ...await queryRows(client, 'SELECT id, region_id, name, updated_at FROM waste_cities WHERE id = $1::uuid', [cityId])];
      }
      if (input.entityType === 'houseNumber') {
        const regionId = targetState.find((row) => 'region_id' in row)?.region_id;
        if (regionId) targetState = [...targetState, ...await queryRows(client, 'SELECT id, name, updated_at FROM waste_regions WHERE id = $1::uuid', [regionId])];
      }
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

  const assignmentCounts = assignmentIds.length ? await queryRows<{ id: string; has_remaining: boolean }>(
    client,
    'SELECT a.id, EXISTS (SELECT 1 FROM waste_tour_assignment_locations l WHERE l.assignment_id = a.id AND NOT (l.collection_location_id = ANY($2::uuid[]))) AS has_remaining FROM waste_tour_assignments a WHERE a.id = ANY($1::uuid[])',
    [assignmentIds, locationIds]
  ) : [];
  const retainedTourAssignments = assignmentCounts.filter((row) => row.has_remaining).length;
  const fullyRemovedTourAssignments = assignmentCounts.length - retainedTourAssignments;
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
    targetState,
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
): Promise<WasteAddressImpactPreview> => {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const preview = (await buildAddressSnapshot(client, input)).preview;
    await client.query('COMMIT');
    return preview;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};
