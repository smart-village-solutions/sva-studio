/** Collision checks reuse the production schedule materializer over the complete bounded period. */
import type { WasteFractionDeletePreview } from '@sva/waste-management-contracts';
import { buildMaterializedLocationTourPickupDates } from '../operations/waste-management-mainserver-sync.materialization.js';
import type { WasteMaterializationContext } from '../operations/waste-management-mainserver-sync.materialization.shared.js';

export const replaceFractionIds = (
  ids: readonly string[],
  source: string,
  target?: string
): readonly string[] =>
  ids.flatMap((id) => (id !== source ? [id] : target && !ids.includes(target) ? [target] : []));

type Schedule = Omit<WasteMaterializationContext, 'currentYear' | 'nextYear'>;
type Result = Pick<WasteFractionDeletePreview, 'conflicts' | 'blockedReason'>;

const replacementPairs = (state: Schedule, source: string, target: string) => {
  const gaining = new Set(
    state.tours
      .filter(
        (tour) => tour.wasteFractionIds.includes(source) && !tour.wasteFractionIds.includes(target)
      )
      .map((tour) => tour.id)
  );
  const candidates = state.tours.filter(
    (tour) =>
      tour.status === 'published' &&
      (gaining.has(tour.id) || tour.wasteFractionIds.includes(target))
  );
  const locationsByTour = new Map<string, Set<string>>();
  const add = (tourId: string, locationId: string) => {
    const locations = locationsByTour.get(tourId) ?? new Set<string>();
    locations.add(locationId);
    locationsByTour.set(tourId, locations);
  };
  for (const link of state.links) add(link.tourId, link.locationId);
  for (const assignment of state.tourAssignments ?? []) {
    for (const locationId of assignment.locationIds) add(assignment.tourId, locationId);
  }
  const pairs: Array<readonly [string, string]> = [];
  for (let i = 0; i < candidates.length; i++) {
    const left = candidates[i];
    for (const right of candidates.slice(i + 1)) {
      if (!gaining.has(left.id) && !gaining.has(right.id)) continue;
      if (
        ![...(locationsByTour.get(left.id) ?? [])].some((id) =>
          locationsByTour.get(right.id)?.has(id)
        )
      )
        continue;
      pairs.push([left.id, right.id]);
    }
  }
  return { pairs, candidates };
};
const replacementYears = (
  state: Schedule,
  tours: Schedule['tours'],
  relevantIds: ReadonlySet<string>
): readonly number[] | null => {
  const dates = [
    ...tours.flatMap((tour) => [
      tour.firstDate,
      tour.endDate,
      ...(tour.customDates ?? []).map((d) => d.date),
    ]),
    ...(state.locationTourPickupDates ?? [])
      .filter((d) => relevantIds.has(d.tourId))
      .map((d) => d.pickupDate),
    ...(state.tourAssignments ?? [])
      .filter((a) => relevantIds.has(a.tourId))
      .map((a) => a.pickupDate),
    ...state.tourDateShifts
      .filter((s) => relevantIds.has(s.tourId) && s.hasYear)
      .flatMap((s) => [s.originalDate, s.actualDate]),
    ...state.globalDateShifts
      .filter((s) => s.hasYear)
      .flatMap((s) => [s.originalDate, s.actualDate]),
    ...state.holidayRules.map((r) => r.holidayDate),
  ].filter((date): date is string => Boolean(date));
  if (!dates.length) return [];
  const dateYears = dates.map((d) => Number(d.slice(0, 4)));
  const first = Math.min(...dateYears);
  const last = Math.max(...dateYears);
  // Explicit resource bound: reject instead of claiming a partially checked result.
  if (!Number.isInteger(first) || first < 2 || last > 9998 || last - first > 100) {
    return null;
  }
  // Annual rules moving across a year require a period extending beyond the bounded source years.
  if (
    [...state.tourDateShifts, ...state.globalDateShifts].some(
      (shift) => !shift.hasYear && shift.originalDate.slice(0, 4) !== shift.actualDate.slice(0, 4)
    )
  ) {
    return null;
  }
  return Array.from({ length: last - first + 3 }, (_, index) => first - 1 + index);
};
const occurrenceConflicts = (
  occurrences: ReturnType<typeof buildMaterializedLocationTourPickupDates>,
  pairs: readonly (readonly [string, string])[]
) => {
  const byKey = new Map<string, Set<string>>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.locationId}/${occurrence.pickupDate}`;
    const ids = byKey.get(key) ?? new Set<string>();
    ids.add(occurrence.tourId);
    byKey.set(key, ids);
  }
  const conflicts: WasteFractionDeletePreview['conflicts'][number][] = [];
  for (const [key, ids] of byKey) {
    for (const [left, right] of pairs) {
      if (!ids.has(left) || !ids.has(right)) continue;
      const [locationId, pickupDate] = key.split('/');
      conflicts.push({ tourIds: [left, right].sort(), locationId, pickupDate });
    }
  }
  conflicts.sort(
    (a, b) =>
      a.pickupDate.localeCompare(b.pickupDate) ||
      a.locationId.localeCompare(b.locationId) ||
      a.tourIds.join().localeCompare(b.tourIds.join())
  );
  return conflicts;
};
export const findFractionReplacementConflicts = (
  state: Schedule,
  source: string,
  target: string
): Result => {
  const { pairs, candidates } = replacementPairs(state, source, target);
  if (!pairs.length) return { conflicts: [], blockedReason: null };
  const relevantIds = new Set(pairs.flat());
  const tours = candidates.filter((tour) => relevantIds.has(tour.id));
  // An unbounded linked recurrence cannot be certified by a finite calendar preview.
  if (
    tours.some(
      (tour) =>
        state.links.some((link) => link.tourId === tour.id) &&
        tour.recurrence &&
        tour.recurrence !== 'on-demand' &&
        !tour.endDate
    )
  ) {
    return { conflicts: [], blockedReason: 'unbounded-schedule' };
  }
  const years = replacementYears(state, tours, relevantIds);
  if (years === null) return { conflicts: [], blockedReason: 'unbounded-schedule' };
  if (!years.length) return { conflicts: [], blockedReason: null };
  const occurrences = buildMaterializedLocationTourPickupDates({
    ...state,
    tours,
    years,
    currentYear: years[0],
    nextYear: years.at(-1)!,
  });
  const conflicts = occurrenceConflicts(occurrences, pairs);
  return { conflicts, blockedReason: conflicts.length ? 'date-conflict' : null };
};
