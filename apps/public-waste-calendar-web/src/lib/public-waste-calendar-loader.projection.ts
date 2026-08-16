import type { WasteHolidayRuleRecord } from '@sva/core';

import type { CalculatePublicWasteCalendarEntriesInput } from './public-waste-calendar-occurrences.js';

import type {
  CalendarEntryRow,
  GlobalDateShiftRow,
  HolidayRuleRow,
  TourDateShiftRow,
} from './public-waste-calendar-loader.types.js';

type LinkedTour = CalculatePublicWasteCalendarEntriesInput['linkedTours'][number];
type LinkedFraction = LinkedTour['tour']['fractions'][number];
type MutableLinkedTour = Omit<LinkedTour, 'tour'> & {
  tour: Omit<LinkedTour['tour'], 'fractions'> & {
    fractions: LinkedFraction[];
  };
};
const normalizeCustomDates = (
  value: CalendarEntryRow['tour_custom_dates']
): readonly { readonly date: string; readonly description?: string }[] => {
  if (!value) return [];

  return value
    .map((entry) => {
      if (typeof entry?.date !== 'string') return null;
      return {
        date: entry.date,
        ...(typeof entry.description === 'string' && entry.description.trim().length > 0
          ? { description: entry.description }
          : {}),
      };
    })
    .filter(
      (entry): entry is { readonly date: string; readonly description?: string } => entry !== null
    );
};

const mapFraction = (row: CalendarEntryRow): LinkedFraction | null =>
  row.fraction_id
    ? {
        id: row.fraction_id,
        label: row.fraction_label,
        ...(row.fraction_description?.trim()
          ? { description: row.fraction_description.trim() }
          : {}),
        ...(row.fraction_pdf_short_label ? { shortLabel: row.fraction_pdf_short_label } : {}),
        ...(row.fraction_color ? { color: row.fraction_color } : {}),
      }
    : null;

const createLinkedTour = (
  row: CalendarEntryRow,
  fraction: LinkedFraction | null
): MutableLinkedTour => ({
  linkId: row.link_id,
  locationId: row.location_id,
  tour: {
    id: row.tour_id,
    name: row.tour_name,
    ...(row.tour_description?.trim() ? { description: row.tour_description.trim() } : {}),
    recurrence: row.tour_recurrence,
    ...(typeof row.tour_custom_recurrence_interval_days === 'number'
      ? { customRecurrenceIntervalDays: row.tour_custom_recurrence_interval_days }
      : {}),
    ...(row.tour_first_date ? { firstDate: row.tour_first_date } : {}),
    ...(row.tour_end_date ? { endDate: row.tour_end_date } : {}),
    customDates: normalizeCustomDates(row.tour_custom_dates),
    fractions: fraction ? [fraction] : [],
  },
});

export const mapCalendarLinkedTours = (
  rows: readonly CalendarEntryRow[]
): readonly LinkedTour[] => {
  const groups = new Map<string, MutableLinkedTour>();
  for (const row of rows) {
    const fraction = mapFraction(row);
    const existing = groups.get(row.link_id);
    if (!existing) {
      groups.set(row.link_id, createLinkedTour(row, fraction));
      continue;
    }
    if (fraction && !existing.tour.fractions.some((entry) => entry.id === fraction.id)) {
      existing.tour.fractions.push(fraction);
    }
  }
  return Array.from(groups.values());
};

export const mapCalendarHolidayRules = (
  rows: readonly HolidayRuleRow[]
): readonly WasteHolidayRuleRecord[] =>
  rows.map((row) => ({
    id: row.id,
    holidayDate: row.holiday_date,
    holidayName: row.holiday_name,
    year: row.holiday_year,
    stateCode: row.state_code,
    sourceStatus: row.source_status,
    configurationStatus: row.configuration_status,
    conflictStatus: row.conflict_status,
    ...(row.scope ? { scope: row.scope } : {}),
    ...(row.strategy ? { strategy: row.strategy } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

export const mapCalendarTourDateShifts = (
  rows: readonly TourDateShiftRow[]
): CalculatePublicWasteCalendarEntriesInput['tourDateShifts'] =>
  rows.map((row) => ({
    id: row.id,
    tourId: row.tour_id,
    originalDate: row.original_date,
    actualDate: row.actual_date,
    hasYear: row.has_year ?? true,
    ...(row.description ? { description: row.description } : {}),
  }));

export const mapCalendarGlobalDateShifts = (
  rows: readonly GlobalDateShiftRow[]
): CalculatePublicWasteCalendarEntriesInput['globalDateShifts'] =>
  rows.map((row) => ({
    id: row.id,
    originalDate: row.original_date,
    actualDate: row.actual_date,
    ...(row.description ? { description: row.description } : {}),
    ...(row.tour_ids ? { tourIds: row.tour_ids } : {}),
  }));
