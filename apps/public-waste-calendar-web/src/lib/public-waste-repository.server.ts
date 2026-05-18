import type {
  PublicWasteCalendarEntry,
  PublicWasteSelectableEntry,
  PublicWasteSelectionState,
  PublicWasteSelectionStep,
} from './public-waste-contract.js';

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
};

type CalendarEntryRow = {
  readonly id: string;
  readonly pickup_date: string;
  readonly fraction_id: string;
  readonly fraction_label: string;
  readonly note: string | null;
};

export type PublicWasteRepository = ReturnType<typeof createPublicWasteRepository>;

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const quoteIdentifier = (value: string): string => {
  if (!schemaIdentifierPattern.test(value)) {
    throw new Error(`invalid_waste_schema:${value}`);
  }
  return `"${value}"`;
};

const determineSelectionStep = (selection: PublicWasteSelectionState): Exclude<PublicWasteSelectionStep, 'complete'> => {
  if (!selection.regionId) {
    return 'region';
  }
  if (!selection.cityId) {
    return 'city';
  }
  if (!selection.streetId) {
    return 'street';
  }
  return 'houseNumber';
};

const mapOptions = (rows: readonly SelectionRow[]): readonly PublicWasteSelectableEntry[] =>
  rows.map((row) => ({
    id: row.id,
    label: row.label,
  }));

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
      const step = determineSelectionStep(query.selection);

      if (step === 'region') {
        const result = await input.execute<SelectionRow>({
          text: `SELECT id, name AS label FROM ${schemaName}.waste_regions ORDER BY name ASC;`,
        });
        return { step, options: mapOptions(result.rows) };
      }

      if (step === 'city') {
        const result = await input.execute<SelectionRow>({
          text: `SELECT id, name AS label FROM ${schemaName}.waste_cities WHERE region_id = $1 ORDER BY name ASC;`,
          values: [query.selection.regionId],
        });
        return { step, options: mapOptions(result.rows) };
      }

      if (step === 'street') {
        const result = await input.execute<SelectionRow>({
          text: `SELECT id, name AS label FROM ${schemaName}.waste_streets WHERE city_id = $1 ORDER BY name ASC;`,
          values: [query.selection.cityId],
        });
        return { step, options: mapOptions(result.rows) };
      }

      const result = await input.execute<SelectionRow>({
        text: `SELECT id, number AS label FROM ${schemaName}.waste_house_numbers WHERE street_id = $1 ORDER BY number ASC;`,
        values: [query.selection.streetId],
      });
      return { step, options: mapOptions(result.rows) };
    },

    async loadCalendarEntries(query: {
      readonly selection: Required<PublicWasteSelectionState>;
    }): Promise<readonly PublicWasteCalendarEntry[]> {
      const result = await input.execute<CalendarEntryRow>({
        text: `
          SELECT
            ltpd.id,
            ltpd.pickup_date,
            f.id AS fraction_id,
            f.name AS fraction_label,
            NULL::text AS note
          FROM ${schemaName}.waste_location_tour_pickup_dates ltpd
          INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.id = ltpd.location_tour_link_id
          INNER JOIN ${schemaName}.waste_collection_locations cl ON cl.id = ltl.collection_location_id
          INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
          LEFT JOIN ${schemaName}.waste_fractions f ON f.id = ANY(t.waste_fraction_ids)
          WHERE cl.region_id = $1
            AND cl.city_id = $2
            AND cl.street_id = $3
            AND cl.house_number_id = $4
          ORDER BY ltpd.pickup_date ASC;
        `,
        values: [
          query.selection.regionId,
          query.selection.cityId,
          query.selection.streetId,
          query.selection.houseNumberId,
        ],
      });

      return result.rows.map((row) => ({
        id: row.id,
        date: row.pickup_date,
        fractionId: row.fraction_id,
        fractionLabel: row.fraction_label,
        note: row.note,
      }));
    },
  };
};
