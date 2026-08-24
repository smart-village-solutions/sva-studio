import type { WasteAnnualTourTransferMappedTour } from '@sva/core';
import type { WasteMasterDataRepository } from '@sva/data-repositories';

type AnnualTourTransferClient = Readonly<{
  query: (text: string, values?: readonly unknown[]) => Promise<unknown>;
}>;

const serialRelationshipLimit = 100;
const writeBatchSize = 1_000;

const executeJsonBatches = async <T>(
  client: AnnualTourTransferClient,
  items: readonly T[],
  statement: string
): Promise<void> => {
  for (let offset = 0; offset < items.length; offset += writeBatchSize) {
    await client.query(statement, [
      JSON.stringify(items.slice(offset, offset + writeBatchSize)),
    ]);
  }
};

const writeTours = async (
  client: AnnualTourTransferClient,
  mappedTours: readonly WasteAnnualTourTransferMappedTour[]
): Promise<void> =>
  executeJsonBatches(
    client,
    mappedTours.map(({ targetTour }) => ({
      id: targetTour.id,
      name: targetTour.name,
      description: targetTour.description ?? null,
      waste_fraction_ids: targetTour.wasteFractionIds,
      recurrence: targetTour.recurrence ?? null,
      custom_recurrence_id: targetTour.customRecurrenceId ?? null,
      first_date: targetTour.firstDate ?? null,
      end_date: targetTour.endDate ?? null,
      custom_dates: targetTour.customDates ?? null,
      active: targetTour.active,
    })),
    `
INSERT INTO waste_tours (
  id, name, description, waste_fraction_ids, recurrence, custom_recurrence_id,
  first_date, end_date, custom_dates, active
)
SELECT
  item.id::uuid, item.name, item.description, item.waste_fraction_ids, item.recurrence,
  item.custom_recurrence_id::uuid, item.first_date::date, item.end_date::date,
  item.custom_dates, item.active
FROM jsonb_to_recordset($1::jsonb) AS item(
  id text,
  name text,
  description text,
  waste_fraction_ids text[],
  recurrence text,
  custom_recurrence_id text,
  first_date text,
  end_date text,
  custom_dates jsonb,
  active boolean
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    waste_fraction_ids = EXCLUDED.waste_fraction_ids,
    recurrence = EXCLUDED.recurrence,
    custom_recurrence_id = EXCLUDED.custom_recurrence_id,
    first_date = EXCLUDED.first_date,
    end_date = EXCLUDED.end_date,
    custom_dates = EXCLUDED.custom_dates,
    active = EXCLUDED.active,
    updated_at = NOW();`
  );

const writeLinks = async (
  client: AnnualTourTransferClient,
  mappedTours: readonly WasteAnnualTourTransferMappedTour[]
): Promise<void> =>
  executeJsonBatches(
    client,
    mappedTours.flatMap((mapped) =>
      mapped.locationTourLinks.map((item) => ({
        id: item.id,
        location_id: item.locationId,
        tour_id: item.tourId,
      }))
    ),
    `
INSERT INTO waste_location_tour_links (id, location_id, tour_id)
SELECT item.id::uuid, item.location_id::uuid, item.tour_id::uuid
FROM jsonb_to_recordset($1::jsonb) AS item(id text, location_id text, tour_id text);`
  );

const writePickupDates = async (
  client: AnnualTourTransferClient,
  mappedTours: readonly WasteAnnualTourTransferMappedTour[]
): Promise<void> =>
  executeJsonBatches(
    client,
    mappedTours.flatMap((mapped) =>
      mapped.locationTourPickupDates.map((item) => ({
        id: item.id,
        location_id: item.locationId,
        tour_id: item.tourId,
        pickup_date: item.pickupDate,
        note: item.note,
      }))
    ),
    `
INSERT INTO waste_location_tour_pickup_dates (id, location_id, tour_id, pickup_date, note)
SELECT item.id::uuid, item.location_id::uuid, item.tour_id::uuid, item.pickup_date::date, item.note
FROM jsonb_to_recordset($1::jsonb) AS item(
  id text,
  location_id text,
  tour_id text,
  pickup_date text,
  note text
);`
  );

const writeAssignments = async (
  client: AnnualTourTransferClient,
  mappedTours: readonly WasteAnnualTourTransferMappedTour[]
): Promise<void> =>
  executeJsonBatches(
    client,
    mappedTours.flatMap((mapped) =>
      mapped.tourAssignments.map((item) => ({
        id: item.id,
        tour_id: item.tourId,
        pickup_date: item.pickupDate,
        note: item.note,
        location_ids: item.locationIds,
      }))
    ),
    `
WITH input AS MATERIALIZED (
  SELECT
    item.id::uuid AS id,
    item.tour_id::uuid AS tour_id,
    item.pickup_date::date AS pickup_date,
    item.note,
    item.location_ids
  FROM jsonb_to_recordset($1::jsonb) AS item(
    id text,
    tour_id text,
    pickup_date text,
    note text,
    location_ids jsonb
  )
), saved AS (
  INSERT INTO waste_tour_assignments (id, tour_id, pickup_date, note)
  SELECT id, tour_id, pickup_date, note FROM input
  RETURNING id
)
INSERT INTO waste_tour_assignment_locations (assignment_id, collection_location_id)
SELECT input.id, location_id.value::uuid
FROM input
INNER JOIN saved ON saved.id = input.id
CROSS JOIN LATERAL jsonb_array_elements_text(input.location_ids) AS location_id(value);`
  );

const writeShifts = async (
  client: AnnualTourTransferClient,
  mappedTours: readonly WasteAnnualTourTransferMappedTour[]
): Promise<void> =>
  executeJsonBatches(
    client,
    mappedTours.flatMap((mapped) =>
      mapped.tourDateShifts.map((item) => ({
        id: item.id,
        tour_id: item.tourId,
        original_date: item.originalDate,
        actual_date: item.actualDate,
        has_year: item.hasYear,
        reason_type: item.reasonType ?? null,
        reason_key: item.reasonKey ?? null,
        follow_up_mode: item.followUpMode ?? null,
        description: item.description ?? null,
      }))
    ),
    `
INSERT INTO waste_tour_date_shifts (
  id,
  tour_id,
  original_date,
  actual_date,
  has_year,
  reason_type,
  reason_key,
  follow_up_mode,
  description
)
SELECT
  item.id::uuid,
  item.tour_id::uuid,
  item.original_date::date,
  item.actual_date::date,
  item.has_year,
  item.reason_type,
  item.reason_key,
  item.follow_up_mode,
  item.description
FROM jsonb_to_recordset($1::jsonb) AS item(
  id text,
  tour_id text,
  original_date text,
  actual_date text,
  has_year boolean,
  reason_type text,
  reason_key text,
  follow_up_mode text,
  description text
);`
  );

const writeRelationshipsSerial = async (
  repository: WasteMasterDataRepository,
  mapped: WasteAnnualTourTransferMappedTour
): Promise<void> => {
  for (const link of mapped.locationTourLinks) await repository.upsertWasteLocationTourLink(link);
  for (const pickupDate of mapped.locationTourPickupDates) {
    await repository.upsertWasteLocationTourPickupDate(pickupDate);
  }
  for (const assignment of mapped.tourAssignments) {
    await repository.upsertWasteTourAssignment(assignment);
  }
  for (const shift of mapped.tourDateShifts) await repository.insertWasteTourDateShift(shift);
};

export const writeWasteAnnualMappedTours = async (
  client: AnnualTourTransferClient,
  repository: WasteMasterDataRepository,
  mappedTours: readonly WasteAnnualTourTransferMappedTour[]
): Promise<void> => {
  await writeTours(client, mappedTours);
  const relationshipCount = mappedTours.reduce(
    (count, mapped) =>
      count +
      mapped.locationTourLinks.length +
      mapped.locationTourPickupDates.length +
      mapped.tourAssignments.length +
      mapped.tourDateShifts.length,
    0
  );
  if (relationshipCount <= serialRelationshipLimit) {
    for (const mapped of mappedTours) await writeRelationshipsSerial(repository, mapped);
    return;
  }
  await writeLinks(client, mappedTours);
  await writePickupDates(client, mappedTours);
  await writeAssignments(client, mappedTours);
  await writeShifts(client, mappedTours);
};
