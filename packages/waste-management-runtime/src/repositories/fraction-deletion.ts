import { fractionDeletionReminders } from './fraction-deletion.reminders.js';
/** Preview and atomic single-fraction deletion in the already resolved tenant database. */
import { createHash } from 'node:crypto';
import type {
  WasteFractionDeleteInput,
  WasteFractionDeletePreview,
} from '@sva/waste-management-contracts';
import { createWasteMasterDataRepository } from './master-data.js';
import { createSqlExecutor } from '../operations/waste-management-operations.shared.js';
import { queryRows, type QueryClient } from './address-mutation-shared.js';
import {
  findFractionReplacementConflicts,
  replaceFractionIds,
} from './fraction-delete-conflicts.js';

const ordered = <T extends { readonly id: string }>(rows: readonly T[]): readonly T[] =>
  [...rows].sort((a, b) => a.id.localeCompare(b.id));

const loadSnapshotData = async (client: QueryClient, input: WasteFractionDeleteInput) => {
  const repository = createWasteMasterDataRepository(createSqlExecutor(client));
  const fractions = ordered(await repository.listWasteFractions());
  if (!fractions.some((f) => f.id === input.fractionId)) throw new Error('fraction_not_found');
  const state = {
    tours: ordered(await repository.listWasteTours()),
    links: ordered(await repository.listWasteLocationTourLinks()),
    locationTourPickupDates: ordered(await repository.listWasteLocationTourPickupDates()),
    tourAssignments: ordered(await repository.listWasteTourAssignments()),
    tourDateShifts: ordered(await repository.listWasteTourDateShifts()),
    globalDateShifts: ordered(await repository.listWasteGlobalDateShifts()),
    holidayRules: ordered(await repository.listWasteHolidayRules()),
  };
  const tours = state.tours.filter((tour) => tour.wasteFractionIds.includes(input.fractionId));
  const tourIds = new Set(tours.map((tour) => tour.id));
  const assignmentRows = await queryRows(
    client,
    'SELECT id, tour_id, pickup_date::text, note, updated_at::text FROM waste_tour_assignments WHERE tour_id = ANY($1::uuid[]) ORDER BY id',
    [[...tourIds]]
  );
  const items = await queryRows(
    client,
    'SELECT id FROM waste_email_reminder_subscription_items WHERE fraction_id = $1::uuid ORDER BY id',
    [input.fractionId]
  );
  const locations = ordered(await repository.listWasteCollectionLocations());
  return { fractions, state, tours, tourIds, assignmentRows, items, locations };
};
type SnapshotData = Awaited<ReturnType<typeof loadSnapshotData>>;

const labelConflicts = async (
  client: QueryClient,
  conflicts: WasteFractionDeletePreview['conflicts'],
  state: SnapshotData['state']
): Promise<WasteFractionDeletePreview['conflicts']> => {
  if (!conflicts.length) return conflicts;
  const labels = await queryRows<{ id: string; label: string }>(
    client,
    `
      SELECT l.id::text, concat_ws(', ', c.name, s.name, h.number) AS label
      FROM waste_collection_locations l JOIN waste_cities c ON c.id = l.city_id
      LEFT JOIN waste_streets s ON s.id = l.street_id
      LEFT JOIN waste_house_numbers h ON h.id = l.house_number_id
      WHERE l.id = ANY($1::uuid[]) ORDER BY l.id`,
    [[...new Set(conflicts.map((conflict) => conflict.locationId))]]
  );
  return conflicts.map((conflict) => ({
    ...conflict,
    tourNames: conflict.tourIds.map((id) => state.tours.find((tour) => tour.id === id)?.name ?? id),
    locationLabel:
      labels.find((label) => label.id === conflict.locationId)?.label ?? conflict.locationId,
  }));
};
const buildPreview = (
  input: WasteFractionDeleteInput,
  data: SnapshotData,
  reminders: Awaited<ReturnType<typeof fractionDeletionReminders>>,
  conflicts: WasteFractionDeletePreview['conflicts'],
  blockedReason: WasteFractionDeletePreview['blockedReason']
): WasteFractionDeletePreview => {
  const { fractions, state, tours, tourIds, assignmentRows, items, locations } = data;
  const { outbox, cancelledOutboxIds } = reminders;
  return {
    input,
    token: createHash('sha256')
      .update(
        JSON.stringify({
          input,
          fractions,
          state,
          locations,
          assignmentRows,
          items,
          outbox,
          conflicts,
        })
      )
      .digest('hex'),
    canDetach: tours.every((tour) => tour.wasteFractionIds.length > 1),
    targets: fractions
      .filter((f) => f.id !== input.fractionId && f.active)
      .map(({ id, name }) => ({ id, name })),
    tours: tours.map((tour) => ({
      id: tour.id,
      name: tour.name,
      status: tour.status,
      otherFractions: tour.wasteFractionIds
        .filter((id) => id !== input.fractionId)
        .map((id) => fractions.find((f) => f.id === id)?.name ?? id),
    })),
    counts: {
      links: state.links.filter((link) => tourIds.has(link.tourId)).length,
      pickupDates: state.locationTourPickupDates.filter((date) => tourIds.has(date.tourId)).length,
      assignments: assignmentRows.length,
      shifts: state.tourDateShifts.filter((shift) => tourIds.has(shift.tourId)).length,
      reminderItems: items.length,
      pendingReminders: cancelledOutboxIds.size,
    },
    conflicts,
    blockedReason,
  };
};
const checkDeletion = (input: WasteFractionDeleteInput, data: SnapshotData) => {
  const { tours, fractions, state } = data;
  const canDetach = tours.every((tour) => tour.wasteFractionIds.length > 1);
  let blockedReason: WasteFractionDeletePreview['blockedReason'] =
    input.mode === 'detach' && !canDetach ? 'empty-tour' : null;
  let conflicts: WasteFractionDeletePreview['conflicts'] = [];
  if (input.mode === 'replace') {
    if (
      !input.targetFractionId ||
      input.targetFractionId === input.fractionId ||
      !fractions.some((f) => f.id === input.targetFractionId && f.active)
    )
      blockedReason = 'invalid-target';
    else
      ({ conflicts, blockedReason } = findFractionReplacementConflicts(
        state,
        input.fractionId,
        input.targetFractionId
      ));
  }
  return { conflicts, blockedReason };
};
const snapshot = async (client: QueryClient, input: WasteFractionDeleteInput) => {
  const data = await loadSnapshotData(client, input);
  const { state, tours, tourIds, locations } = data;
  const nextTours = state.tours.flatMap((tour) =>
    !tourIds.has(tour.id)
      ? [tour]
      : input.mode === 'delete-tours'
        ? []
        : [
            {
              ...tour,
              wasteFractionIds: replaceFractionIds(
                tour.wasteFractionIds,
                input.fractionId,
                input.mode === 'replace' ? input.targetFractionId : undefined
              ),
            },
          ]
  );
  const { outbox, cancelledOutboxIds } = await fractionDeletionReminders(
    client,
    input,
    state,
    tours,
    nextTours,
    locations
  );
  let { conflicts, blockedReason } = checkDeletion(input, data);
  // An already claimed external delivery cannot be revoked by a database rollback.
  if (
    outbox.some(
      (row) =>
        cancelledOutboxIds.has(row.id) &&
        row.status === 'processing' &&
        row.last_error === 'dispatch_claimed'
    )
  )
    blockedReason = 'reminder-dispatching';
  conflicts = await labelConflicts(client, conflicts, state);
  const preview = buildPreview(
    input,
    data,
    { outbox, cancelledOutboxIds },
    conflicts,
    blockedReason
  );
  return { preview, tours, nextTours, cancelledOutboxIds };
};

export const processWasteFractionDeletion = async (
  client: QueryClient,
  input: WasteFractionDeleteInput,
  confirmationToken?: string
): Promise<WasteFractionDeletePreview> => {
  const execute = confirmationToken !== undefined;
  await client.query(execute ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    if (execute) {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '15s'");
      // Infrequent destructive operation: tenant-local table locks also exclude phantom inserts
      // from existing READ COMMITTED writers. The relation writer always locks waste_tours first.
      await client.query(`LOCK TABLE waste_fractions, waste_tours, waste_custom_recurrence_presets,
        waste_collection_locations, waste_location_tour_links, waste_location_tour_pickup_dates,
        waste_tour_assignments, waste_tour_assignment_locations, waste_tour_date_shifts,
        waste_global_date_shifts, waste_holiday_rules, waste_email_reminder_subscriptions,
        waste_email_reminder_subscription_items, waste_email_reminder_outbox IN SHARE ROW EXCLUSIVE MODE`);
    }
    const current = await snapshot(client, input);
    if (execute) {
      if (current.preview.token !== confirmationToken) throw new Error('fraction_preview_stale');
      if (current.preview.blockedReason)
        throw new Error(`fraction_delete_blocked:${current.preview.blockedReason}`);
      if (current.cancelledOutboxIds.size)
        await client.query(
          `UPDATE waste_email_reminder_outbox
        SET status = 'cancelled', leased_at = NULL, last_error = 'reminder_no_longer_applicable', updated_at = NOW()
        WHERE id = ANY($1::uuid[])`,
          [[...current.cancelledOutboxIds]]
        );
      if (input.mode === 'delete-tours') {
        await client.query('DELETE FROM waste_tours WHERE id = ANY($1::uuid[])', [
          current.tours.map((tour) => tour.id),
        ]);
      } else {
        for (const tour of current.tours) {
          const next = current.nextTours.find((candidate) => candidate.id === tour.id)!;
          await client.query('SELECT replace_waste_tour_fractions($1::uuid, $2::text[])', [
            tour.id,
            next.wasteFractionIds,
          ]);
          await client.query('UPDATE waste_tours SET updated_at = NOW() WHERE id = $1::uuid', [
            tour.id,
          ]);
        }
      }
      await client.query('DELETE FROM waste_fractions WHERE id = $1::uuid', [input.fractionId]);
    }
    await client.query('COMMIT');
    return current.preview;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};
