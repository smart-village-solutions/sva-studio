import type { WasteTourDateShiftRecord } from './waste-management/master-data-scheduling.js';

const isImmutableShiftResource = (
  tourId: string,
  shifts: readonly WasteTourDateShiftRecord[],
  resourceId: string
): boolean =>
  shifts.some(
    (shift) => shift.tourId === tourId && !shift.hasYear && resourceId.startsWith(`${shift.id}:`)
  );

export const filterReplaceableWasteAnnualCollisionResources = (
  tourId: string,
  shifts: readonly WasteTourDateShiftRecord[],
  resourceIds: readonly string[]
): readonly string[] =>
  resourceIds.filter((resourceId) => !isImmutableShiftResource(tourId, shifts, resourceId));

export const hasImmutableWasteAnnualShiftCollision = (
  tourId: string,
  shifts: readonly WasteTourDateShiftRecord[],
  resourceIds: readonly string[]
): boolean =>
  resourceIds.some((resourceId) => isImmutableShiftResource(tourId, shifts, resourceId));
