import { quoteIdentifier, requiredWasteTables } from './waste-management-operations.shared.js';
import type { SqlClient } from './waste-management-operations.types.js';

export const inspectWasteSchema = async (client: SqlClient, schemaName: string) => {
  const tableQuery = await client.query<{ readonly table_name: string }>(
    `
SELECT table_name
FROM information_schema.tables
WHERE table_schema = $1
  AND table_name = ANY($2::text[])
ORDER BY table_name ASC;
`,
    [schemaName, [...requiredWasteTables]]
  );

  const presentTables = tableQuery.rows.map((row) => row.table_name);
  return {
    schemaName,
    presentTables,
    missingTables: requiredWasteTables.filter((tableName) => !presentTables.includes(tableName)),
  };
};

export const applySchemaStatements = (schemaName: string): readonly string[] => {
  const schema = quoteIdentifier(schemaName);
  return [
    'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
    'CREATE EXTENSION IF NOT EXISTS btree_gist;',
    `CREATE SCHEMA IF NOT EXISTS ${schema};`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_regions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_cities (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, region_id UUID REFERENCES ${schema}.waste_regions(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_streets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, city_id UUID NOT NULL REFERENCES ${schema}.waste_cities(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_house_numbers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), number TEXT NOT NULL, street_id UUID NOT NULL REFERENCES ${schema}.waste_streets(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_collection_locations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), city_id UUID NOT NULL REFERENCES ${schema}.waste_cities(id) ON DELETE CASCADE, region_id UUID REFERENCES ${schema}.waste_regions(id) ON DELETE SET NULL, street_id UUID REFERENCES ${schema}.waste_streets(id) ON DELETE SET NULL, house_number_id UUID REFERENCES ${schema}.waste_house_numbers(id) ON DELETE SET NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_fractions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, label_translations JSONB, container_size TEXT, color TEXT NOT NULL DEFAULT '#808080', description TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_tours (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, waste_fraction_ids TEXT[] NOT NULL DEFAULT '{}', recurrence TEXT CHECK (recurrence IN ('weekly', 'biweekly', 'fourweekly', 'yearly', 'on-demand', 'custom')), first_date DATE, end_date DATE, custom_dates JSONB, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_location_tour_links (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), location_id UUID NOT NULL REFERENCES ${schema}.waste_collection_locations(id) ON DELETE CASCADE, tour_id UUID NOT NULL REFERENCES ${schema}.waste_tours(id) ON DELETE CASCADE, start_date DATE, end_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_tour_date_shifts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tour_id UUID NOT NULL REFERENCES ${schema}.waste_tours(id) ON DELETE CASCADE, original_date TEXT NOT NULL, actual_date TEXT NOT NULL, has_year BOOLEAN NOT NULL DEFAULT TRUE, reason_type TEXT, reason_key TEXT, follow_up_mode TEXT, description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_global_date_shifts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), original_date TEXT NOT NULL, actual_date TEXT NOT NULL, has_year BOOLEAN NOT NULL DEFAULT TRUE, reason_type TEXT, reason_key TEXT, description TEXT, tour_ids TEXT[], created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `CREATE INDEX IF NOT EXISTS idx_waste_regions_name ON ${schema}.waste_regions(name);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_cities_name ON ${schema}.waste_cities(name);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_cities_region_id ON ${schema}.waste_cities(region_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_streets_name ON ${schema}.waste_streets(name);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_streets_city_id ON ${schema}.waste_streets(city_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_house_numbers_number ON ${schema}.waste_house_numbers(number);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_house_numbers_street_id ON ${schema}.waste_house_numbers(street_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_collection_locations_city_id ON ${schema}.waste_collection_locations(city_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_collection_locations_region_id ON ${schema}.waste_collection_locations(region_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_collection_locations_street_id ON ${schema}.waste_collection_locations(street_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_collection_locations_house_number_id ON ${schema}.waste_collection_locations(house_number_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_collection_locations_active ON ${schema}.waste_collection_locations(active);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_fractions_name ON ${schema}.waste_fractions(name);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_fractions_active ON ${schema}.waste_fractions(active);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_name ON ${schema}.waste_tours(name);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_active ON ${schema}.waste_tours(active);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_recurrence ON ${schema}.waste_tours(recurrence);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_waste_fraction_ids ON ${schema}.waste_tours USING GIN(waste_fraction_ids);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_location_tour_links_location_id ON ${schema}.waste_location_tour_links(location_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_location_tour_links_tour_id ON ${schema}.waste_location_tour_links(tour_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_location_tour_links_dates ON ${schema}.waste_location_tour_links(start_date, end_date);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tour_date_shifts_tour_id ON ${schema}.waste_tour_date_shifts(tour_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tour_date_shifts_original ON ${schema}.waste_tour_date_shifts(original_date);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_global_date_shifts_original ON ${schema}.waste_global_date_shifts(original_date);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_global_date_shifts_has_year ON ${schema}.waste_global_date_shifts(has_year);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_global_date_shifts_tour_ids ON ${schema}.waste_global_date_shifts USING GIN(tour_ids);`,
  ];
};
