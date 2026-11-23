/** Reconcile affected pending reminders against the surviving tour schedule. */
import type {
  WasteFractionDeleteInput,
  WasteTourRecord,
  WasteCollectionLocationRecord,
} from '@sva/waste-management-contracts';
import type { WasteMaterializationContext } from '../operations/waste-management-mainserver-sync.materialization.shared.js';
import { buildMaterializedLocationTourPickupDates } from '../operations/waste-management-mainserver-sync.materialization.js';
import { matchSelectionLocations } from '../operations/waste-management-email-reminder-planning.js';
import { queryRows, type QueryClient } from './address-mutation-shared.js';
import { REMINDER_OUTCOME_UNKNOWN } from './email-reminders.outbox-dispatch.js';
type OutboxRow = Readonly<{
  id: string;
  dedupe_key: string;
  status: string;
  last_error: string | null;
  member_keys: readonly string[];
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
  // Both formats use the same member keys. Slot IDs may contain colons.
  const outbox = await queryRows<OutboxRow>(
    client,
    `
    SELECT o.id::text, o.dedupe_key, o.status, o.last_error, members.member_keys,
      s.region_id::text, s.city_id::text, s.street_id, s.house_number_id::text
    FROM waste_email_reminder_outbox o JOIN waste_email_reminder_subscriptions s ON s.id = o.subscription_id
    CROSS JOIN LATERAL (
      SELECT ARRAY(
        SELECT jsonb_array_elements_text(
          COALESCE((o.payload->'metadata'->>'reminderMemberKeys')::jsonb, to_jsonb(ARRAY[o.dedupe_key]))
        )
      ) AS member_keys
    ) members
    WHERE o.message_kind = 'reminder' AND o.status IN ('pending', 'processing', 'failed')
      AND o.last_error IS DISTINCT FROM $2
      AND (o.status <> 'failed' OR o.dedupe_key NOT LIKE 'reminder-group:%')
      AND EXISTS (SELECT 1 FROM unnest(members.member_keys) AS member(key)
        WHERE split_part(member.key, ':', 3) = ANY($1::text[]))
    ORDER BY o.id`,
    [relatedFractionIds, REMINDER_OUTCOME_UNKNOWN]
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
    outbox
      .filter((row) => row.member_keys.some((key) => key.split(':')[2] === input.fractionId))
      .map((row) => row.id)
  );
  if (input.mode === 'delete-tours' && outbox.length) {
    // Keep reminders for surviving pickups; cancel only keys that lose their last effective pickup.
    const dates = outbox.flatMap((row) => row.member_keys.map((key) => key.slice(-10)));
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
      const matching = new Set(
        matchSelectionLocations(locations, {
          regionId: row.region_id ?? undefined,
          cityId: row.city_id,
          streetId: row.street_id,
          houseNumberId: row.house_number_id ?? undefined,
        }).map((location) => location.id)
      );
      if (
        row.member_keys.some(
          (key) =>
            !occurrences.some(
              (occurrence) =>
                matching.has(occurrence.locationId) &&
                occurrence.pickupDate === key.slice(-10) &&
                nextTourById.get(occurrence.tourId)?.wasteFractionIds.includes(key.split(':')[2])
            )
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
