import type {
  WasteAddressImpactCounts,
  WasteAddressImpactPreview,
  WasteAddressMutationPreviewInput,
} from '@sva/waste-management-contracts';
import { emptyCounts, ids, queryRows, unique, type QueryClient, type Row, type AddressSnapshot } from './address-mutation-shared.js';
import {
  addressHierarchyIds,
  addressPreviewToken,
  inconsistentLocationIds,
  loadAddressHierarchy,
  loadAffectedLocations,
  loadAffectedSubscriptions,
  loadMoveTargetState,
  type AddressHierarchy,
  type AddressHierarchyIds,
} from './address-mutation-snapshot-data.js';

const loadRelatedRows = async (client: QueryClient, locationIds: readonly string[], subscriptionIds: readonly string[]) => {
  const [subscriptionItems, outbox, links, pickupDates, assignmentLocations] = await Promise.all([
    subscriptionIds.length ? queryRows(client, 'SELECT id, subscription_id FROM waste_email_reminder_subscription_items WHERE subscription_id = ANY($1::uuid[]) ORDER BY id', [subscriptionIds]) : [],
    subscriptionIds.length ? queryRows(client, 'SELECT id, subscription_id, status FROM waste_email_reminder_outbox WHERE subscription_id = ANY($1::uuid[]) ORDER BY id', [subscriptionIds]) : [],
    locationIds.length ? queryRows(client, 'SELECT id, location_id FROM waste_location_tour_links WHERE location_id = ANY($1::uuid[]) ORDER BY id', [locationIds]) : [],
    locationIds.length ? queryRows(client, 'SELECT id, location_id FROM waste_location_tour_pickup_dates WHERE location_id = ANY($1::uuid[]) ORDER BY id', [locationIds]) : [],
    locationIds.length ? queryRows(client, 'SELECT assignment_id, collection_location_id FROM waste_tour_assignment_locations WHERE collection_location_id = ANY($1::uuid[]) ORDER BY assignment_id, collection_location_id', [locationIds]) : [],
  ]);
  const assignmentIds = unique(assignmentLocations.map((row) => String(row.assignment_id)));
  const assignmentCounts = assignmentIds.length ? await queryRows<{ id: string; has_remaining: boolean }>(
    client,
    'SELECT a.id, EXISTS (SELECT 1 FROM waste_tour_assignment_locations l WHERE l.assignment_id = a.id AND NOT (l.collection_location_id = ANY($2::uuid[]))) AS has_remaining FROM waste_tour_assignments a WHERE a.id = ANY($1::uuid[])',
    [assignmentIds, locationIds]
  ) : [];
  return { subscriptionItems, outbox, links, pickupDates, assignmentLocations, assignmentIds, assignmentCounts };
};

const impactCounts = (
  input: WasteAddressMutationPreviewInput,
  hierarchy: AddressHierarchyIds,
  locationCount: number,
  subscriptionCount: number,
  inconsistentCount: number,
  related: Awaited<ReturnType<typeof loadRelatedRows>>
): WasteAddressImpactCounts => {
  const { subscriptionItems, outbox, links, pickupDates, assignmentLocations, assignmentCounts } = related;
  const retainedTourAssignments = assignmentCounts.filter((row) => row.has_remaining).length;
  return {
    ...emptyCounts(),
    regions: input.mode === 'delete' ? hierarchy.regionIds.length : 0,
    cities: input.mode === 'delete' ? hierarchy.cityIds.length : 0,
    streets: input.mode === 'delete' ? hierarchy.streetIds.length : 0,
    houseNumbers: input.mode === 'delete' ? hierarchy.houseNumberIds.length : 0,
    collectionLocations: locationCount,
    locationTourLinks: links.length,
    locationTourPickupDates: pickupDates.length,
    tourAssignmentLocations: assignmentLocations.length,
    fullyRemovedTourAssignments: assignmentCounts.length - retainedTourAssignments,
    retainedTourAssignments,
    emailReminderSubscriptions: subscriptionCount,
    emailReminderSubscriptionItems: subscriptionItems.length,
    emailReminderOutbox: outbox.length,
    sentEmailReminderOutbox: outbox.filter((row) => row.status === 'sent').length,
    inconsistentCollectionLocations: inconsistentCount,
  };
};

const snapshotToken = (
  input: WasteAddressMutationPreviewInput,
  hierarchy: AddressHierarchy,
  idsByType: AddressHierarchyIds,
  selectedState: Row,
  targetState: readonly Row[],
  locations: readonly Row[],
  subscriptionIds: readonly string[],
  related: Awaited<ReturnType<typeof loadRelatedRows>>,
  counts: WasteAddressImpactCounts
): string => addressPreviewToken({
  input: { entityType: input.entityType, entityId: input.entityId, mode: input.mode, ...(input.targetParentId ? { targetParentId: input.targetParentId } : {}) },
  hierarchy: idsByType,
  parents: {
    cities: hierarchy.cities.map((row) => [row.id, row.region_id]),
    streets: hierarchy.streets.map((row) => [row.id, row.city_id]),
    houseNumbers: hierarchy.houses.map((row) => [row.id, row.street_id]),
  },
  selectedState, targetState,
  locations: locations.map((row) => [row.id, row.city_id, row.region_id, row.street_id, row.house_number_id]),
  subscriptions: subscriptionIds,
  subscriptionItems: related.subscriptionItems.map((row) => row.id),
  outbox: related.outbox.map((row) => [row.id, row.status]),
  links: related.links.map((row) => row.id),
  pickupDates: related.pickupDates.map((row) => row.id),
  assignmentLocations: related.assignmentLocations,
  counts,
});

export const buildAddressSnapshot = async (
  client: QueryClient,
  input: WasteAddressMutationPreviewInput
): Promise<AddressSnapshot> => {
  const hierarchy = await loadAddressHierarchy(client, input.entityType, input.entityId);
  const idsByType = addressHierarchyIds(hierarchy);
  const selectedColumns = {
    region: 'id, name, updated_at', city: 'id, name, postal_code, region_id, updated_at',
    street: 'id, name, city_id, updated_at', houseNumber: 'id, number, street_id, updated_at',
  } as const;
  const [selectedState, targetState] = await Promise.all([
    queryRows(client, `SELECT ${selectedColumns[input.entityType]} FROM ${input.entityType === 'region' ? 'waste_regions' : input.entityType === 'city' ? 'waste_cities' : input.entityType === 'street' ? 'waste_streets' : 'waste_house_numbers'} WHERE id = $1::uuid`, [input.entityId]).then((rows) => rows[0]),
    loadMoveTargetState(client, input, hierarchy),
  ]);
  if (!selectedState) throw new Error('address_entity_not_found');
  const locations = await loadAffectedLocations(client, input, idsByType);
  const locationIds = ids(locations);
  const [inconsistent, subscriptions] = await Promise.all([
    inconsistentLocationIds(client, locations),
    loadAffectedSubscriptions(client, input.entityType, idsByType),
  ]);
  const subscriptionIds = ids(subscriptions);
  const related = await loadRelatedRows(client, locationIds, subscriptionIds);
  const counts = impactCounts(input, idsByType, locationIds.length, subscriptionIds.length, inconsistent.size, related);
  const token = snapshotToken(input, hierarchy, idsByType, selectedState, targetState, locations, subscriptionIds, related, counts);
  return {
    ...idsByType,
    locationIds,
    subscriptionIds,
    assignmentIds: related.assignmentIds,
    preview: { entityType: input.entityType, entityId: input.entityId, mode: input.mode, ...(input.targetParentId ? { targetParentId: input.targetParentId } : {}), token, counts },
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
