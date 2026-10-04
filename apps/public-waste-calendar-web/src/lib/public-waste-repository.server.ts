import {
  loadPublicWasteCalendarEntries,
  type SqlExecutor,
} from './public-waste-calendar-loader.server.js';
import type {
  PublicWasteCalendarEntry,
  PublicWasteLocationCatalogEntry,
  PublicWasteReminderChannel,
  PublicWasteResolvedSelection,
  PublicWasteSelectionState,
  PublicWasteSelectionStep,
  PublicWasteSelectableEntry,
} from './public-waste-contract.js';
import { PUBLIC_WASTE_CATCH_ALL_STREET_ID } from './public-waste-contract.js';
import { isCatchAllStreetSelection } from './public-waste-repository-selection.server.js';
import {
  loadSelectionSummary,
  loadReminderOptions,
} from './public-waste-repository-summary-reminders.server.js';

export type PublicWasteRepository = ReturnType<typeof createPublicWasteRepository>;

import {
  quoteIdentifier,
  mapOptions,
  mapPublicLocation,
  comparePublicLocations,
  type SelectionRow,
  type PublicLocationRow,
} from './public-waste-repository-mappers.server.js';

export const createPublicWasteRepository = (input: {
  readonly schemaName: string;
  readonly execute: SqlExecutor;
}) => {
  const schemaName = quoteIdentifier(input.schemaName);

  return {
    async listPublicRegions(): Promise<readonly PublicWasteSelectableEntry[]> {
      const result = await input.execute<SelectionRow>({
        text: `
          SELECT r.id, r.name AS label
          FROM ${schemaName}.waste_regions r
          WHERE EXISTS (
            SELECT 1
            FROM ${schemaName}.waste_collection_locations cl
            INNER JOIN ${schemaName}.waste_location_tour_links ltl ON ltl.location_id = cl.id
            INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
            WHERE cl.region_id = r.id
              AND cl.active = true
              AND t.status = 'published'
          )
          ORDER BY label ASC;
        `,
      });
      return mapOptions(result.rows);
    },

    async listPublicLocations(): Promise<readonly PublicWasteLocationCatalogEntry[]> {
      const result = await input.execute<PublicLocationRow>({
        text: `
          SELECT
            cl.region_id::text AS region_id,
            r.name AS region_name,
            cl.city_id::text AS city_id,
            c.name AS city_name,
            cl.street_id::text AS street_id,
            s.name AS street_name,
            cl.house_number_id::text AS house_number_id,
            hn.number AS house_number_label
          FROM ${schemaName}.waste_collection_locations cl
          INNER JOIN ${schemaName}.waste_cities c ON c.id = cl.city_id
          LEFT JOIN ${schemaName}.waste_regions r ON r.id = cl.region_id
          LEFT JOIN ${schemaName}.waste_streets s ON s.id = cl.street_id
          LEFT JOIN ${schemaName}.waste_house_numbers hn ON hn.id = cl.house_number_id
          WHERE cl.active = true
            AND EXISTS (
              SELECT 1
              FROM ${schemaName}.waste_location_tour_links ltl
              INNER JOIN ${schemaName}.waste_tours t ON t.id = ltl.tour_id
              WHERE ltl.location_id = cl.id
                AND t.status = 'published'
            )
          ORDER BY
            r.name ASC NULLS FIRST,
            c.name ASC,
            s.name ASC NULLS FIRST,
            hn.number ASC NULLS FIRST,
            cl.region_id ASC NULLS FIRST,
            cl.city_id ASC,
            cl.street_id ASC NULLS FIRST,
            cl.house_number_id ASC NULLS FIRST;
        `,
      });
      const locationsByKey = new Map<string, PublicWasteLocationCatalogEntry>();
      for (const row of result.rows) {
        const location = mapPublicLocation(row);
        if (!locationsByKey.has(location.id)) {
          locationsByKey.set(location.id, location);
        }
      }
      return [...locationsByKey.values()].sort(comparePublicLocations);
    },

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
            AND t.status = 'published'
          ORDER BY label ASC;
        `,
      });

      let effectiveRegionId = query.selection.regionId?.toLowerCase();
      if (
        effectiveRegionId &&
        !regionsResult.rows.some((region) => region.id.toLowerCase() === effectiveRegionId)
      ) {
        return { step: 'city', options: [] };
      }
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
              AND t.status = 'published'
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
                AND t.status = 'published'
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
                AND t.status = 'published'
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
            AND t.status = 'published'
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
      return loadPublicWasteCalendarEntries({
        schemaName,
        execute: input.execute,
        query,
      });
    },
    loadSelectionSummary: (query: { readonly selection: PublicWasteResolvedSelection }) =>
      loadSelectionSummary(schemaName, input.execute, query),
    loadReminderOptions: (query: {
      readonly selection: PublicWasteResolvedSelection;
      readonly channel: PublicWasteReminderChannel;
    }) => loadReminderOptions(schemaName, input.execute, query),
  };
};
