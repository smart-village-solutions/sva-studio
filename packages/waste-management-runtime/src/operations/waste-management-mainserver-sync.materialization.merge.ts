import type { MaterializedLocationTourPickupDateRecord } from './waste-management-mainserver-sync.materialization.js';

const toOccurrenceKey = (
  entry: Pick<MaterializedLocationTourPickupDateRecord, 'locationId' | 'tourId' | 'pickupDate'>
): string => `${entry.locationId}::${entry.tourId}::${entry.pickupDate}`;

export const mergeMaterializedPickupDates = (
  calculated: readonly MaterializedLocationTourPickupDateRecord[],
  assigned: readonly MaterializedLocationTourPickupDateRecord[]
): readonly MaterializedLocationTourPickupDateRecord[] => {
  const assignedKeys = new Set(assigned.map(toOccurrenceKey));
  const seenCalculatedKeys = new Set<string>();
  const uniqueCalculated = calculated.filter((entry) => {
    const key = toOccurrenceKey(entry);
    if (assignedKeys.has(key) || seenCalculatedKeys.has(key)) {
      return false;
    }
    seenCalculatedKeys.add(key);
    return true;
  });

  return [...uniqueCalculated, ...assigned].sort(
    (left, right) =>
      left.locationId.localeCompare(right.locationId) ||
      left.tourId.localeCompare(right.tourId) ||
      left.pickupDate.localeCompare(right.pickupDate) ||
      left.id.localeCompare(right.id)
  );
};
