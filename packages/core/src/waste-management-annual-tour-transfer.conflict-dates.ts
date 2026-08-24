import type { WasteAnnualTourTransferMappedTour } from './waste-management-annual-tour-transfer.contract.js';
import { resolveEffectiveWasteTourDateShiftsForYear } from './waste-management/master-data-tour-date-shifts.js';

type MappedShifts = WasteAnnualTourTransferMappedTour['tourDateShifts'];

const resolvedShifts = (shifts: MappedShifts, year: number) =>
  resolveEffectiveWasteTourDateShiftsForYear(shifts, year);

export const resolvedWasteAnnualShiftActualDates = (
  shifts: MappedShifts,
  year: number
): readonly string[] => resolvedShifts(shifts, year).map((shift) => shift.actualDate);

export const effectiveWasteAnnualShiftedDates = (
  baseDates: readonly string[],
  shifts: MappedShifts,
  year: number
): readonly string[] => {
  const effectiveShifts = resolvedShifts(shifts, year);
  const shiftedOrigins = new Set(effectiveShifts.map((shift) => shift.originalDate));
  return [
    ...new Set([
      ...baseDates.filter((date) => !shiftedOrigins.has(date)),
      ...effectiveShifts.map((shift) => shift.actualDate),
    ]),
  ];
};
