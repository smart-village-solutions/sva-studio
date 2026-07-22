import type { WasteHolidayRuleRecord } from '@sva/core';

import type {
  PublicWasteCalendarEntry,
  PublicWasteReminderChannel,
  PublicWasteReminderFractionOption,
  PublicWasteReminderFractionSlotOption,
  PublicWasteResolvedSelection,
  PublicWasteSelectableEntry,
  PublicWasteSelectionState,
  PublicWasteSelectionStep,
} from './public-waste-contract.js';
import {
  applyPublicWasteHolidayRulesToDate,
  calculatePublicWasteCalendarEntries,
} from './public-waste-calendar-occurrences.js';
import { PUBLIC_WASTE_CATCH_ALL_STREET_ID } from './public-waste-contract.js';
import {
  addYearsUtc,
  isDateWithinRange,
  normalizeDateOnly,
  startOfPreviousYearUtc,
} from './public-waste-date-utils.js';

type SqlExecutionResult<TRow> = {
  readonly rowCount: number;
  readonly rows: readonly TRow[];
};

type SqlExecutor = <TRow = Record<string, unknown>>(input: {
  readonly text: string;
  readonly values?: readonly unknown[];
}) => Promise<SqlExecutionResult<TRow>>;

type SelectionRow = {
  readonly id: string;
  readonly label: string;
  readonly is_catch_all?: boolean;
  readonly sort_priority?: number;
};

type CalendarEntryRow = {
  readonly link_id: string;
  readonly location_id: string;
  readonly link_start_date?: string | null;
  readonly link_end_date?: string | null;
  readonly tour_id: string;
  readonly tour_name: string;
  readonly tour_description: string | null;
  readonly tour_recurrence:
    'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom' | null;
  readonly tour_custom_recurrence_interval_days: number | null;
  readonly tour_first_date: string | null;
  readonly tour_end_date: string | null;
  readonly tour_custom_dates:
    readonly { readonly date?: unknown; readonly description?: unknown }[] | null;
  readonly fraction_id: string;
  readonly fraction_label: string;
  readonly fraction_description: string | null;
  readonly fraction_pdf_short_label: string | null;
  readonly fraction_color: string | null;
};

type TourDateShiftRow = {
  readonly id: string;
  readonly tour_id: string;
  readonly original_date: string;
  readonly actual_date: string;
  readonly description: string | null;
};

type GlobalDateShiftRow = {
  readonly id: string;
  readonly original_date: string;
  readonly actual_date: string;
  readonly description: string | null;
  readonly tour_ids: readonly string[] | null;
};

type TourAssignmentRow = {
  readonly assignment_id: string;
  readonly pickup_date: string;
  readonly tour_id: string;
  readonly tour_name: string;
  readonly tour_description: string | null;
  readonly fraction_id: string | null;
  readonly fraction_label: string | null;
  readonly fraction_description: string | null;
  readonly fraction_pdf_short_label: string | null;
  readonly fraction_color: string | null;
  readonly note: string | null;
};

type HolidayRuleRow = {
  readonly id: string;
  readonly holiday_date: string;
  readonly holiday_name: string;
  readonly holiday_year: number;
  readonly state_code: WasteHolidayRuleRecord['stateCode'];
  readonly source_status: WasteHolidayRuleRecord['sourceStatus'];
  readonly configuration_status: WasteHolidayRuleRecord['configurationStatus'];
  readonly conflict_status: WasteHolidayRuleRecord['conflictStatus'];
  readonly scope: WasteHolidayRuleRecord['scope'] | null;
  readonly strategy: WasteHolidayRuleRecord['strategy'] | null;
  readonly created_at: string;
  readonly updated_at: string;
};

type ReminderFractionRow = {
  readonly fraction_id: string;
  readonly fraction_label: string;
  readonly fraction_color: string | null;
  readonly reminder_config: unknown;
};

type PersistedReminderSlot = {
  readonly id?: unknown;
  readonly maxLeadDays?: unknown;
  readonly defaultLeadDays?: unknown;
  readonly max_lead_days?: unknown;
  readonly default_lead_days?: unknown;
};

type PersistedReminderConfig = {
  readonly channels?: unknown;
  readonly email?: unknown;
  readonly calendar?: unknown;
};

export type PublicWasteRepository = ReturnType<typeof createPublicWasteRepository>;

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const quoteIdentifier = (value: string): string => {
  if (!schemaIdentifierPattern.test(value)) {
    throw new Error(`invalid_waste_schema:${value}`);
  }
  return `"${value}"`;
};

const mapOptions = (rows: readonly SelectionRow[]): readonly PublicWasteSelectableEntry[] =>
  rows.map((row) => ({
    id: row.id,
    label: row.label,
  }));

const isCatchAllStreetSelection = (
  streetId: string | undefined
): streetId is typeof PUBLIC_WASTE_CATCH_ALL_STREET_ID =>
  streetId === PUBLIC_WASTE_CATCH_ALL_STREET_ID;

const createStreetSelectionFilter = (streetId: PublicWasteResolvedSelection['streetId']) => ({
  text: `
            AND (
              ($2::text = '${PUBLIC_WASTE_CATCH_ALL_STREET_ID}' AND cl.street_id IS NULL)
              OR ($2::text <> '${PUBLIC_WASTE_CATCH_ALL_STREET_ID}' AND (cl.street_id IS NULL OR cl.street_id = $3::uuid))
            )
  `,
  values: [streetId, isCatchAllStreetSelection(streetId) ? null : streetId] as const,
});

const normalizeCustomDates = (
  value: readonly { readonly date?: unknown; readonly description?: unknown }[] | null
): readonly { readonly date: string; readonly description?: string }[] => {
  if (!value) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry?.date !== 'string') {
        return null;
      }

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

const compareCalendarEntries = (
  left: PublicWasteCalendarEntry,
  right: PublicWasteCalendarEntry
): number =>
  left.date.localeCompare(right.date) ||
  left.fractionLabel.localeCompare(right.fractionLabel, 'de');

const normalizeShiftDescription = (value: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeReminderSlot = (value: unknown): PublicWasteReminderFractionSlotOption | null => {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value as PersistedReminderSlot;
  const maxLeadDays =
    typeof candidate.maxLeadDays === 'number'
      ? candidate.maxLeadDays
      : typeof candidate.max_lead_days === 'number'
        ? candidate.max_lead_days
        : null;
  const defaultLeadDays =
    typeof candidate.defaultLeadDays === 'number'
      ? candidate.defaultLeadDays
      : typeof candidate.default_lead_days === 'number'
        ? candidate.default_lead_days
        : null;

  if (
    typeof candidate.id !== 'string' ||
    typeof maxLeadDays !== 'number' ||
    typeof defaultLeadDays !== 'number' ||
    !Number.isInteger(maxLeadDays) ||
    !Number.isInteger(defaultLeadDays) ||
    maxLeadDays < 1 ||
    defaultLeadDays < 1
  ) {
    return null;
  }

  return {
    id: candidate.id,
    maxLeadDays,
    defaultLeadDays,
  };
};

const normalizeReminderFraction = (
  row: ReminderFractionRow,
  channel: PublicWasteReminderChannel
): PublicWasteReminderFractionOption | null => {
  if (!isRecord(row.reminder_config)) {
    return null;
  }

  const config = row.reminder_config as PersistedReminderConfig;
  const channels = isRecord(config.channels) ? config.channels : null;
  if (!channels || channels[channel] !== true) {
    return null;
  }

  const channelConfig = isRecord(config[channel]) ? config[channel] : null;
  if (!channelConfig || !Array.isArray(channelConfig.slots)) {
    return null;
  }

  const slots = channelConfig.slots
    .map(normalizeReminderSlot)
    .filter((slot): slot is PublicWasteReminderFractionSlotOption => slot !== null);
  if (slots.length === 0) {
    return null;
  }

  return {
    id: row.fraction_id,
    label: row.fraction_label,
    ...(row.fraction_color ? { color: row.fraction_color } : {}),
    slots,
  };
};

export const createPublicWasteRepository = (input: {
  readonly schemaName: string;
  readonly execute: SqlExecutor;
}) => {
  const schemaName = quoteIdentifier(input.schemaName);

  return {
    async listSelectionOptions(query: { readonly selection: PublicWasteSelectionState }): Promise<{
      readonly step: Exclude<PublicWasteSelectionStep, 'complete'>;
      readonly options: readonly PublicWasteSelectableEntry[];
    }> {
      const regionsResult = await input.execute<SelectionRow>({
        text: `
          SELECT DISTINCT r.id, r.name AS label
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
          INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
          INNER JOIN ${schemaName}.waste_regions r ON r.id = cl.region_id
          WHERE cl.active = true
            AND t.active = true
          ORDER BY label ASC;
        `,
      });

      let effectiveRegionId = query.selection.regionId;
      if (!effectiveRegionId && regionsResult.rows.length > 1) {
        return { step: 'region', options: mapOptions(regionsResult.rows) };
      }
      effectiveRegionId ??= regionsResult.rows[0]?.id;

      if (!query.selection.cityId) {
        const result = await input.execute<SelectionRow>({
          text: `
            SELECT DISTINCT c.id, c.name AS label
            FROM ${schemaName}.waste_collection_locations cl
            INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
            INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
            INNER JOIN ${schemaName}.waste_cities c ON c.id = cl.city_id
            WHERE cl.active = true
              AND t.active = true
              AND ($1::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $1::uuid)
            ORDER BY label ASC;
          `,
          values: [effectiveRegionId ?? null],
        });
        return { step: 'city', options: mapOptions(result.rows) };
      }

      if (!query.selection.streetId) {
        const result = await input.execute<SelectionRow>({
          text: `
            SELECT DISTINCT *
            FROM (
              SELECT
                s.id::text AS id,
                s.name AS label,
                false AS is_catch_all,
                1 AS sort_priority
              FROM ${schemaName}.waste_collection_locations cl
              INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
              INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
              INNER JOIN ${schemaName}.waste_streets s ON s.id = cl.street_id
              WHERE cl.active = true
                AND t.active = true
                AND cl.city_id = $1::uuid
                AND ($2::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $2::uuid)
              UNION
              SELECT
                '${PUBLIC_WASTE_CATCH_ALL_STREET_ID}' AS id,
                'Alle Straßen' AS label,
                true AS is_catch_all,
                0 AS sort_priority
              FROM ${schemaName}.waste_collection_locations cl
              INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
              INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
              WHERE cl.active = true
                AND t.active = true
                AND cl.city_id = $1::uuid
                AND cl.street_id IS NULL
                AND ($2::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $2::uuid)
            ) street_options
            ORDER BY
              sort_priority ASC,
              label ASC;
          `,
          values: [query.selection.cityId, effectiveRegionId ?? null],
        });
        return { step: 'street', options: mapOptions(result.rows) };
      }

      if (isCatchAllStreetSelection(query.selection.streetId)) {
        return { step: 'houseNumber', options: [] };
      }

      if (query.selection.houseNumberId) {
        return { step: 'houseNumber', options: [] };
      }

      const result = await input.execute<SelectionRow>({
        text: `
          SELECT DISTINCT hn.id, hn.number AS label
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
          INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
          INNER JOIN ${schemaName}.waste_house_numbers hn ON hn.id = cl.house_number_id
          WHERE cl.active = true
            AND t.active = true
            AND cl.city_id = $1::uuid
            AND cl.street_id = $2::uuid
            AND ($3::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $3::uuid)
          ORDER BY label ASC;
        `,
        values: [query.selection.cityId, query.selection.streetId, effectiveRegionId ?? null],
      });
      return { step: 'houseNumber', options: mapOptions(result.rows) };
    },

    async loadCalendarEntries(query: {
      readonly selection: PublicWasteResolvedSelection;
      readonly referenceDate: string;
    }): Promise<readonly PublicWasteCalendarEntry[]> {
      const streetSelectionFilter = createStreetSelectionFilter(query.selection.streetId);
      const linkedToursResult = await input.execute<CalendarEntryRow>({
        text: `
          SELECT
            ltl.id AS link_id,
            ltl.location_id::text,
            ltl.start_date::text AS link_start_date,
            ltl.end_date::text AS link_end_date,
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
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
          INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
          LEFT JOIN ${schemaName}.waste_custom_recurrence_presets crp ON crp.id = t.custom_recurrence_id
          LEFT JOIN ${schemaName}.waste_fractions f ON f.id::text = ANY(t.waste_fraction_ids)
          WHERE cl.active = true
            AND t.active = true
            AND cl.city_id = $1::uuid
            ${streetSelectionFilter.text}
            AND ($4::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $4::uuid)
            AND ($5::uuid IS NULL OR cl.house_number_id IS NULL OR cl.house_number_id = $5::uuid)
          ORDER BY t.name ASC, f.name ASC, ltl.id ASC;
        `,
        values: [
          query.selection.cityId,
          ...streetSelectionFilter.values,
          query.selection.regionId ?? null,
          query.selection.houseNumberId ?? null,
        ],
      });
      const normalizedReferenceDate = normalizeDateOnly(query.referenceDate);
      const windowStart = normalizedReferenceDate
        ? startOfPreviousYearUtc(normalizedReferenceDate)
        : null;
      const windowEnd = normalizedReferenceDate ? addYearsUtc(normalizedReferenceDate, 1) : null;

      const [
        tourDateShiftsResult,
        globalDateShiftsResult,
        tourAssignmentsResult,
        holidayRulesResult,
      ] = await Promise.all([
        input.execute<TourDateShiftRow>({
          text: `
                SELECT
                  id::text,
                  tour_id::text,
                  original_date,
                  actual_date,
                  description
                FROM ${schemaName}.waste_tour_date_shifts
                ORDER BY original_date ASC, actual_date ASC, id ASC;
              `,
        }),
        input.execute<GlobalDateShiftRow>({
          text: `
            SELECT
              id::text,
              original_date,
              actual_date,
              description,
              tour_ids
            FROM ${schemaName}.waste_global_date_shifts
            ORDER BY original_date ASC, actual_date ASC, id ASC;
          `,
        }),
        input.execute<TourAssignmentRow>({
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
            FROM ${schemaName}.waste_tour_assignments assignment
            INNER JOIN ${schemaName}.waste_tour_assignment_locations assignment_location
              ON assignment_location.assignment_id = assignment.id
            INNER JOIN ${schemaName}.waste_collection_locations cl
              ON cl.id = assignment_location.collection_location_id
            INNER JOIN ${schemaName}.waste_tours t ON t.id = assignment.tour_id
            LEFT JOIN ${schemaName}.waste_fractions f ON f.id::text = ANY(t.waste_fraction_ids)
            WHERE cl.active = true
              AND t.active = true
              AND cl.city_id = $1::uuid
              ${streetSelectionFilter.text}
              AND ($4::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $4::uuid)
              AND ($5::uuid IS NULL OR cl.house_number_id IS NULL OR cl.house_number_id = $5::uuid)
            ORDER BY assignment.pickup_date ASC, t.name ASC, f.name ASC, assignment.id ASC;
          `,
          values: [
            query.selection.cityId,
            ...streetSelectionFilter.values,
            query.selection.regionId ?? null,
            query.selection.houseNumberId ?? null,
          ],
        }),
        !windowStart || !windowEnd
          ? Promise.resolve({ rowCount: 0, rows: [] as readonly HolidayRuleRow[] })
          : input.execute<HolidayRuleRow>({
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
                FROM ${schemaName}.waste_holiday_rules
                WHERE holiday_date >= $1::date - INTERVAL '7 day'
                  AND holiday_date <= $2::date
                  AND scope IS NOT NULL
                  AND strategy IS NOT NULL
                ORDER BY holiday_date ASC, holiday_name ASC, id ASC;
              `,
              values: [windowStart, windowEnd],
            }),
      ]);

      const linkedTours = Array.from(
        linkedToursResult.rows.reduce<
          Map<
            string,
            {
              readonly linkId: string;
              readonly locationId: string;
              readonly startDate?: string;
              readonly endDate?: string;
              readonly tour: {
                readonly id: string;
                readonly name: string;
                readonly description?: string;
                readonly recurrence: CalendarEntryRow['tour_recurrence'];
                readonly customRecurrenceIntervalDays?: number;
                readonly firstDate?: string;
                readonly endDate?: string;
                readonly customDates: readonly {
                  readonly date: string;
                  readonly description?: string;
                }[];
                readonly fractions: {
                  id: string;
                  label: string;
                  description?: string;
                  shortLabel?: string;
                  color?: string;
                }[];
              };
            }
          >
        >((groups, row) => {
          const existing = groups.get(row.link_id);
          const fraction = row.fraction_id
            ? {
                id: row.fraction_id,
                label: row.fraction_label,
                ...(row.fraction_description?.trim()
                  ? { description: row.fraction_description.trim() }
                  : {}),
                ...(row.fraction_pdf_short_label
                  ? { shortLabel: row.fraction_pdf_short_label }
                  : {}),
                ...(row.fraction_color ? { color: row.fraction_color } : {}),
              }
            : null;

          if (existing) {
            if (fraction && !existing.tour.fractions.some((entry) => entry.id === fraction.id)) {
              existing.tour.fractions.push(fraction);
            }
            return groups;
          }

          groups.set(row.link_id, {
            linkId: row.link_id,
            locationId: row.location_id,
            ...(row.link_start_date ? { startDate: row.link_start_date } : {}),
            ...(row.link_end_date ? { endDate: row.link_end_date } : {}),
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
          return groups;
        }, new Map())
      ).map(([, entry]) => entry);

      const holidayRules = holidayRulesResult.rows.map((row) => ({
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

      const calculatedEntries = calculatePublicWasteCalendarEntries({
        referenceDate: query.referenceDate,
        selection: query.selection,
        linkedTours,
        tourDateShifts: tourDateShiftsResult.rows.map((row) => ({
          id: row.id,
          tourId: row.tour_id,
          originalDate: row.original_date,
          actualDate: row.actual_date,
          ...(row.description ? { description: row.description } : {}),
        })),
        globalDateShifts: globalDateShiftsResult.rows.map((row) => ({
          id: row.id,
          originalDate: row.original_date,
          actualDate: row.actual_date,
          ...(row.description ? { description: row.description } : {}),
          ...(row.tour_ids ? { tourIds: row.tour_ids } : {}),
        })),
        holidayRules,
      });

      if (!windowStart) {
        return calculatedEntries;
      }

      const effectiveWindowEnd = windowEnd;
      if (!effectiveWindowEnd) {
        return calculatedEntries;
      }

      const mergedEntries = new Map(calculatedEntries.map((entry) => [entry.id, entry] as const));
      const tourShiftEntries: Array<
        readonly [
          `${string}:${string}`,
          { readonly actualDate: string; readonly description: string | null },
        ]
      > = [];
      for (const row of tourDateShiftsResult.rows) {
        const originalDate = normalizeDateOnly(row.original_date);
        const actualDate = normalizeDateOnly(row.actual_date);
        if (!originalDate || !actualDate) {
          continue;
        }

        tourShiftEntries.push([
          `${row.tour_id}:${originalDate}`,
          {
            actualDate,
            description: normalizeShiftDescription(row.description),
          },
        ] as const);
      }

      const tourShiftMap = new Map(tourShiftEntries);
      const sharedGlobalShiftMap = new Map<
        string,
        { readonly actualDate: string; readonly description: string | null }
      >();
      const scopedGlobalShiftMap = new Map<
        string,
        Map<string, { readonly actualDate: string; readonly description: string | null }>
      >();

      for (const row of globalDateShiftsResult.rows) {
        const originalDate = normalizeDateOnly(row.original_date);
        const actualDate = normalizeDateOnly(row.actual_date);
        if (!originalDate || !actualDate) {
          continue;
        }

        const shift = {
          actualDate,
          description: normalizeShiftDescription(row.description),
        } as const;
        if (!row.tour_ids || row.tour_ids.length === 0) {
          sharedGlobalShiftMap.set(originalDate, shift);
          continue;
        }

        for (const tourId of row.tour_ids) {
          const tourShiftEntries = scopedGlobalShiftMap.get(tourId) ?? new Map();
          tourShiftEntries.set(originalDate, shift);
          scopedGlobalShiftMap.set(tourId, tourShiftEntries);
        }
      }

      const tourAssignmentRows = tourAssignmentsResult?.rows ?? [];
      for (const row of tourAssignmentRows) {
        const pickupDate = normalizeDateOnly(row.pickup_date);
        if (!pickupDate || !row.fraction_id || !row.fraction_label) {
          continue;
        }

        const tourShift = tourShiftMap.get(`${row.tour_id}:${pickupDate}`);
        const globalShift =
          scopedGlobalShiftMap.get(row.tour_id)?.get(pickupDate) ??
          sharedGlobalShiftMap.get(pickupDate);
        const shiftedDate = applyPublicWasteHolidayRulesToDate(
          tourShift?.actualDate ?? globalShift?.actualDate ?? pickupDate,
          holidayRules
        );
        if (!isDateWithinRange(shiftedDate, windowStart, effectiveWindowEnd)) {
          continue;
        }

        const calculatedEntryId = `${row.tour_id}:${shiftedDate}:${row.fraction_id}`;
        const entryId = `${row.assignment_id}:${row.fraction_id}`;
        const assignmentNote = row.note?.trim() || null;
        const note = assignmentNote ?? tourShift?.description ?? globalShift?.description ?? null;

        // A concrete assignment is the authoritative occurrence for this tour,
        // date, fraction and selected location. Other assignments intentionally
        // keep their own IDs so multiple deployments on one day remain visible.
        mergedEntries.delete(calculatedEntryId);

        mergedEntries.set(entryId, {
          id: entryId,
          date: shiftedDate,
          fractionId: row.fraction_id,
          fractionLabel: row.fraction_label,
          ...(row.fraction_description?.trim()
            ? { fractionDescription: row.fraction_description.trim() }
            : {}),
          ...(row.fraction_pdf_short_label
            ? { fractionShortLabel: row.fraction_pdf_short_label }
            : {}),
          ...(row.fraction_color ? { fractionColor: row.fraction_color } : {}),
          ...(row.tour_name.trim() ? { tourName: row.tour_name.trim() } : {}),
          ...(row.tour_description?.trim() ? { tourDescription: row.tour_description.trim() } : {}),
          note,
        });
      }

      return Array.from(mergedEntries.values()).sort(compareCalendarEntries);
    },

    async loadSelectionSummary(query: {
      readonly selection: PublicWasteResolvedSelection;
    }): Promise<string> {
      const streetSelectionFilter = createStreetSelectionFilter(query.selection.streetId);
      const result = await input.execute<{
        readonly city_label: string;
        readonly street_label: string | null;
        readonly house_number_label: string | null;
      }>({
        text: `
          SELECT
            c.name AS city_label,
            COALESCE(s.name, 'Alle Straßen') AS street_label,
            hn.number AS house_number_label
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_cities c ON c.id = cl.city_id
          LEFT JOIN ${schemaName}.waste_streets s ON s.id = cl.street_id
          LEFT JOIN ${schemaName}.waste_house_numbers hn ON hn.id = cl.house_number_id
          WHERE cl.active = true
            AND cl.city_id = $1::uuid
            ${streetSelectionFilter.text}
            AND ($4::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $4::uuid)
            AND ($5::uuid IS NULL OR cl.house_number_id = $5::uuid)
          ORDER BY
            CASE WHEN cl.street_id = $3::uuid THEN 0 ELSE 1 END ASC,
            CASE WHEN $5::uuid IS NOT NULL AND cl.house_number_id = $5::uuid THEN 0 ELSE 1 END ASC
          LIMIT 1;
        `,
        values: [
          query.selection.cityId,
          ...streetSelectionFilter.values,
          query.selection.regionId ?? null,
          query.selection.houseNumberId ?? null,
        ],
      });

      const row = result.rows[0];
      if (!row) {
        return [
          query.selection.cityId,
          [
            isCatchAllStreetSelection(query.selection.streetId)
              ? 'Alle Straßen'
              : query.selection.streetId,
            query.selection.houseNumberId,
          ]
            .filter(Boolean)
            .join(' '),
        ]
          .filter(Boolean)
          .join(', ');
      }

      return [row.city_label, [row.street_label, row.house_number_label].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ');
    },

    async loadReminderOptions(query: {
      readonly selection: PublicWasteResolvedSelection;
      readonly channel: PublicWasteReminderChannel;
    }): Promise<readonly PublicWasteReminderFractionOption[]> {
      const streetSelectionFilter = createStreetSelectionFilter(query.selection.streetId);
      const result = await input.execute<ReminderFractionRow>({
        text: `
          SELECT DISTINCT
            f.id AS fraction_id,
            f.name AS fraction_label,
            f.color AS fraction_color,
            f.reminder_config
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
          INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
          INNER JOIN ${schemaName}.waste_fractions f ON f.id::text = ANY(t.waste_fraction_ids)
          WHERE cl.active = true
            AND t.active = true
            AND f.active = true
            AND cl.city_id = $1::uuid
            ${streetSelectionFilter.text}
            AND ($4::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $4::uuid)
            AND ($5::uuid IS NULL OR cl.house_number_id IS NULL OR cl.house_number_id = $5::uuid)
          ORDER BY f.name ASC;
        `,
        values: [
          query.selection.cityId,
          ...streetSelectionFilter.values,
          query.selection.regionId ?? null,
          query.selection.houseNumberId ?? null,
        ],
      });

      return result.rows
        .map((row) => normalizeReminderFraction(row, query.channel))
        .filter((fraction): fraction is PublicWasteReminderFractionOption => fraction !== null);
    },
  };
};
