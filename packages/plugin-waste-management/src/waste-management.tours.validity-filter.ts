import type { WasteTourRecord } from '@sva/plugin-sdk';

import type { WasteManagementTourValidityPeriod } from './search-params.js';

export type WasteTourValidityYearRange = Readonly<{
  year: number;
  startDate: string;
  endDate: string;
}>;

export const resolveWasteTourValidityYear = (
  period: Exclude<WasteManagementTourValidityPeriod, 'all'>,
  referenceYear: number
): number => {
  if (period === 'previous') return referenceYear - 1;
  if (period === 'next') return referenceYear + 1;
  return referenceYear;
};

export const createWasteTourValidityYearRange = (
  period: Exclude<WasteManagementTourValidityPeriod, 'all'>,
  referenceYear: number
): WasteTourValidityYearRange => {
  const year = resolveWasteTourValidityYear(period, referenceYear);
  return { year, startDate: `${year}-01-01`, endDate: `${year}-12-31` };
};

const overlapsValidityYear = (
  tour: Pick<WasteTourRecord, 'firstDate' | 'endDate'>,
  range: WasteTourValidityYearRange
): boolean =>
  (tour.firstDate === undefined || tour.firstDate <= range.endDate) &&
  (tour.endDate === undefined || tour.endDate >= range.startDate);

const hasExplicitDateInValidityYear = (
  tour: Pick<WasteTourRecord, 'customDates'>,
  range: WasteTourValidityYearRange
): boolean =>
  (tour.customDates ?? []).some(({ date }) => date >= range.startDate && date <= range.endDate);

export const matchesWasteTourValidityPeriod = (
  tour: Pick<WasteTourRecord, 'firstDate' | 'endDate' | 'customDates'>,
  period: WasteManagementTourValidityPeriod,
  referenceYear: number
): boolean => {
  if (period === 'all') return true;

  const range = createWasteTourValidityYearRange(period, referenceYear);
  return overlapsValidityYear(tour, range) || hasExplicitDateInValidityYear(tour, range);
};
