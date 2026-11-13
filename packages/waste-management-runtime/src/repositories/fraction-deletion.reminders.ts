/** Reconcile affected pending reminders against the surviving tour schedule. */
import type {
  WasteFractionDeleteInput,
  WasteTourRecord,
  WasteCollectionLocationRecord,
} from '@sva/waste-management-contracts';
import type { WasteMaterializationContext } from '../operations/waste-management-mainserver-sync.materialization.shared.js';
import { buildMaterializedLocationTourPickupDates } from '../operations/waste-management-mainserver-sync.materialization.js';
import { matchSelectionLocations } from '../operations/waste-management-email-reminder-dispatch.server.js';
import { queryRows, type QueryClient } from './address-mutation-shared.js';
type OutboxRow = Readonly<{
  id: string;
  dedupe_key: string;
  status: string;
  last_error: string | null;
  region_id: string | null;
  city_id: string;
  street_id: string;
  house_number_id: string | null;
}>;
const loadOutbox = async (
  client: QueryClient,
  input: WasteFractionDeleteInput,
  tours: readonly WasteTourRecord[]
) => {
  const relatedFractionIds = [
    ...new Set([
      input.fractionId,
      ...(input.mode === 'delete-tours' ? tours.flatMap((tour) => tour.wasteFractionIds) : []),
    ]),
  ];
  // Dedupe keys have a fixed subscription UUID and fraction UUID prefix; slot IDs may contain colons.
  const outbox = await queryRows<OutboxRow>(
    client,
    `
    SELECT o.id::text, o.dedupe_key, o.status, o.last_error,
      s.region_id::text, s.city_id::text, s.street_id, s.house_number_id::text
    FROM waste_email_reminder_outbox o JOIN waste_email_reminder_subscriptions s ON s.id = o.subscription_id
    WHERE o.message_kind = 'reminder' AND o.status IN ('pending', 'processing', 'failed')
      AND split_part(o.dedupe_key, ':', 3) = ANY($1::text[]) ORDER BY o.id`,
    [relatedFractionIds]
  );
  return outbox;
};
const cancelledReminders = (
  outbox: readonly OutboxRow[],
  input: WasteFractionDeleteInput,
  state: Omit<WasteMaterializationContext, 'currentYear' | 'nextYear'>,
  nextTours: readonly WasteTourRecord[],
  locations: readonly WasteCollectionLocationRecord[]
) => {
  const cancelledOutboxIds = new Set(
    outbox.filter((row) => row.dedupe_key.split(':')[2] === input.fractionId).map((row) => row.id)
  );
  if (input.mode === 'delete-tours' && outbox.length) {
    // Keep reminders for surviving pickups; cancel only keys that lose their last effective pickup.
    const dates = outbox.map((row) => row.dedupe_key.slice(-10));
    const shiftDates = [...state.tourDateShifts, ...state.globalDateShifts]
      .filter((shift) => shift.hasYear)
      .flatMap((shift) => [shift.originalDate, shift.actualDate]);
    const years = [
      ...new Set(
        [...dates, ...shiftDates].flatMap((date) => {
          const year = Number(date.slice(0, 4));
          return [year - 1, year, year + 1];
        })
      ),
    ].sort((a, b) => a - b);
    const occurrences = buildMaterializedLocationTourPickupDates({
      ...state,
      tours: nextTours,
      years,
      currentYear: years[0],
      nextYear: years.at(-1)!,
    });
    const nextTourById = new Map(nextTours.map((tour) => [tour.id, tour]));
    for (const row of outbox) {
      const fractionId = row.dedupe_key.split(':')[2];
      const date = row.dedupe_key.slice(-10);
      const matching = new Set(
        matchSelectionLocations(locations, {
          regionId: row.region_id ?? undefined,
          cityId: row.city_id,
          streetId: row.street_id,
          houseNumberId: row.house_number_id ?? undefined,
        }).map((location) => location.id)
      );
      if (
        !occurrences.some(
          (occurrence) =>
            matching.has(occurrence.locationId) &&
            occurrence.pickupDate === date &&
            nextTourById.get(occurrence.tourId)?.wasteFractionIds.includes(fractionId)
        )
      ) {
        cancelledOutboxIds.add(row.id);
      }
    }
  }
  return cancelledOutboxIds;
};
export const fractionDeletionReminders = async (
  client: QueryClient,
  input: WasteFractionDeleteInput,
  state: Omit<WasteMaterializationContext, 'currentYear' | 'nextYear'>,
  tours: readonly WasteTourRecord[],
  nextTours: readonly WasteTourRecord[],
  locations: readonly WasteCollectionLocationRecord[]
) => {
  const outbox = await loadOutbox(client, input, tours);
  return {
    outbox,
    cancelledOutboxIds: cancelledReminders(outbox, input, state, nextTours, locations),
  };
};
