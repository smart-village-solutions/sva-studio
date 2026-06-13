import type {
  PublicWasteCalendarEntry,
  PublicWasteResolvedSelection,
  PublicWasteSelectableEntry,
  PublicWasteSelectionState,
  PublicWasteSelectionStep,
} from './public-waste-contract.js';
import { calculatePublicWasteCalendarEntries } from './public-waste-calendar-occurrences.js';
import { PUBLIC_WASTE_CATCH_ALL_STREET_ID } from './public-waste-contract.js';
import { addYearsUtc, isDateWithinRange, normalizeDateOnly } from './public-waste-date-utils.js';

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
  readonly link_start_date: string | null;
  readonly link_end_date: string | null;
  readonly tour_id: string;
  readonly tour_name: string;
  readonly tour_description: string | null;
  readonly tour_recurrence: 'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom' | null;
  readonly tour_custom_recurrence_interval_days: number | null;
  readonly tour_first_date: string | null;
  readonly tour_end_date: string | null;
  readonly tour_custom_dates: readonly { readonly date?: unknown; readonly description?: unknown }[] | null;
  readonly fraction_id: string;
  readonly fraction_label: string;
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

type ImportedPickupDateRow = {
  readonly location_id: string;
  readonly pickup_date: string;
  readonly tour_id: string;
  readonly tour_name: string;
  readonly tour_description: string | null;
  readonly fraction_id: string | null;
  readonly fraction_label: string | null;
  readonly fraction_pdf_short_label: string | null;
  readonly fraction_color: string | null;
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

const isCatchAllStreetSelection = (streetId: string | undefined): streetId is typeof PUBLIC_WASTE_CATCH_ALL_STREET_ID =>
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
    .filter((entry): entry is { readonly date: string; readonly description?: string } => entry !== null);
};

const compareCalendarEntries = (left: PublicWasteCalendarEntry, right: PublicWasteCalendarEntry): number =>
  left.date.localeCompare(right.date) || left.fractionLabel.localeCompare(right.fractionLabel, 'de');

const normalizeShiftDescription = (value: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const createPublicWasteRepository = (input: {
  readonly schemaName: string;
  readonly execute: SqlExecutor;
}) => {
  const schemaName = quoteIdentifier(input.schemaName);

  return {
    async listSelectionOptions(query: {
      readonly selection: PublicWasteSelectionState;
    }): Promise<{
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
      const tourIds = Array.from(new Set(linkedToursResult.rows.map((row) => row.tour_id)));

      const [tourDateShiftsResult, globalDateShiftsResult, importedPickupDatesResult] = await Promise.all([
        tourIds.length === 0
          ? Promise.resolve({ rowCount: 0, rows: [] as readonly TourDateShiftRow[] })
          : input.execute<TourDateShiftRow>({
              text: `
                SELECT
                  id::text,
                  tour_id::text,
                  original_date,
                  actual_date,
                  description
                FROM ${schemaName}.waste_tour_date_shifts
                WHERE tour_id::text = ANY($1::text[])
                ORDER BY original_date ASC, actual_date ASC, id ASC;
              `,
              values: [tourIds],
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
        input.execute<ImportedPickupDateRow>({
          text: `
            SELECT
              p.location_id::text AS location_id,
              p.pickup_date::text AS pickup_date,
              t.id::text AS tour_id,
              t.name AS tour_name,
              t.description AS tour_description,
              f.id AS fraction_id,
              f.name AS fraction_label,
              f.pdf_short_label AS fraction_pdf_short_label,
              f.color AS fraction_color
            FROM ${schemaName}.waste_collection_locations cl
            INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
            INNER JOIN ${schemaName}.waste_location_tour_pickup_dates p
              ON p.location_id = ltl.location_id
             AND p.tour_id = ltl.tour_id
            INNER JOIN ${schemaName}.waste_tours t ON t.id = p.tour_id
            LEFT JOIN ${schemaName}.waste_fractions f ON f.id::text = ANY(t.waste_fraction_ids)
            WHERE cl.active = true
              AND t.active = true
              AND cl.city_id = $1::uuid
              ${streetSelectionFilter.text}
              AND ($4::uuid IS NULL OR cl.region_id IS NULL OR cl.region_id = $4::uuid)
              AND ($5::uuid IS NULL OR cl.house_number_id IS NULL OR cl.house_number_id = $5::uuid)
              AND (ltl.start_date IS NULL OR p.pickup_date >= ltl.start_date)
              AND (ltl.end_date IS NULL OR p.pickup_date <= ltl.end_date)
            ORDER BY p.pickup_date ASC, t.name ASC, f.name ASC;
          `,
          values: [
            query.selection.cityId,
            ...streetSelectionFilter.values,
            query.selection.regionId ?? null,
            query.selection.houseNumberId ?? null,
          ],
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
                readonly customDates: readonly { readonly date: string; readonly description?: string }[];
                readonly fractions: {
                  id: string;
                  label: string;
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
                ...(row.fraction_pdf_short_label ? { shortLabel: row.fraction_pdf_short_label } : {}),
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
      });

      const windowStart = normalizeDateOnly(query.referenceDate);
      if (!windowStart) {
        return calculatedEntries;
      }

      const windowEnd = addYearsUtc(windowStart, 1);
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
      const sharedGlobalShiftMap = new Map<string, { readonly actualDate: string; readonly description: string | null }>();
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

      const importedPickupDateRows = importedPickupDatesResult?.rows ?? [];

      for (const row of importedPickupDateRows) {
        const pickupDate = normalizeDateOnly(row.pickup_date);
        if (!pickupDate || !row.fraction_id || !row.fraction_label) {
          continue;
        }

        const hasValidLinkAssignment = linkedTours.some((linkedTour) => {
          if (linkedTour.locationId !== row.location_id || linkedTour.tour.id !== row.tour_id) {
            return false;
          }

          if (linkedTour.startDate && pickupDate < linkedTour.startDate) {
            return false;
          }

          if (linkedTour.endDate && pickupDate > linkedTour.endDate) {
            return false;
          }

          return true;
        });
        if (!hasValidLinkAssignment) {
          continue;
        }

        const tourShift = tourShiftMap.get(`${row.tour_id}:${pickupDate}`);
        const globalShift = scopedGlobalShiftMap.get(row.tour_id)?.get(pickupDate) ?? sharedGlobalShiftMap.get(pickupDate);
        const shiftedDate = tourShift?.actualDate ?? globalShift?.actualDate ?? pickupDate;
        if (!isDateWithinRange(shiftedDate, windowStart, windowEnd)) {
          continue;
        }

        const entryId = `${row.tour_id}:${shiftedDate}:${row.fraction_id}`;
        if (mergedEntries.has(entryId)) {
          continue;
        }

        mergedEntries.set(entryId, {
          id: entryId,
          date: shiftedDate,
          fractionId: row.fraction_id,
          fractionLabel: row.fraction_label,
          ...(row.fraction_pdf_short_label ? { fractionShortLabel: row.fraction_pdf_short_label } : {}),
          ...(row.fraction_color ? { fractionColor: row.fraction_color } : {}),
          ...(row.tour_name.trim() ? { tourName: row.tour_name.trim() } : {}),
          ...(row.tour_description?.trim() ? { tourDescription: row.tour_description.trim() } : {}),
          note: tourShift?.description ?? globalShift?.description ?? null,
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
            isCatchAllStreetSelection(query.selection.streetId) ? 'Alle Straßen' : query.selection.streetId,
            query.selection.houseNumberId,
          ]
            .filter(Boolean)
            .join(' '),
        ]
          .filter(Boolean)
          .join(', ');
      }

      return [row.city_label, [row.street_label, row.house_number_label].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    },
  };
};
