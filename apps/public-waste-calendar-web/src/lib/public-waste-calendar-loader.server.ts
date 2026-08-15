import { calculatePublicWasteCalendarEntries } from './public-waste-calendar-occurrences.js';
import { mergeCalendarAssignmentEntries } from './public-waste-calendar-loader.assignments.js';
import {
  mapCalendarGlobalDateShifts,
  mapCalendarHolidayRules,
  mapCalendarLinkedTours,
  mapCalendarTourDateShifts,
} from './public-waste-calendar-loader.projection.js';
import type {
  CalendarEntryRow,
  GlobalDateShiftRow,
  HolidayRuleRow,
  TourAssignmentRow,
  TourDateShiftRow,
} from './public-waste-calendar-loader.types.js';
import type {
  PublicWasteCalendarEntry,
  PublicWasteResolvedSelection,
} from './public-waste-contract.js';
import {
  addYearsUtc,
  normalizeDateOnly,
  startOfPreviousYearUtc,
} from './public-waste-date-utils.js';
import { createStreetSelectionFilter } from './public-waste-repository-selection.server.js';

export type SqlExecutionResult<TRow> = {
  readonly rowCount: number;
  readonly rows: readonly TRow[];
};

export type SqlExecutor = <TRow = Record<string, unknown>>(input: {
  readonly text: string;
  readonly values?: readonly unknown[];
}) => Promise<SqlExecutionResult<TRow>>;

type CalendarQueryContext = Readonly<{
  execute: SqlExecutor;
  schemaName: string;
  selection: PublicWasteResolvedSelection;
  streetFilter: ReturnType<typeof createStreetSelectionFilter>;
}>;

const selectionValues = (context: CalendarQueryContext) =>
  [
    context.selection.cityId,
    ...context.streetFilter.values,
    context.selection.regionId ?? null,
    context.selection.houseNumberId ?? null,
  ] as const;

const loadLinkedTourRows = (context: CalendarQueryContext) =>
  context.execute<CalendarEntryRow>({
    text: `
      SELECT
        ltl.id AS link_id,
        ltl.location_id::text,
        t.id::text AS tour_id,
        t.name AS tour_name,
        t.description AS tour_description,
        t.recurrence AS tour_recurrence,
        crp.interval_days AS tour_custom_recurrence_interval_days,
        t.first_date::text AS tour_first_date,
        t.end_date::text AS tour_end_date,
        t.custom_dates AS tour_custom_dates,
        f.id AS fraction_id,
        f.name AS fraction_label,
        f.description AS fraction_description,
        f.pdf_short_label AS fraction_pdf_short_label,
        f.color AS fraction_color
      FROM ${context.schemaName}.waste_collection_locations cl
      INNER JOIN ${context.schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
      INNER JOIN ${context.schemaName}.waste_tours t ON t.id = ltl.tour_id
      LEFT JOIN ${context.schemaName}.waste_custom_recurrence_presets crp ON crp.id = t.custom_recurrence_id
      LEFT JOIN ${context.schemaName}.waste_fractions f ON f.id::text = ANY(t.waste_fraction_ids)
      WHERE cl.active = true
        AND t.active = true
        AND cl.city_id = $1::uuid
        ${context.streetFilter.text}
        AND ($4::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $4::uuid)
        AND ($5::uuid IS NULL OR cl.house_number_id IS NULL OR cl.house_number_id = $5::uuid)
      ORDER BY t.name ASC, f.name ASC, ltl.id ASC;
    `,
    values: selectionValues(context),
  });

const loadTourDateShiftRows = (context: CalendarQueryContext) =>
  context.execute<TourDateShiftRow>({
    text: `
      SELECT
        id::text,
        tour_id::text,
        original_date,
        actual_date,
        description
      FROM ${context.schemaName}.waste_tour_date_shifts
      ORDER BY original_date ASC, actual_date ASC, id ASC;
    `,
  });

const loadGlobalDateShiftRows = (context: CalendarQueryContext) =>
  context.execute<GlobalDateShiftRow>({
    text: `
      SELECT
        id::text,
        original_date,
        actual_date,
        description,
        tour_ids
      FROM ${context.schemaName}.waste_global_date_shifts
      ORDER BY original_date ASC, actual_date ASC, id ASC;
    `,
  });

const loadTourAssignmentRows = (context: CalendarQueryContext) =>
  context.execute<TourAssignmentRow>({
    text: `
      SELECT DISTINCT
        assignment.id::text AS assignment_id,
        assignment.pickup_date::text AS pickup_date,
        t.id::text AS tour_id,
        t.name AS tour_name,
        t.description AS tour_description,
        f.id AS fraction_id,
        f.name AS fraction_label,
        f.description AS fraction_description,
        f.pdf_short_label AS fraction_pdf_short_label,
        f.color AS fraction_color,
        assignment.note AS note
      FROM ${context.schemaName}.waste_tour_assignments assignment
      INNER JOIN ${context.schemaName}.waste_tour_assignment_locations assignment_location
        ON assignment_location.assignment_id = assignment.id
      INNER JOIN ${context.schemaName}.waste_collection_locations cl
        ON cl.id = assignment_location.collection_location_id
      INNER JOIN ${context.schemaName}.waste_tours t ON t.id = assignment.tour_id
      LEFT JOIN ${context.schemaName}.waste_fractions f ON f.id::text = ANY(t.waste_fraction_ids)
      WHERE cl.active = true
        AND t.active = true
        AND cl.city_id = $1::uuid
        ${context.streetFilter.text}
        AND ($4::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $4::uuid)
        AND ($5::uuid IS NULL OR cl.house_number_id IS NULL OR cl.house_number_id = $5::uuid)
      ORDER BY pickup_date ASC, tour_name ASC, fraction_label ASC, assignment_id ASC;
    `,
    values: selectionValues(context),
  });

const loadHolidayRuleRows = (
  context: CalendarQueryContext,
  window: Readonly<{ start: string; end: string }> | null
): Promise<SqlExecutionResult<HolidayRuleRow>> =>
  window
    ? context.execute<HolidayRuleRow>({
        text: `
          SELECT
            id::text,
            holiday_date::text,
            holiday_name,
            year AS holiday_year,
            state_code,
            source_status,
            configuration_status,
            conflict_status,
            scope,
            strategy,
            created_at::text,
            updated_at::text
          FROM ${context.schemaName}.waste_holiday_rules
          WHERE holiday_date >= $1::date - INTERVAL '7 day'
            AND holiday_date <= $2::date
            AND scope IS NOT NULL
            AND strategy IS NOT NULL
          ORDER BY holiday_date ASC, holiday_name ASC, id ASC;
        `,
        values: [window.start, window.end],
      })
    : Promise.resolve({ rowCount: 0, rows: [] });

const resolveCalendarWindow = (
  referenceDate: string
): Readonly<{ start: string; end: string }> | null => {
  const normalizedReferenceDate = normalizeDateOnly(referenceDate);
  return normalizedReferenceDate
    ? {
        start: startOfPreviousYearUtc(normalizedReferenceDate),
        end: addYearsUtc(normalizedReferenceDate, 1),
      }
    : null;
};

export const loadPublicWasteCalendarEntries = async (input: {
  readonly schemaName: string;
  readonly execute: SqlExecutor;
  readonly query: {
    readonly selection: PublicWasteResolvedSelection;
    readonly referenceDate: string;
  };
}): Promise<readonly PublicWasteCalendarEntry[]> => {
  const context: CalendarQueryContext = {
    execute: input.execute,
    schemaName: input.schemaName,
    selection: input.query.selection,
    streetFilter: createStreetSelectionFilter(input.query.selection.streetId),
  };
  const linkedToursResult = await loadLinkedTourRows(context);
  const window = resolveCalendarWindow(input.query.referenceDate);
  const [tourDateShifts, globalDateShifts, tourAssignments, holidayRulesResult] = await Promise.all(
    [
      loadTourDateShiftRows(context),
      loadGlobalDateShiftRows(context),
      loadTourAssignmentRows(context),
      loadHolidayRuleRows(context, window),
    ]
  );
  const holidayRules = mapCalendarHolidayRules(holidayRulesResult.rows);
  const calculatedEntries = calculatePublicWasteCalendarEntries({
    referenceDate: input.query.referenceDate,
    selection: input.query.selection,
    linkedTours: mapCalendarLinkedTours(linkedToursResult.rows),
    tourDateShifts: mapCalendarTourDateShifts(tourDateShifts.rows),
    globalDateShifts: mapCalendarGlobalDateShifts(globalDateShifts.rows),
    holidayRules,
  });

  return window
    ? mergeCalendarAssignmentEntries({
        calculatedEntries,
        assignmentRows: tourAssignments.rows,
        tourDateShiftRows: tourDateShifts.rows,
        globalDateShiftRows: globalDateShifts.rows,
        holidayRules,
        windowStart: window.start,
        windowEnd: window.end,
      })
    : calculatedEntries;
};
