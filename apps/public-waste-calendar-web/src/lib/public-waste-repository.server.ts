import type {
  PublicWasteCalendarEntry,
  PublicWasteResolvedSelection,
  PublicWasteSelectableEntry,
  PublicWasteSelectionState,
  PublicWasteSelectionStep,
} from './public-waste-contract.js';
import { calculatePublicWasteCalendarEntries } from './public-waste-calendar-occurrences.js';

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
  readonly tour_recurrence: 'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom' | null;
  readonly tour_first_date: string | null;
  readonly tour_end_date: string | null;
  readonly tour_custom_dates: readonly { readonly date?: unknown; readonly description?: unknown }[] | null;
  readonly fraction_id: string;
  readonly fraction_label: string;
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
              AND ($1::uuid IS NULL OR cl.region_id = $1::uuid)
            ORDER BY label ASC;
          `,
          values: [effectiveRegionId ?? null],
        });
        return { step: 'city', options: mapOptions(result.rows) };
      }

      if (!query.selection.streetId) {
        const result = await input.execute<SelectionRow>({
          text: `
            SELECT DISTINCT
              s.id,
              s.name AS label,
              (s.name = 'Alle Straßen') AS is_catch_all,
              CASE WHEN s.name = 'Alle Straßen' THEN 0 ELSE 1 END AS sort_priority
            FROM ${schemaName}.waste_collection_locations cl
            INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
            INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
            INNER JOIN ${schemaName}.waste_streets s ON s.id = cl.street_id
            WHERE cl.active = true
              AND t.active = true
              AND cl.city_id = $1::uuid
              AND ($2::uuid IS NULL OR cl.region_id = $2::uuid)
            ORDER BY
              sort_priority ASC,
              label ASC;
          `,
          values: [query.selection.cityId, effectiveRegionId ?? null],
        });
        return { step: 'street', options: mapOptions(result.rows) };
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
            AND ($3::uuid IS NULL OR cl.region_id = $3::uuid)
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
      const linkedToursResult = await input.execute<CalendarEntryRow>({
        text: `
          SELECT
            ltl.id AS link_id,
            ltl.location_id::text,
            ltl.start_date::text AS link_start_date,
            ltl.end_date::text AS link_end_date,
            t.id::text AS tour_id,
            t.name AS tour_name,
            t.recurrence AS tour_recurrence,
            t.first_date::text AS tour_first_date,
            t.end_date::text AS tour_end_date,
            t.custom_dates AS tour_custom_dates,
            f.id AS fraction_id,
            f.name AS fraction_label,
            f.color AS fraction_color
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
          INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
          LEFT JOIN ${schemaName}.waste_fractions f ON f.id::text = ANY(t.waste_fraction_ids)
          WHERE cl.active = true
            AND t.active = true
            AND cl.city_id = $1::uuid
            AND cl.street_id = $2::uuid
            AND ($3::uuid IS NULL OR cl.region_id = $3::uuid)
            AND ($4::uuid IS NULL OR cl.house_number_id = $4::uuid)
          ORDER BY t.name ASC, f.name ASC, ltl.id ASC;
        `,
        values: [
          query.selection.cityId,
          query.selection.streetId,
          query.selection.regionId ?? null,
          query.selection.houseNumberId ?? null,
        ],
      });
      const tourIds = Array.from(new Set(linkedToursResult.rows.map((row) => row.tour_id)));

      const [tourDateShiftsResult, globalDateShiftsResult] = await Promise.all([
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
                readonly recurrence: CalendarEntryRow['tour_recurrence'];
                readonly firstDate?: string;
                readonly endDate?: string;
                readonly customDates: readonly { readonly date: string; readonly description?: string }[];
                readonly fractions: {
                  id: string;
                  label: string;
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
              recurrence: row.tour_recurrence,
              ...(row.tour_first_date ? { firstDate: row.tour_first_date } : {}),
              ...(row.tour_end_date ? { endDate: row.tour_end_date } : {}),
              customDates: normalizeCustomDates(row.tour_custom_dates),
              fractions: fraction ? [fraction] : [],
            },
          });
          return groups;
        }, new Map())
      ).map(([, entry]) => entry);

      return calculatePublicWasteCalendarEntries({
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
    },

    async loadSelectionSummary(query: {
      readonly selection: PublicWasteResolvedSelection;
    }): Promise<string> {
      const result = await input.execute<{
        readonly city_label: string;
        readonly street_label: string | null;
        readonly house_number_label: string | null;
      }>({
        text: `
          SELECT
            c.name AS city_label,
            s.name AS street_label,
            hn.number AS house_number_label
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_cities c ON c.id = cl.city_id
          LEFT JOIN ${schemaName}.waste_streets s ON s.id = cl.street_id
          LEFT JOIN ${schemaName}.waste_house_numbers hn ON hn.id = cl.house_number_id
          WHERE cl.active = true
            AND cl.city_id = $1::uuid
            AND cl.street_id = $2::uuid
            AND ($3::uuid IS NULL OR cl.region_id = $3::uuid)
            AND ($4::uuid IS NULL OR cl.house_number_id = $4::uuid)
          LIMIT 1;
        `,
        values: [
          query.selection.cityId,
          query.selection.streetId,
          query.selection.regionId ?? null,
          query.selection.houseNumberId ?? null,
        ],
      });

      const row = result.rows[0];
      if (!row) {
        return [query.selection.cityId, [query.selection.streetId, query.selection.houseNumberId].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(', ');
      }

      return [row.city_label, [row.street_label, row.house_number_label].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    },
  };
};
