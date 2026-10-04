import type { WasteFractionRecord, WasteTourRecord } from '@sva/waste-management-contracts';

import type { WasteManagementSearchParams } from './search-params.js';
import { matchesWasteTourValidityPeriod } from './waste-management.tours.validity-filter.js';

const matchesSearch = (value: string, query: string) =>
  value.toLocaleLowerCase().includes(query.toLocaleLowerCase());

const matchesStatusFilter = (
  status: WasteManagementSearchParams['tourStatus'],
  tourStatus: WasteTourRecord['status']
): boolean => {
  if (status === 'all') {
    return true;
  }
  return status === tourStatus;
};

const matchesDateLowerBound = (
  value: string | null | undefined,
  lowerBound: string | undefined
): boolean => {
  if (!lowerBound) {
    return true;
  }
  return typeof value === 'string' && value >= lowerBound;
};

const matchesDateUpperBound = (
  value: string | null | undefined,
  upperBound: string | undefined
): boolean => {
  if (!upperBound) {
    return true;
  }
  return typeof value === 'string' && value <= upperBound;
};

export const filterTours = (
  tours: readonly WasteTourRecord[],
  search: WasteManagementSearchParams,
  referenceYear = new Date().getFullYear()
): readonly WasteTourRecord[] =>
  tours.filter((tour) => {
    if (search.tourId && tour.id !== search.tourId) {
      return false;
    }
    if (!matchesStatusFilter(search.tourStatus, tour.status)) {
      return false;
    }
    if (search.tourWasteFractionId && !tour.wasteFractionIds.includes(search.tourWasteFractionId)) {
      return false;
    }
    if (!matchesWasteTourValidityPeriod(tour, search.tourValidityPeriod, referenceYear)) {
      return false;
    }
    if (!matchesDateLowerBound(tour.firstDate, search.firstDateFrom)) {
      return false;
    }
    if (!matchesDateUpperBound(tour.firstDate, search.firstDateTo)) {
      return false;
    }
    if (!matchesDateLowerBound(tour.endDate, search.endDateFrom)) {
      return false;
    }
    if (!matchesDateUpperBound(tour.endDate, search.endDateTo)) {
      return false;
    }
    if (!search.q) {
      return true;
    }
    return [tour.name, tour.description]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => matchesSearch(value, search.q));
  });

export const resolveActiveTourFractions = (
  fractions: readonly WasteFractionRecord[],
  ids: readonly string[]
): readonly WasteFractionRecord[] => fractions.filter((fraction) => ids.includes(fraction.id));
