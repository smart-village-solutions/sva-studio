import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mutateWasteAddressInTransaction, previewWasteAddressMutation } from './address-mutations.js';
import { outboxDispatchStatements } from './email-reminders.outbox-dispatch.js';
import { applySchemaStatements } from '../operations/waste-management-operations.schema.js';

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
const schemaName = `waste_address_master_data_test_${randomUUID().replaceAll('-', '')}`;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 2 }) : null;
let client: PoolClient | null = null;
let blockerClient: PoolClient | null = null;
const db = () => {
  if (!client) throw new Error('integration client not initialized');
  return client;
};
const readMainserverRevision = async (): Promise<bigint> => {
  const result = await db().query<{ source_revision: string }>(
    'SELECT source_revision::text FROM waste_mainserver_source_state WHERE id = TRUE'
  );
  const revision = result.rows[0]?.source_revision;
  if (revision === undefined) throw new Error('waste_mainserver_source_state_missing');
  return BigInt(revision);
};

const inTransaction = async (work: () => Promise<unknown>, transactionClient = db()) => {
  await transactionClient.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    const result = await work();
    await transactionClient.query('COMMIT');
    return result;
  } catch (error) {
    await transactionClient.query('ROLLBACK');
    throw error;
  }
};

describe.skipIf(!databaseUrl)('Waste address mutations against PostgreSQL', () => {
  beforeAll(async () => {
    if (!pool) return;
    await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    for (const statement of applySchemaStatements(schemaName)) await pool.query(statement);
    client = await pool.connect();
    await db().query(`SET search_path TO ${schemaName}, public`);
    await db().query("SET application_name = 'waste-address-mutation-primary'");
    blockerClient = await pool.connect();
    await blockerClient.query(`SET search_path TO ${schemaName}, public`);
    await blockerClient.query("SET application_name = 'waste-address-mutation-blocker'");
  }, 60_000);

  afterAll(async () => {
    if (blockerClient) {
      blockerClient.release();
      blockerClient = null;
    }
    if (client) {
      client.release();
      client = null;
    }
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      await pool.end();
    }
  });

  it('requires the current preview and atomically removes address-scoped subscriptions and outbox while preserving neighboring assignments and tours', async () => {
    const regionA = (await db().query<{ id: string }>(`INSERT INTO waste_regions (name) VALUES ('Nord') RETURNING id`)).rows[0]?.id;
    const regionB = (await db().query<{ id: string }>(`INSERT INTO waste_regions (name) VALUES ('Süd') RETURNING id`)).rows[0]?.id;
    const cityA = (await db().query<{ id: string }>(`INSERT INTO waste_cities (name, region_id) VALUES ('Altstadt', $1) RETURNING id`, [regionA])).rows[0]?.id;
    const cityB = (await db().query<{ id: string }>(`INSERT INTO waste_cities (name, region_id) VALUES ('Neustadt', $1) RETURNING id`, [regionB])).rows[0]?.id;
    const cityForCityDelete = (await db().query<{ id: string }>(`INSERT INTO waste_cities (name, region_id) VALUES ('Dorf', $1) RETURNING id`, [regionA])).rows[0]?.id;
    const streetA = (await db().query<{ id: string }>(`INSERT INTO waste_streets (name, city_id) VALUES ('Hauptstraße', $1) RETURNING id`, [cityA])).rows[0]?.id;
    const streetB = (await db().query<{ id: string }>(`INSERT INTO waste_streets (name, city_id) VALUES ('Nebenstraße', $1) RETURNING id`, [cityB])).rows[0]?.id;
    const houseA = (await db().query<{ id: string }>(`INSERT INTO waste_house_numbers (number, street_id) VALUES ('12', $1) RETURNING id`, [streetA])).rows[0]?.id;
    const houseA2 = (await db().query<{ id: string }>(`INSERT INTO waste_house_numbers (number, street_id) VALUES ('14', $1) RETURNING id`, [streetA])).rows[0]?.id;
    const locationA = (await db().query<{ id: string }>(`INSERT INTO waste_collection_locations (city_id, region_id, street_id, house_number_id) VALUES ($1, $2, $3, $4) RETURNING id`, [cityA, regionA, streetA, houseA])).rows[0]?.id;
    const locationA2 = (await db().query<{ id: string }>(`INSERT INTO waste_collection_locations (city_id, region_id, street_id, house_number_id) VALUES ($1, $2, $3, $4) RETURNING id`, [cityA, regionA, streetA, houseA2])).rows[0]?.id;
    const locationB = (await db().query<{ id: string }>(`INSERT INTO waste_collection_locations (city_id, region_id, street_id) VALUES ($1, $2, $3) RETURNING id`, [cityB, regionB, streetB])).rows[0]?.id;
    const cityForRegionDelete = (await db().query<{ id: string }>(`INSERT INTO waste_cities (name, region_id) VALUES ('Dorf Nord', $1) RETURNING id`, [regionA])).rows[0]?.id;
    const streetForRegionDelete = (await db().query<{ id: string }>(`INSERT INTO waste_streets (name, city_id) VALUES ('Dorfstraße', $1) RETURNING id`, [cityForRegionDelete])).rows[0]?.id;
    const houseForRegionDelete = (await db().query<{ id: string }>(`INSERT INTO waste_house_numbers (number, street_id) VALUES ('1', $1) RETURNING id`, [streetForRegionDelete])).rows[0]?.id;
    const locationForRegionDelete = (await db().query<{ id: string }>(`INSERT INTO waste_collection_locations (city_id, region_id, street_id, house_number_id) VALUES ($1, $2, $3, $4) RETURNING id`, [cityForRegionDelete, regionA, streetForRegionDelete, houseForRegionDelete])).rows[0]?.id;
    const tour = (await db().query<{ id: string }>(`INSERT INTO waste_tours (name, status, active) VALUES ('Biotour', 'published', TRUE) RETURNING id`)).rows[0]?.id;
    await db().query(`INSERT INTO waste_location_tour_links (location_id, tour_id) VALUES ($1, $3), ($2, $3)`, [locationA, locationA2, tour]);
    await db().query(`INSERT INTO waste_location_tour_pickup_dates (location_id, tour_id, pickup_date) VALUES ($1, $3, '2026-11-02'), ($2, $3, '2026-11-02')`, [locationA, locationA2, tour]);
    const fraction = (await db().query<{ id: string }>(`INSERT INTO waste_fractions (name, pdf_short_label) VALUES ('Bio', 'Bio') RETURNING id`)).rows[0]?.id;
    const assignment = (await db().query<{ id: string }>(`INSERT INTO waste_tour_assignments (tour_id, pickup_date) VALUES ($1, '2026-11-01') RETURNING id`, [tour])).rows[0]?.id;
    await db().query(`INSERT INTO waste_tour_assignment_locations (assignment_id, collection_location_id) VALUES ($1, $2), ($1, $3)`, [assignment, locationA2, locationB]);
    const emptyAssignment = (await db().query<{ id: string }>(`INSERT INTO waste_tour_assignments (tour_id, pickup_date) VALUES ($1, '2026-11-03') RETURNING id`, [tour])).rows[0]?.id;
    await db().query(`INSERT INTO waste_tour_assignment_locations (assignment_id, collection_location_id) VALUES ($1, $2)`, [emptyAssignment, locationA]);
    await db().query(`INSERT INTO waste_holiday_rules (holiday_date, holiday_name, year, state_code, source_status, configuration_status, conflict_status) VALUES ('2026-12-25', 'Weihnachten', 2026, 'BB', 'confirmed', 'configured', 'none')`);

    const subscription = async (cityId: string, streetId: string, houseNumberId: string | null, suffix: string, status: string) => {
      const row = (await db().query<{ id: string }>(`INSERT INTO waste_email_reminder_subscriptions (email, email_hash, status, region_id, city_id, street_id, house_number_id, location_label, consent_version, consent_accepted_at, doi_token_hash, unsubscribe_token_hash, expires_at) VALUES ('hidden@example.test', $1, $2, $3, $4, $5, $6, 'private label', 'v1', NOW(), $7, $8, NOW() + INTERVAL '1 day') RETURNING id`, [`hash-${suffix}`, status, regionA, cityId, streetId, houseNumberId, `doi-${suffix}`, `unsub-${suffix}`])).rows[0]?.id;
      await db().query(`INSERT INTO waste_email_reminder_subscription_items (subscription_id, fraction_id, slot_id) VALUES ($1, $2, 'slot-1')`, [row, fraction]);
      await db().query(`INSERT INTO waste_email_reminder_outbox (subscription_id, message_kind, transport_id, template_key, send_at, dedupe_key, status, payload) VALUES ($1, 'reminder', 'mail', 'reminder.v1', NOW(), $2, 'sent', '{}'), ($1, 'doi', 'mail', 'doi.v1', NOW(), $3, 'failed', '{}'), ($1, 'reminder', 'mail', 'reminder.v1', NOW(), $4, 'pending', '{}'), ($1, 'reminder', 'mail', 'reminder.v1', NOW(), $5, 'processing', '{}'), ($1, 'reminder', 'mail', 'reminder.v1', NOW(), $6, 'cancelled', '{}')`, [row, `outbox-sent-${suffix}`, `outbox-failed-${suffix}`, `outbox-pending-${suffix}`, `outbox-processing-${suffix}`, `outbox-cancelled-${suffix}`]);
      return row;
    };
    const subscriptionA = await subscription(cityA as string, streetA as string, houseA as string, 'a', 'active');
    await subscription(cityA as string, streetA as string, houseA2 as string, 'a2', 'pending');
    await subscription(cityA as string, streetA as string, houseA2 as string, 'a3', 'unsubscribed');
    await subscription(cityForCityDelete as string, '', null, 'city', 'expired');
    await subscription(cityForRegionDelete as string, streetForRegionDelete as string, houseForRegionDelete as string, 'region-delete', 'active');

    const moveInput = { entityType: 'city' as const, entityId: cityA as string, mode: 'move' as const, targetParentId: regionB as string };
    const movePreview = await previewWasteAddressMutation(db(), moveInput);
    expect(movePreview.counts).toMatchObject({ collectionLocations: 2, locationTourLinks: 2, locationTourPickupDates: 2, emailReminderSubscriptions: 3, emailReminderSubscriptionItems: 3, emailReminderOutbox: 15, sentEmailReminderOutbox: 3 });

    // Force a failure after the mutation has issued its writes. The transaction
    // must restore the parent, subscriptions, their items, and the full outbox.
    await expect(inTransaction(async () => {
      await mutateWasteAddressInTransaction(db(), { ...moveInput, confirmationToken: movePreview.token });
      throw new Error('forced_address_mutation_rollback');
    })).rejects.toThrow('forced_address_mutation_rollback');
    await expect(db().query(`SELECT region_id FROM waste_cities WHERE id = $1`, [cityA])).resolves.toMatchObject({ rows: [{ region_id: regionA }] });
    await expect(db().query(`SELECT id FROM waste_email_reminder_subscriptions WHERE city_id = $1`, [cityA])).resolves.toMatchObject({ rowCount: 3 });
    await expect(db().query(`SELECT id FROM waste_email_reminder_outbox WHERE dedupe_key LIKE 'outbox-%'`)).resolves.toMatchObject({ rowCount: 25 });

    // Hold the selected city row while the confirmed mutation starts. Once
    // the concurrent edit commits, the mutation must reject its stale token.
    const blocker = blockerClient;
    if (!blocker) throw new Error('blocker client not initialized');
    await blocker.query('BEGIN');
    await blocker.query(`UPDATE waste_cities SET name = 'Altstadt aktualisiert' WHERE id = $1`, [cityA]);
    const concurrentMutation = inTransaction(() => mutateWasteAddressInTransaction(db(), {
      ...moveInput,
      confirmationToken: movePreview.token,
    })).then(
      () => ({ error: null }),
      (error: unknown) => ({ error })
    );
    let blocked = false;
    try {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const activity = await blocker.query<{ wait_event_type: string | null }>(
          `SELECT wait_event_type FROM pg_stat_activity WHERE application_name = 'waste-address-mutation-primary' AND state = 'active' LIMIT 1`
        );
        if (activity.rows[0]?.wait_event_type === 'Lock') {
          blocked = true;
          break;
        }
        await blocker.query('SELECT pg_sleep(0.01)');
      }
    } finally {
      await blocker.query('COMMIT');
    }
    const concurrentResult = await concurrentMutation;
    expect(blocked).toBe(true);
    expect(concurrentResult.error).toBeInstanceOf(Error);
    const concurrencyError = concurrentResult.error as Error & { code?: string };
    expect(['address_preview_stale', '40001', '40P01']).toContain(concurrencyError.message === 'address_preview_stale' ? concurrencyError.message : concurrencyError.code);
    await expect(db().query(`SELECT region_id FROM waste_cities WHERE id = $1`, [cityA])).resolves.toMatchObject({ rows: [{ region_id: regionA }] });

    // Refreshing the preview allows the intended move after the concurrent
    // edit; the same token from before the edit is no longer accepted.
    const refreshedMovePreview = await previewWasteAddressMutation(db(), moveInput);
    expect(refreshedMovePreview.token).not.toBe(movePreview.token);
    await inTransaction(() => mutateWasteAddressInTransaction(db(), { ...moveInput, confirmationToken: refreshedMovePreview.token, name: 'Altstadt Neu', postalCode: '19301' }));
    await expect(db().query(`SELECT id FROM waste_email_reminder_subscriptions WHERE id = $1`, [subscriptionA])).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT name, postal_code, region_id FROM waste_cities WHERE id = $1`, [cityA])).resolves.toMatchObject({ rows: [{ name: 'Altstadt Neu', postal_code: '19301', region_id: regionB }] });
    await expect(db().query(`SELECT region_id FROM waste_collection_locations WHERE id = $1`, [locationA])).resolves.toMatchObject({ rows: [{ region_id: regionB }] });

    const streetMoveInput = { entityType: 'street' as const, entityId: streetA as string, mode: 'move' as const, targetParentId: cityB as string };
    const streetMovePreview = await previewWasteAddressMutation(db(), streetMoveInput);
    expect(streetMovePreview.counts.collectionLocations).toBe(2);
    const revisionBeforeStreetMove = await readMainserverRevision();
    await inTransaction(() => mutateWasteAddressInTransaction(db(), { ...streetMoveInput, confirmationToken: streetMovePreview.token, name: 'Hauptstraße Süd' }));
    expect(await readMainserverRevision()).toBeGreaterThan(revisionBeforeStreetMove);
    await expect(db().query(`SELECT name, city_id FROM waste_streets WHERE id = $1`, [streetA])).resolves.toMatchObject({ rows: [{ name: 'Hauptstraße Süd', city_id: cityB }] });
    await expect(db().query(`SELECT city_id, region_id FROM waste_collection_locations WHERE id = $1`, [locationA])).resolves.toMatchObject({ rows: [{ city_id: cityB, region_id: regionB }] });

    const houseMoveInput = { entityType: 'houseNumber' as const, entityId: houseA as string, mode: 'move' as const, targetParentId: streetB as string };
    const houseMovePreview = await previewWasteAddressMutation(db(), houseMoveInput);
    expect(houseMovePreview.counts.collectionLocations).toBe(1);
    const revisionBeforeHouseMove = await readMainserverRevision();
    await inTransaction(() => mutateWasteAddressInTransaction(db(), { ...houseMoveInput, confirmationToken: houseMovePreview.token, number: '12B' }));
    expect(await readMainserverRevision()).toBeGreaterThan(revisionBeforeHouseMove);
    await expect(db().query(`SELECT number, street_id FROM waste_house_numbers WHERE id = $1`, [houseA])).resolves.toMatchObject({ rows: [{ number: '12B', street_id: streetB }] });
    await expect(db().query(`SELECT city_id, region_id, street_id, house_number_id FROM waste_collection_locations WHERE id = $1`, [locationA])).resolves.toMatchObject({ rows: [{ city_id: cityB, region_id: regionB, street_id: streetB, house_number_id: houseA }] });

    const staleDeleteInput = { entityType: 'houseNumber' as const, entityId: houseA2 as string, mode: 'delete' as const };
    const stale = await previewWasteAddressMutation(db(), staleDeleteInput);
    await db().query(`UPDATE waste_house_numbers SET number = '14B' WHERE id = $1`, [houseA2]);
    await expect(inTransaction(() => mutateWasteAddressInTransaction(db(), { ...staleDeleteInput, confirmationToken: stale.token }))).rejects.toThrow('address_preview_stale');
    await expect(db().query(`SELECT id FROM waste_house_numbers WHERE id = $1`, [houseA2])).resolves.toMatchObject({ rowCount: 1 });

    const houseInput = { entityType: 'houseNumber' as const, entityId: houseA as string, mode: 'delete' as const };
    const housePreview = await previewWasteAddressMutation(db(), houseInput);
    expect(housePreview.counts).toMatchObject({ collectionLocations: 1, locationTourLinks: 1, locationTourPickupDates: 1, fullyRemovedTourAssignments: 1, retainedTourAssignments: 0 });
    const revisionBeforeHouseDelete = await readMainserverRevision();
    await inTransaction(() => mutateWasteAddressInTransaction(db(), { ...houseInput, confirmationToken: housePreview.token }));
    expect(await readMainserverRevision()).toBeGreaterThan(revisionBeforeHouseDelete);
    await expect(db().query(`SELECT id FROM waste_house_numbers WHERE id = $1`, [houseA])).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT id FROM waste_tour_assignments WHERE id = $1`, [emptyAssignment])).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT id FROM waste_location_tour_links WHERE location_id = $1`, [locationA])).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT id FROM waste_location_tour_pickup_dates WHERE location_id = $1`, [locationA])).resolves.toMatchObject({ rowCount: 0 });

    const streetInput = { entityType: 'street' as const, entityId: streetA as string, mode: 'delete' as const };
    const streetPreview = await previewWasteAddressMutation(db(), streetInput);
    expect(streetPreview.counts).toMatchObject({ collectionLocations: 1, locationTourLinks: 1, locationTourPickupDates: 1, fullyRemovedTourAssignments: 0, retainedTourAssignments: 1 });
    const revisionBeforeStreetDelete = await readMainserverRevision();
    await inTransaction(() => mutateWasteAddressInTransaction(db(), { ...streetInput, confirmationToken: streetPreview.token }));
    expect(await readMainserverRevision()).toBeGreaterThan(revisionBeforeStreetDelete);
    await expect(db().query(`SELECT id FROM waste_collection_locations WHERE id = $1`, [locationA2])).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT id FROM waste_location_tour_links WHERE location_id = $1`, [locationA2])).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT id FROM waste_location_tour_pickup_dates WHERE location_id = $1`, [locationA2])).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT id FROM waste_tour_assignments WHERE id = $1`, [assignment])).resolves.toMatchObject({ rowCount: 1 });
    await expect(db().query(`SELECT collection_location_id FROM waste_tour_assignment_locations WHERE assignment_id = $1`, [assignment])).resolves.toMatchObject({ rowCount: 1, rows: [{ collection_location_id: locationB }] });
    await expect(db().query(`SELECT id FROM waste_fractions WHERE id = $1`, [fraction])).resolves.toMatchObject({ rowCount: 1 });

    const cityInput = { entityType: 'city' as const, entityId: cityForCityDelete as string, mode: 'delete' as const };
    const cityPreview = await previewWasteAddressMutation(db(), cityInput);
    const revisionBeforeCityDelete = await readMainserverRevision();
    await inTransaction(() => mutateWasteAddressInTransaction(db(), { ...cityInput, confirmationToken: cityPreview.token }));
    expect(await readMainserverRevision()).toBeGreaterThan(revisionBeforeCityDelete);
    await expect(db().query(`SELECT id FROM waste_cities WHERE id = $1`, [cityForCityDelete])).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT id FROM waste_regions WHERE id = $1`, [regionA])).resolves.toMatchObject({ rowCount: 1 });
    const regionInput = { entityType: 'region' as const, entityId: regionA as string, mode: 'delete' as const };
    const claimedBeforeDeleteAt = '2026-11-01T12:00:00.000Z';
    const claimedBeforeDeleteOutbox = (await db().query<{ id: string }>(
      `UPDATE waste_email_reminder_outbox SET status = 'processing', leased_at = $1, last_error = NULL WHERE dedupe_key = 'outbox-pending-region-delete' RETURNING id`,
      [claimedBeforeDeleteAt]
    )).rows[0]?.id;
    expect(claimedBeforeDeleteOutbox).toBeTruthy();
    const regionPreview = await previewWasteAddressMutation(db(), regionInput);
    expect(regionPreview.counts).toMatchObject({ regions: 1, cities: 1, streets: 1, houseNumbers: 1, collectionLocations: 1, emailReminderSubscriptions: 1, emailReminderSubscriptionItems: 1, emailReminderOutbox: 5, sentEmailReminderOutbox: 1 });
    const revisionBeforeRegionDelete = await readMainserverRevision();
    await inTransaction(() => mutateWasteAddressInTransaction(db(), { ...regionInput, confirmationToken: regionPreview.token }));
    expect(await readMainserverRevision()).toBeGreaterThan(revisionBeforeRegionDelete);
    const dispatchClaim = outboxDispatchStatements.claimOutboxEntryForDispatch({
      outboxId: claimedBeforeDeleteOutbox as string,
      leasedAt: claimedBeforeDeleteAt,
    });
    await expect(db().query(dispatchClaim.text, dispatchClaim.values)).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT id FROM waste_collection_locations WHERE id = $1`, [locationForRegionDelete])).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT id FROM waste_cities WHERE id = $1`, [cityForRegionDelete])).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT id FROM waste_streets WHERE id = $1`, [streetForRegionDelete])).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT id FROM waste_house_numbers WHERE id = $1`, [houseForRegionDelete])).resolves.toMatchObject({ rowCount: 0 });

    await expect(db().query(`SELECT id FROM waste_collection_locations WHERE id = $1`, [locationB])).resolves.toMatchObject({ rowCount: 1 });
    await expect(db().query(`SELECT id FROM waste_cities WHERE id = $1 AND region_id = $2`, [cityB, regionB])).resolves.toMatchObject({ rowCount: 1 });
    await expect(db().query(`SELECT id FROM waste_regions WHERE id = $1`, [regionA])).resolves.toMatchObject({ rowCount: 0 });
    await expect(db().query(`SELECT id FROM waste_tours WHERE id = $1`, [tour])).resolves.toMatchObject({ rowCount: 1 });
    await expect(db().query(`SELECT id FROM waste_holiday_rules`)).resolves.toMatchObject({ rowCount: 1 });
    await expect(db().query(`SELECT id FROM waste_email_reminder_outbox WHERE dedupe_key LIKE 'outbox-%'`)).resolves.toMatchObject({ rowCount: 0 });

    const unassignCityInput = { entityType: 'city' as const, entityId: cityB as string, mode: 'move' as const };
    const unassignPreview = await previewWasteAddressMutation(db(), unassignCityInput);
    expect(unassignPreview.counts).toMatchObject({ collectionLocations: 1, emailReminderSubscriptions: 0 });
    await inTransaction(() => mutateWasteAddressInTransaction(db(), {
      ...unassignCityInput,
      confirmationToken: unassignPreview.token,
    }));
    await expect(db().query(`SELECT region_id FROM waste_cities WHERE id = $1`, [cityB])).resolves.toMatchObject({ rows: [{ region_id: null }] });
    await expect(db().query(`SELECT region_id FROM waste_collection_locations WHERE id = $1`, [locationB])).resolves.toMatchObject({ rows: [{ region_id: null }] });
  }, 60_000);
});
