import type { SqlExecutor } from './public-waste-calendar-loader.server.js';
import type {
  PublicWasteResolvedSelection,
  PublicWasteReminderChannel,
  PublicWasteReminderFractionOption,
} from './public-waste-contract.js';
import {
  createStreetSelectionFilter,
  isCatchAllStreetSelection,
} from './public-waste-repository-selection.server.js';
import {
  normalizeReminderFraction,
  type ReminderFractionRow,
} from './public-waste-repository-mappers.server.js';

export const loadSelectionSummary = async (
  schemaName: string,
  execute: SqlExecutor,
  query: {
    readonly selection: PublicWasteResolvedSelection;
  }
): Promise<string> => {
  const streetSelectionFilter = createStreetSelectionFilter(query.selection.streetId);
  const result = await execute<{
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
};

export const loadReminderOptions = async (
  schemaName: string,
  execute: SqlExecutor,
  query: {
    readonly selection: PublicWasteResolvedSelection;
    readonly channel: PublicWasteReminderChannel;
  }
): Promise<readonly PublicWasteReminderFractionOption[]> => {
  const streetSelectionFilter = createStreetSelectionFilter(query.selection.streetId);
  const result = await execute<ReminderFractionRow>({
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
            AND t.status = 'published'
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
};
