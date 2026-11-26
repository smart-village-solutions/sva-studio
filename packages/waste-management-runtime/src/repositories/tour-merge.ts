import { createHash } from 'node:crypto';
import { createSdkLogger } from '@sva/server-runtime';
import {
  isWasteTourGlobalDateShiftApplicable,
  isWasteTourValidityApplicable,
  type WasteTourMergeConflict,
  type WasteTourMergeInput,
  type WasteTourMergeResult,
  type WasteTourRecord,
  type WasteTourDateShiftRecord,
} from '@sva/waste-management-contracts';
import { createSqlExecutor } from '../operations/waste-management-operations.shared.js';
import { queryRows, type QueryClient } from './address-mutation-shared.js';
import { createWasteMasterDataRepository } from './master-data.js';

const logger = createSdkLogger({ component: 'waste-management-tour-merge' });

const encode = (value: unknown) => JSON.stringify(value);
const ordered = <T extends { readonly id: string }>(rows: readonly T[]) =>
  [...rows].sort((a, b) => a.id.localeCompare(b.id));

const shiftPlan = (shift: WasteTourDateShiftRecord) =>
  encode([
    shift.originalDate,
    shift.actualDate,
    shift.hasYear,
    shift.followUpMode,
    shift.reasonType,
    shift.reasonKey,
    shift.description,
  ]);

const hasSameRecurringPlan = (tour: WasteTourRecord, target: WasteTourRecord) =>
  Boolean(tour.firstDate) &&
  isWasteTourValidityApplicable(tour) &&
  isWasteTourGlobalDateShiftApplicable(tour) &&
  tour.recurrence === target.recurrence &&
  tour.customRecurrenceIntervalDays === target.customRecurrenceIntervalDays;

const sameValidity = (a: WasteTourRecord, b: WasteTourRecord) =>
  a.firstDate === b.firstDate && a.endDate === b.endDate;

const readMergePlan = async (client: QueryClient, input: WasteTourMergeInput) => {
  const repository = createWasteMasterDataRepository(createSqlExecutor(client));
  const ids = [...input.tourIds].sort();
  const selected = new Set(ids);
  const tours = ordered(
    (await repository.listWasteTours()).filter((tour) => selected.has(tour.id))
  );
  const target = tours.find((tour) => tour.id === input.targetTourId);
  if (!target || tours.length !== ids.length) return null;

  const links = await queryRows<{ id: string; tour_id: string; location_id: string }>(
    client,
    'SELECT id, tour_id, location_id FROM waste_location_tour_links WHERE tour_id = ANY($1::uuid[]) ORDER BY id',
    [ids]
  );
  const shifts = ordered(
    (await repository.listWasteTourDateShifts()).filter((shift) => selected.has(shift.tourId))
  );
  const globals = ordered(await repository.listWasteGlobalDateShifts());
  const individualTours = await queryRows<{ tour_id: string }>(
    client,
    `
    SELECT tour_id FROM waste_tour_assignments WHERE tour_id = ANY($1::uuid[])
    UNION SELECT tour_id FROM waste_location_tour_pickup_dates WHERE tour_id = ANY($1::uuid[])
    ORDER BY tour_id`,
    [ids]
  );
  const holidays = ordered(await repository.listWasteHolidayRules());

  return { ids, tours, target, links, shifts, globals, individualTours, holidays };
};

type MergePlan = NonNullable<Awaited<ReturnType<typeof readMergePlan>>>;

const measureCollectionPoints = ({ ids, links, target }: MergePlan) => {
  const locationsByTour = new Map(ids.map((id) => [id, new Set<string>()]));
  for (const link of links) locationsByTour.get(link.tour_id)!.add(link.location_id);
  const targetLocations = locationsByTour.get(target.id)!;
  const seenLocations = new Set<string>();
  const shared = new Set<string>();
  for (const locations of locationsByTour.values()) {
    for (const id of locations) {
      if (seenLocations.has(id)) shared.add(id);
      seenLocations.add(id);
    }
  }
  const added = [...seenLocations].filter((id) => !targetLocations.has(id));
  return { locationsByTour, added, totalCount: seenLocations.size, shared, targetLocations };
};

const identifyPlanConflicts = ({ tours, target, shifts, globals, individualTours }: MergePlan) => {
  const specificShifts = (tourId: string) =>
    shifts
      .filter((shift) => shift.tourId === tourId)
      .map(shiftPlan)
      .sort();
  const scopedShifts = (tourId: string) =>
    globals.filter((shift) => shift.tourIds?.includes(tourId)).map((shift) => shift.id);
  const conflicts: WasteTourMergeConflict[] = [];
  for (const tour of tours) {
    const add = (reason: WasteTourMergeConflict['reason']) =>
      conflicts.push({ tourId: tour.id, reason });
    if (tour.status !== 'published') add('status');
    if (!hasSameRecurringPlan(tour, target)) add('recurrence');
    if (!sameValidity(tour, target)) add('validity');
    if (encode([...tour.wasteFractionIds].sort()) !== encode([...target.wasteFractionIds].sort()))
      add('fractions');
    if (tour.description !== target.description) add('notes');
    if (
      encode(tour.customDates ?? []) !== encode(target.customDates ?? []) ||
      encode(specificShifts(tour.id)) !== encode(specificShifts(target.id)) ||
      encode(scopedShifts(tour.id)) !== encode(scopedShifts(target.id))
    )
      add('shifts');
    if (individualTours.some((row) => row.tour_id === tour.id)) add('assignments');
  }
  return conflicts;
};

const readSnapshot = async (client: QueryClient, input: WasteTourMergeInput) => {
  const plan = await readMergePlan(client, input);
  if (!plan) return null;
  const { tours, target, links } = plan;
  const { locationsByTour, added, totalCount, shared, targetLocations } =
    measureCollectionPoints(plan);
  const conflicts = identifyPlanConflicts(plan);
  if (targetLocations.size !== links.filter((link) => link.tour_id === target.id).length)
    conflicts.push({ tourId: target.id, reason: 'duplicateLinks' });

  const [sharedLocation] =
    shared.size === 1
      ? await queryRows<{ label: string }>(
          client,
          `
      SELECT concat_ws(' / ', c.name, s.name, h.number) AS label
      FROM waste_collection_locations l JOIN waste_cities c ON c.id = l.city_id
      LEFT JOIN waste_streets s ON s.id = l.street_id
      LEFT JOIN waste_house_numbers h ON h.id = l.house_number_id
      WHERE l.id = $1::uuid`,
          [[...shared][0]]
        )
      : [];
  return {
    added,
    preview: {
      token: createHash('sha256')
        .update(encode([plan, sharedLocation]))
        .digest('hex'),
      tours: tours.map(
        ({
          id,
          name,
          status,
          recurrence,
          customRecurrenceName,
          customRecurrenceIntervalDays,
          firstDate,
          endDate,
        }) => ({
          id,
          name,
          status,
          recurrence,
          customRecurrenceName,
          customRecurrenceIntervalDays,
          firstDate,
          endDate,
          locationCount: locationsByTour.get(id)!.size,
        })
      ),
      totalCount,
      addedCount: added.length,
      sharedCount: shared.size,
      sharedLocationLabel: sharedLocation?.label,
      conflicts,
    },
  };
};

export const processWasteTourMerge = async (
  client: QueryClient,
  input: WasteTourMergeInput
): Promise<WasteTourMergeResult | null> => {
  const execute = input.confirmationToken !== undefined;
  await client.query(execute ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  let committing = false;
  try {
    if (execute) {
      await client.query("SET LOCAL statement_timeout = '15s'");
      // Lock participating relations to exclude concurrent inserts by existing READ COMMITTED writers.
      // NOWAIT releases the transaction rather than waiting on a writer holding locks in a different order.
      // Fraction writers lock or update waste_tours before touching the read-only relation.
      await client.query(`LOCK TABLE waste_tours, waste_custom_recurrence_presets,
        waste_collection_locations, waste_cities, waste_streets, waste_house_numbers, waste_location_tour_links,
        waste_tour_assignments, waste_location_tour_pickup_dates, waste_tour_date_shifts,
        waste_global_date_shifts, waste_holiday_rules IN EXCLUSIVE MODE NOWAIT`);
    }
    const snapshot = await readSnapshot(client, input);
    if (!execute) {
      await client.query('COMMIT');
      return snapshot ? { kind: 'preview', preview: snapshot.preview } : null;
    }
    if (
      !snapshot ||
      snapshot.preview.token !== input.confirmationToken ||
      snapshot.preview.conflicts.length > 0
    ) {
      await client.query('ROLLBACK');
      return { kind: 'stale' };
    }
    const sources = input.tourIds.filter((id) => id !== input.targetTourId);
    const inserted = await client.query(
      `
      INSERT INTO waste_location_tour_links (location_id, tour_id)
      SELECT location_id, $2::uuid FROM unnest($1::uuid[]) AS location_id`,
      [snapshot.added, input.targetTourId]
    );
    const repository = createWasteMasterDataRepository(createSqlExecutor(client));
    const archivedCount = await repository.updateWasteTourStatusBulk({
      tourIds: sources,
      status: 'archived',
    });
    if (inserted.rowCount !== snapshot.added.length || archivedCount !== sources.length)
      throw new Error('waste_tour_merge_write_verification_failed');

    committing = true;
    await client.query('COMMIT');
    return { kind: 'merged', totalCount: snapshot.preview.totalCount, archivedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    if (!execute || committing) throw error;
    logger.warn('waste_tour_merge_rolled_back', {
      error_code: error instanceof Error && 'code' in error ? String(error.code) : 'write_failed',
    });
    return { kind: 'rolled-back' };
  }
};
