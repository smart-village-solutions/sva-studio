import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import type { WasteAnnualTourTransferMappedTour } from './waste-management-annual-tour-transfer.contract.js';
import {
  resolvedWasteAnnualShiftActualDates,
  wasteAnnualDateOccursOnRecurringTour,
} from './waste-management-annual-tour-transfer.conflict-dates.js';
import { wasteAnnualIntervalForTour } from './waste-management-annual-tour-transfer.shift-cadence.js';

type MappedShifts = WasteAnnualTourTransferMappedTour['tourDateShifts'];

export const operationalWasteAnnualShiftActualDates = (
  tour: WasteTourRecord,
  baseDates: readonly string[],
  shifts: MappedShifts,
  year: number
): readonly string[] => {
  const baseDateSet = new Set(baseDates);
  const interval = wasteAnnualIntervalForTour(tour);
  return resolvedWasteAnnualShiftActualDates(
    shifts,
    year,
    (origin) =>
      baseDateSet.has(origin) || wasteAnnualDateOccursOnRecurringTour(origin, tour, interval)
  );
};

export const wasteAnnualShiftActualDatesForYears = (
  tour: WasteTourRecord,
  baseDates: readonly string[],
  shifts: MappedShifts,
  years: ReadonlySet<number>
): readonly string[] => [
  ...new Set(
    [...years].flatMap((year) =>
      operationalWasteAnnualShiftActualDates(tour, baseDates, shifts, year)
    )
  ),
];
