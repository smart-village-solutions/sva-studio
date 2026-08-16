import { resolveEffectiveWasteTourDateShiftsForYear, type WasteHolidayRuleRecord } from '@sva/core';

import { applyPublicWasteHolidayRulesToDate } from './public-waste-calendar-occurrences.js';
import type { PublicWasteCalendarEntry } from './public-waste-contract.js';
import { isDateWithinRange, normalizeDateOnly } from './public-waste-date-utils.js';
import type {
  GlobalDateShiftRow,
  TourAssignmentRow,
  TourDateShiftRow,
} from './public-waste-calendar-loader.types.js';

type CalendarShift = Readonly<{ actualDate: string; description: string | null }>;

const normalizeShift = (row: {
  readonly original_date: string;
  readonly actual_date: string;
  readonly description: string | null;
}): readonly [string, CalendarShift] | null => {
  const originalDate = normalizeDateOnly(row.original_date);
  const actualDate = normalizeDateOnly(row.actual_date);
  if (!originalDate || !actualDate) return null;
  return [originalDate, { actualDate, description: row.description?.trim() || null }];
};

const createTourShiftMap = (
  rows: readonly TourDateShiftRow[],
  years: readonly number[]
): ReadonlyMap<string, CalendarShift> => {
  const shifts = new Map<string, CalendarShift>();
  const effectiveRows = years.flatMap((year) =>
    resolveEffectiveWasteTourDateShiftsForYear(
      rows.map((row) => ({
        ...row,
        tourId: row.tour_id,
        originalDate: row.original_date,
        actualDate: row.actual_date,
        hasYear: row.has_year ?? true,
      })),
      year
    )
  );
  for (const row of effectiveRows) {
    const shift = normalizeShift({
      original_date: row.originalDate,
      actual_date: row.actualDate,
      description: row.description,
    });
    if (shift) shifts.set(`${row.tourId}:${shift[0]}`, shift[1]);
  }
  return shifts;
};

const createGlobalShiftMaps = (rows: readonly GlobalDateShiftRow[]) => {
  const shared = new Map<string, CalendarShift>();
  const scoped = new Map<string, Map<string, CalendarShift>>();
  for (const row of rows) {
    const shift = normalizeShift(row);
    if (!shift) continue;
    if (!row.tour_ids || row.tour_ids.length === 0) {
      shared.set(shift[0], shift[1]);
      continue;
    }
    for (const tourId of row.tour_ids) {
      const tourShifts = scoped.get(tourId) ?? new Map<string, CalendarShift>();
      tourShifts.set(shift[0], shift[1]);
      scoped.set(tourId, tourShifts);
    }
  }
  return { scoped, shared } as const;
};

const compareCalendarEntries = (
  left: PublicWasteCalendarEntry,
  right: PublicWasteCalendarEntry
): number =>
  left.date.localeCompare(right.date) ||
  left.fractionLabel.localeCompare(right.fractionLabel, 'de');

const resolveApplicableShift = (input: {
  readonly tourId: string;
  readonly pickupDate: string;
  readonly tourShifts: ReadonlyMap<string, CalendarShift>;
  readonly globalShifts: ReturnType<typeof createGlobalShiftMaps>;
}): CalendarShift | undefined => {
  const tourShift = input.tourShifts.get(`${input.tourId}:${input.pickupDate}`);
  const scopedGlobalShift = input.globalShifts.scoped.get(input.tourId)?.get(input.pickupDate);
  const globalShift = scopedGlobalShift ?? input.globalShifts.shared.get(input.pickupDate);
  if (!tourShift) return globalShift;

  return {
    actualDate: tourShift.actualDate,
    description: tourShift.description ?? globalShift?.description ?? null,
  };
};

const createAssignmentEntry = (input: {
  readonly row: TourAssignmentRow;
  readonly fractionId: string;
  readonly fractionLabel: string;
  readonly pickupDate: string;
  readonly shiftedDate: string;
  readonly note: string | null;
}): PublicWasteCalendarEntry => ({
  id: `${input.row.assignment_id}:${input.fractionId}`,
  date: input.shiftedDate,
  fractionId: input.fractionId,
  fractionLabel: input.fractionLabel,
  ...(input.row.fraction_description?.trim()
    ? { fractionDescription: input.row.fraction_description.trim() }
    : {}),
  ...(input.row.fraction_pdf_short_label
    ? { fractionShortLabel: input.row.fraction_pdf_short_label }
    : {}),
  ...(input.row.fraction_color ? { fractionColor: input.row.fraction_color } : {}),
  ...(input.row.tour_name.trim() ? { tourName: input.row.tour_name.trim() } : {}),
  ...(input.row.tour_description?.trim()
    ? { tourDescription: input.row.tour_description.trim() }
    : {}),
  ...(input.shiftedDate !== input.pickupDate ? { isShifted: true } : {}),
  note: input.note,
});

const resolveAssignmentShift = (input: {
  readonly row: TourAssignmentRow;
  readonly pickupDate: string;
  readonly tourShifts: ReadonlyMap<string, CalendarShift>;
  readonly globalShifts: ReturnType<typeof createGlobalShiftMaps>;
  readonly holidayRules: readonly WasteHolidayRuleRecord[];
}) => {
  const assignmentNote = input.row.note?.trim() || null;
  const shift = resolveApplicableShift({
    tourId: input.row.tour_id,
    pickupDate: input.pickupDate,
    tourShifts: input.tourShifts,
    globalShifts: input.globalShifts,
  });
  if (!shift) {
    return {
      shiftedDate: applyPublicWasteHolidayRulesToDate(input.pickupDate, input.holidayRules),
      note: assignmentNote,
    } as const;
  }

  return {
    shiftedDate: applyPublicWasteHolidayRulesToDate(shift.actualDate, input.holidayRules),
    note: assignmentNote ?? shift.description,
  } as const;
};

const projectAssignmentRow = (input: {
  readonly row: TourAssignmentRow;
  readonly tourShifts: ReadonlyMap<string, CalendarShift>;
  readonly globalShifts: ReturnType<typeof createGlobalShiftMaps>;
  readonly holidayRules: readonly WasteHolidayRuleRecord[];
  readonly windowStart: string;
  readonly windowEnd: string;
}):
  | Readonly<{
      calculatedEntryId: string;
      entry: PublicWasteCalendarEntry;
    }>
  | undefined => {
  const pickupDate = normalizeDateOnly(input.row.pickup_date);
  if (!pickupDate || !input.row.fraction_id || !input.row.fraction_label) return undefined;

  const { shiftedDate, note } = resolveAssignmentShift({
    row: input.row,
    pickupDate,
    tourShifts: input.tourShifts,
    globalShifts: input.globalShifts,
    holidayRules: input.holidayRules,
  });
  if (!isDateWithinRange(shiftedDate, input.windowStart, input.windowEnd)) return undefined;

  return {
    calculatedEntryId: `${input.row.tour_id}:${shiftedDate}:${input.row.fraction_id}`,
    entry: createAssignmentEntry({
      row: input.row,
      fractionId: input.row.fraction_id,
      fractionLabel: input.row.fraction_label,
      pickupDate,
      shiftedDate,
      note,
    }),
  };
};

export const mergeCalendarAssignmentEntries = (input: {
  readonly calculatedEntries: readonly PublicWasteCalendarEntry[];
  readonly assignmentRows: readonly TourAssignmentRow[];
  readonly tourDateShiftRows: readonly TourDateShiftRow[];
  readonly globalDateShiftRows: readonly GlobalDateShiftRow[];
  readonly holidayRules: readonly WasteHolidayRuleRecord[];
  readonly windowStart: string;
  readonly windowEnd: string;
}): readonly PublicWasteCalendarEntry[] => {
  const mergedEntries = new Map(input.calculatedEntries.map((entry) => [entry.id, entry] as const));
  const assignmentYears = Array.from(
    new Set(input.assignmentRows.map((row) => Number(row.pickup_date.slice(0, 4))))
  ).filter(Number.isSafeInteger);
  const tourShifts = createTourShiftMap(input.tourDateShiftRows, assignmentYears);
  const globalShifts = createGlobalShiftMaps(input.globalDateShiftRows);

  for (const row of input.assignmentRows) {
    const projected = projectAssignmentRow({
      row,
      tourShifts,
      globalShifts,
      holidayRules: input.holidayRules,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
    });
    if (!projected) continue;
    mergedEntries.delete(projected.calculatedEntryId);
    mergedEntries.set(projected.entry.id, projected.entry);
  }

  return Array.from(mergedEntries.values()).sort(compareCalendarEntries);
};
