import { applyAddressMerge, buildAddressMergePlan } from './address-merge.js';
import type { WasteAddressImpactCounts, WasteAddressMutationPreviewInput } from '@sva/waste-management-contracts';
import { ids, lockIds, queryRows, tableByType, parentColumnByType, unique, type QueryClient, type AddressSnapshot } from './address-mutation-shared.js';
import { buildAddressSnapshot } from './address-mutation-snapshot.js';

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

type MutationInput = WasteAddressMutationPreviewInput & {
  readonly confirmationToken: string;
  readonly name?: string;
  readonly postalCode?: string | null;
  readonly number?: string;
};

const deleteAddressData = async (client: QueryClient, current: AddressSnapshot): Promise<void> => {
  const deletions = [
    ['waste_email_reminder_subscriptions', current.subscriptionIds],
    ['waste_collection_locations', current.locationIds],
    ['waste_tour_assignments', current.assignmentIds],
    ['waste_house_numbers', current.houseNumberIds],
    ['waste_streets', current.streetIds],
    ['waste_cities', current.cityIds],
    ['waste_regions', current.regionIds],
  ] as const;
  for (const [table, rowIds] of deletions) {
    if (rowIds.length) {
      const query = table === 'waste_tour_assignments'
        ? 'DELETE FROM waste_tour_assignments a WHERE a.id = ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM waste_tour_assignment_locations l WHERE l.assignment_id = a.id)'
        : `DELETE FROM ${table} WHERE id = ANY($1::uuid[])`;
      await client.query(query, [rowIds]);
    }
  }
};

const removeAffectedSubscriptions = (client: QueryClient, current: AddressSnapshot): Promise<unknown> =>
  current.subscriptionIds.length
    ? client.query('DELETE FROM waste_email_reminder_subscriptions WHERE id = ANY($1::uuid[])', [current.subscriptionIds])
    : Promise.resolve();

const moveCity = async (client: QueryClient, input: MutationInput, current: AddressSnapshot): Promise<void> => {
  await client.query('UPDATE waste_cities SET region_id = $2::uuid, name = COALESCE($3, name), postal_code = CASE WHEN $4::boolean THEN $5::text ELSE postal_code END, updated_at = NOW() WHERE id = $1::uuid', [input.entityId, input.targetParentId ?? null, input.name ?? null, input.postalCode !== undefined, input.postalCode ?? null]);
  if (current.locationIds.length) await client.query('UPDATE waste_collection_locations SET region_id = $2::uuid, updated_at = NOW() WHERE id = ANY($1::uuid[])', [current.locationIds, input.targetParentId ?? null]);
  await removeAffectedSubscriptions(client, current);
};

const moveStreet = async (client: QueryClient, input: MutationInput, current: AddressSnapshot): Promise<void> => {
  const targetCity = await queryRows(client, 'SELECT region_id FROM waste_cities WHERE id = $1::uuid', [input.targetParentId]);
  await client.query('UPDATE waste_streets SET city_id = $2::uuid, name = COALESCE($3, name), updated_at = NOW() WHERE id = $1::uuid', [input.entityId, input.targetParentId, input.name ?? null]);
  if (current.locationIds.length) await client.query('UPDATE waste_collection_locations SET city_id = $2::uuid, region_id = $3::uuid, street_id = $4::uuid, updated_at = NOW() WHERE id = ANY($1::uuid[])', [current.locationIds, input.targetParentId, targetCity[0]?.region_id ?? null, input.entityId]);
  await removeAffectedSubscriptions(client, current);
};

const moveHouseNumber = async (client: QueryClient, input: MutationInput, current: AddressSnapshot): Promise<void> => {
  const targetStreet = await queryRows(client, 'SELECT city_id FROM waste_streets WHERE id = $1::uuid', [input.targetParentId]);
  const targetCityId = targetStreet[0]?.city_id;
  const targetCity = await queryRows(client, 'SELECT region_id FROM waste_cities WHERE id = $1::uuid', [targetCityId]);
  await client.query('UPDATE waste_house_numbers SET street_id = $2::uuid, number = COALESCE($3, number), updated_at = NOW() WHERE id = $1::uuid', [input.entityId, input.targetParentId, input.number ?? null]);
  if (current.locationIds.length) await client.query('UPDATE waste_collection_locations SET city_id = $2::uuid, region_id = $3::uuid, street_id = $4::uuid, house_number_id = $5::uuid, updated_at = NOW() WHERE id = ANY($1::uuid[])', [current.locationIds, targetCityId, targetCity[0]?.region_id ?? null, input.targetParentId, input.entityId]);
  await removeAffectedSubscriptions(client, current);
};

const applyMove = (client: QueryClient, input: MutationInput, current: AddressSnapshot): Promise<void> => ({
  city: () => moveCity(client, input, current),
  street: () => moveStreet(client, input, current),
  houseNumber: () => moveHouseNumber(client, input, current),
  region: async () => { throw new Error('invalid_address_move'); },
})[input.entityType]();

export const mutateWasteAddressInTransaction = async (
  client: QueryClient,
  input: MutationInput
): Promise<WasteAddressImpactCounts> => {
  if (input.targetEntityId) {
    if (input.mode !== 'delete' || input.targetEntityId === input.entityId) throw new Error('invalid_address_move');
    for (const entityId of [input.entityId, input.targetEntityId].sort()) {
      await lockAddressHierarchy(client, { ...input, entityId });
    }
  } else await lockAddressHierarchy(client, input);
  const beforeLocks = await buildAddressSnapshot(client, input);
  await lockSnapshotChildren(client, beforeLocks);
  const current = await buildAddressSnapshot(client, input);
  if (current.preview.token !== input.confirmationToken) throw new Error('address_preview_stale');
  if (current.preview.counts.inconsistentCollectionLocations > 0) throw new Error('address_data_inconsistent');
  if (input.targetEntityId) {
    const plan = await buildAddressMergePlan(client, input);
    await removeAffectedSubscriptions(client, current);
    await applyAddressMerge(client, plan, current.locationIds);
  } else if (input.mode === 'delete') await deleteAddressData(client, current);
  else await applyMove(client, input, current);
  return current.preview.counts;
};
