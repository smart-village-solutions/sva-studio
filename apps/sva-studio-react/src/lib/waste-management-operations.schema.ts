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

const wasteFractionShortLabelBackfillExpression =
  "COALESCE(NULLIF(UPPER(LEFT(REGEXP_REPLACE(name, '[^[:alnum:]]+', '', 'g'), 3)), ''), UPPER(LEFT(REPLACE(id::text, '-', ''), 3)))";

export const buildWasteFractionShortLabelBackfillStatement = (tableReference: string): string =>
  `
UPDATE ${tableReference}
SET pdf_short_label = ${wasteFractionShortLabelBackfillExpression}
WHERE pdf_short_label IS NULL OR BTRIM(pdf_short_label) = '';
`.trim();

const buildWasteFractionReminderConfigBackfillStatement = (tableReference: string): string =>
  `
UPDATE ${tableReference}
SET reminder_config = jsonb_strip_nulls(
  jsonb_build_object(
    'reminder_count',
    CASE
      WHEN reminder_count IN ('once', 'twice') AND (
        COALESCE(reminder_channel_push_enabled, FALSE) OR
        COALESCE(reminder_channel_email_enabled, FALSE) OR
        COALESCE(reminder_channel_calendar_enabled, FALSE)
      ) THEN reminder_count
      ELSE 'none'
    END,
    'channels',
    CASE
      WHEN reminder_count IN ('once', 'twice') THEN jsonb_build_object(
        'push', COALESCE(reminder_channel_push_enabled, FALSE),
        'email', COALESCE(reminder_channel_email_enabled, FALSE),
        'calendar', COALESCE(reminder_channel_calendar_enabled, FALSE)
      )
      ELSE jsonb_build_object(
        'push', FALSE,
        'email', FALSE,
        'calendar', FALSE
      )
    END,
    'push',
    CASE
      WHEN reminder_count IN ('once', 'twice') AND COALESCE(reminder_channel_push_enabled, FALSE) THEN jsonb_build_object(
        'slots',
        CASE
          WHEN reminder_count = 'twice' THEN jsonb_build_array(
            jsonb_build_object('id', id::text || ':push:first', 'max_lead_days', COALESCE(first_reminder_max_lead_days, 1), 'default_lead_days', 1),
            jsonb_build_object('id', id::text || ':push:second', 'max_lead_days', COALESCE(second_reminder_max_lead_days, 1), 'default_lead_days', 1)
          )
          ELSE jsonb_build_array(
            jsonb_build_object('id', id::text || ':push:first', 'max_lead_days', COALESCE(first_reminder_max_lead_days, 1), 'default_lead_days', 1)
          )
        END
      )
      ELSE NULL
    END,
    'email',
    CASE
      WHEN reminder_count IN ('once', 'twice') AND COALESCE(reminder_channel_email_enabled, FALSE) THEN jsonb_build_object(
        'slots',
        CASE
          WHEN reminder_count = 'twice' THEN jsonb_build_array(
            jsonb_build_object('id', id::text || ':email:first', 'max_lead_days', COALESCE(first_reminder_max_lead_days, 1), 'default_lead_days', 1),
            jsonb_build_object('id', id::text || ':email:second', 'max_lead_days', COALESCE(second_reminder_max_lead_days, 1), 'default_lead_days', 1)
          )
          ELSE jsonb_build_array(
            jsonb_build_object('id', id::text || ':email:first', 'max_lead_days', COALESCE(first_reminder_max_lead_days, 1), 'default_lead_days', 1)
          )
        END
      )
      ELSE NULL
    END,
    'calendar',
    CASE
      WHEN reminder_count IN ('once', 'twice') AND COALESCE(reminder_channel_calendar_enabled, FALSE) THEN jsonb_build_object(
        'slots',
        CASE
          WHEN reminder_count = 'twice' THEN jsonb_build_array(
            jsonb_build_object('id', id::text || ':calendar:first', 'max_lead_days', COALESCE(first_reminder_max_lead_days, 1), 'default_lead_days', 1),
            jsonb_build_object('id', id::text || ':calendar:second', 'max_lead_days', COALESCE(second_reminder_max_lead_days, 1), 'default_lead_days', 1)
          )
          ELSE jsonb_build_array(
            jsonb_build_object('id', id::text || ':calendar:first', 'max_lead_days', COALESCE(first_reminder_max_lead_days, 1), 'default_lead_days', 1)
          )
        END
      )
      ELSE NULL
    END
  )
)
WHERE reminder_config IS NULL;
`.trim();

const defaultWasteFractionReminderConfigJson = `'{"reminder_count":"none","channels":{"push":false,"email":false,"calendar":false}}'::jsonb`;

const buildWasteTourCascadeConstraintStatement = ({
  schema,
  schemaName,
  tableName,
}: {
  readonly schema: string;
  readonly schemaName: string;
  readonly tableName:
    | 'waste_location_tour_links'
    | 'waste_location_tour_pickup_dates'
    | 'waste_tour_assignments'
    | 'waste_tour_date_shifts';
}): string =>
  `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = '${schemaName}'
      AND table_name = '${tableName}'
  ) THEN
    ALTER TABLE ${schema}.${tableName}
      DROP CONSTRAINT IF EXISTS ${tableName}_tour_id_fkey,
      ADD CONSTRAINT ${tableName}_tour_id_fkey
      FOREIGN KEY (tour_id)
      REFERENCES ${schema}.waste_tours(id)
      ON DELETE CASCADE;
  END IF;
END $$;
`.trim();

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
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_fractions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, pdf_short_label TEXT, label_translations JSONB, container_size TEXT, color TEXT NOT NULL DEFAULT '#808080', description TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, reminder_count TEXT NOT NULL DEFAULT 'none' CHECK (reminder_count IN ('none', 'once', 'twice')), first_reminder_max_lead_days INTEGER CHECK (first_reminder_max_lead_days BETWEEN 1 AND 14), second_reminder_max_lead_days INTEGER CHECK (second_reminder_max_lead_days BETWEEN 1 AND 14), reminder_channel_push_enabled BOOLEAN NOT NULL DEFAULT FALSE, reminder_channel_email_enabled BOOLEAN NOT NULL DEFAULT FALSE, reminder_channel_calendar_enabled BOOLEAN NOT NULL DEFAULT FALSE, reminder_config JSONB NOT NULL DEFAULT ${defaultWasteFractionReminderConfigJson}, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `ALTER TABLE ${schema}.waste_fractions ADD COLUMN IF NOT EXISTS pdf_short_label TEXT;`,
    buildWasteFractionShortLabelBackfillStatement(`${schema}.waste_fractions`),
    `ALTER TABLE ${schema}.waste_fractions ALTER COLUMN pdf_short_label SET NOT NULL;`,
    `ALTER TABLE ${schema}.waste_fractions ADD COLUMN IF NOT EXISTS reminder_count TEXT NOT NULL DEFAULT 'none';`,
    `ALTER TABLE ${schema}.waste_fractions ADD COLUMN IF NOT EXISTS first_reminder_max_lead_days INTEGER;`,
    `ALTER TABLE ${schema}.waste_fractions ADD COLUMN IF NOT EXISTS second_reminder_max_lead_days INTEGER;`,
    `ALTER TABLE ${schema}.waste_fractions ADD COLUMN IF NOT EXISTS reminder_channel_push_enabled BOOLEAN NOT NULL DEFAULT FALSE;`,
    `ALTER TABLE ${schema}.waste_fractions ADD COLUMN IF NOT EXISTS reminder_channel_email_enabled BOOLEAN NOT NULL DEFAULT FALSE;`,
    `ALTER TABLE ${schema}.waste_fractions ADD COLUMN IF NOT EXISTS reminder_channel_calendar_enabled BOOLEAN NOT NULL DEFAULT FALSE;`,
    `ALTER TABLE ${schema}.waste_fractions ADD COLUMN IF NOT EXISTS reminder_config JSONB;`,
    buildWasteFractionReminderConfigBackfillStatement(`${schema}.waste_fractions`),
    `ALTER TABLE ${schema}.waste_fractions ALTER COLUMN reminder_config SET DEFAULT ${defaultWasteFractionReminderConfigJson};`,
    `ALTER TABLE ${schema}.waste_fractions ALTER COLUMN reminder_config SET NOT NULL;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint constraint_ref JOIN pg_class table_ref ON table_ref.oid = constraint_ref.conrelid JOIN pg_namespace schema_ref ON schema_ref.oid = table_ref.relnamespace WHERE constraint_ref.conname = 'waste_fractions_reminder_count_check' AND schema_ref.nspname = '${schemaName}' AND table_ref.relname = 'waste_fractions') THEN ALTER TABLE ${schema}.waste_fractions ADD CONSTRAINT waste_fractions_reminder_count_check CHECK (reminder_count IN ('none', 'once', 'twice')); END IF; END $$;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint constraint_ref JOIN pg_class table_ref ON table_ref.oid = constraint_ref.conrelid JOIN pg_namespace schema_ref ON schema_ref.oid = table_ref.relnamespace WHERE constraint_ref.conname = 'waste_fractions_first_reminder_max_lead_days_check' AND schema_ref.nspname = '${schemaName}' AND table_ref.relname = 'waste_fractions') THEN ALTER TABLE ${schema}.waste_fractions ADD CONSTRAINT waste_fractions_first_reminder_max_lead_days_check CHECK (first_reminder_max_lead_days IS NULL OR first_reminder_max_lead_days BETWEEN 1 AND 14); END IF; END $$;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint constraint_ref JOIN pg_class table_ref ON table_ref.oid = constraint_ref.conrelid JOIN pg_namespace schema_ref ON schema_ref.oid = table_ref.relnamespace WHERE constraint_ref.conname = 'waste_fractions_second_reminder_max_lead_days_check' AND schema_ref.nspname = '${schemaName}' AND table_ref.relname = 'waste_fractions') THEN ALTER TABLE ${schema}.waste_fractions ADD CONSTRAINT waste_fractions_second_reminder_max_lead_days_check CHECK (second_reminder_max_lead_days IS NULL OR second_reminder_max_lead_days BETWEEN 1 AND 14); END IF; END $$;`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_custom_recurrence_presets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, interval_days INTEGER NOT NULL CHECK (interval_days > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_tours (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, waste_fraction_ids TEXT[] NOT NULL DEFAULT '{}', recurrence TEXT CHECK (recurrence IN ('weekly', 'biweekly', 'fourweekly', 'yearly', 'on-demand', 'custom')), custom_recurrence_id UUID REFERENCES ${schema}.waste_custom_recurrence_presets(id) ON DELETE SET NULL, first_date DATE, end_date DATE, custom_dates JSONB, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `ALTER TABLE ${schema}.waste_tours ADD COLUMN IF NOT EXISTS custom_recurrence_id UUID;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint constraint_ref JOIN pg_class table_ref ON table_ref.oid = constraint_ref.conrelid JOIN pg_namespace schema_ref ON schema_ref.oid = table_ref.relnamespace WHERE constraint_ref.conname = 'waste_tours_custom_recurrence_id_fkey' AND schema_ref.nspname = '${schemaName}' AND table_ref.relname = 'waste_tours') THEN ALTER TABLE ${schema}.waste_tours ADD CONSTRAINT waste_tours_custom_recurrence_id_fkey FOREIGN KEY (custom_recurrence_id) REFERENCES ${schema}.waste_custom_recurrence_presets(id) ON DELETE SET NULL; END IF; END $$;`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_location_tour_links (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), location_id UUID NOT NULL REFERENCES ${schema}.waste_collection_locations(id) ON DELETE CASCADE, tour_id UUID NOT NULL REFERENCES ${schema}.waste_tours(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `DROP INDEX IF EXISTS ${schema}.idx_waste_location_tour_links_dates;`,
    `ALTER TABLE ${schema}.waste_location_tour_links DROP COLUMN IF EXISTS start_date, DROP COLUMN IF EXISTS end_date;`,
    buildWasteTourCascadeConstraintStatement({
      schema,
      schemaName,
      tableName: 'waste_location_tour_links',
    }),
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_location_tour_pickup_dates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), location_id UUID NOT NULL REFERENCES ${schema}.waste_collection_locations(id) ON DELETE CASCADE, tour_id UUID NOT NULL REFERENCES ${schema}.waste_tours(id) ON DELETE CASCADE, pickup_date DATE NOT NULL, note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT waste_location_tour_pickup_dates_location_tour_date_unique UNIQUE (location_id, tour_id, pickup_date));`,
    buildWasteTourCascadeConstraintStatement({
      schema,
      schemaName,
      tableName: 'waste_location_tour_pickup_dates',
    }),
    `ALTER TABLE ${schema}.waste_location_tour_pickup_dates ADD COLUMN IF NOT EXISTS note TEXT;`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_tour_assignments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tour_id UUID NOT NULL REFERENCES ${schema}.waste_tours(id) ON DELETE CASCADE, pickup_date DATE NOT NULL, note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    buildWasteTourCascadeConstraintStatement({
      schema,
      schemaName,
      tableName: 'waste_tour_assignments',
    }),
    `CREATE INDEX IF NOT EXISTS idx_waste_tour_assignments_tour_date ON ${schema}.waste_tour_assignments (tour_id, pickup_date);`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_tour_assignment_locations (assignment_id UUID NOT NULL REFERENCES ${schema}.waste_tour_assignments(id) ON DELETE CASCADE, collection_location_id UUID NOT NULL REFERENCES ${schema}.waste_collection_locations(id) ON DELETE CASCADE, PRIMARY KEY (assignment_id, collection_location_id));`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tour_assignment_locations_location ON ${schema}.waste_tour_assignment_locations (collection_location_id);`,
    `INSERT INTO ${schema}.waste_tour_assignments (id, tour_id, pickup_date, note, created_at, updated_at) SELECT legacy_pickup.id, legacy_pickup.tour_id, legacy_pickup.pickup_date, legacy_pickup.note, legacy_pickup.created_at, legacy_pickup.updated_at FROM ${schema}.waste_location_tour_pickup_dates AS legacy_pickup ON CONFLICT (id) DO NOTHING;`,
    `INSERT INTO ${schema}.waste_tour_assignment_locations (assignment_id, collection_location_id) SELECT assignment.id, legacy_pickup.location_id FROM ${schema}.waste_location_tour_pickup_dates AS legacy_pickup INNER JOIN ${schema}.waste_tour_assignments AS assignment ON assignment.id = legacy_pickup.id AND assignment.tour_id = legacy_pickup.tour_id AND assignment.pickup_date = legacy_pickup.pickup_date ON CONFLICT (assignment_id, collection_location_id) DO NOTHING;`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_email_reminder_subscriptions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL, email_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', region_id UUID REFERENCES ${schema}.waste_regions(id) ON DELETE SET NULL, city_id UUID NOT NULL REFERENCES ${schema}.waste_cities(id) ON DELETE RESTRICT, street_id TEXT NOT NULL, house_number_id UUID REFERENCES ${schema}.waste_house_numbers(id) ON DELETE SET NULL, location_label TEXT NOT NULL, consent_version TEXT NOT NULL, consent_accepted_at TIMESTAMPTZ NOT NULL, doi_token_hash TEXT NOT NULL, unsubscribe_token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, activated_at TIMESTAMPTZ, unsubscribed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT waste_email_reminder_subscriptions_status_check CHECK (status IN ('pending', 'active', 'unsubscribed', 'expired')), CONSTRAINT waste_email_reminder_subscriptions_doi_token_hash_unique UNIQUE (doi_token_hash), CONSTRAINT waste_email_reminder_subscriptions_unsubscribe_token_hash_unique UNIQUE (unsubscribe_token_hash));`,
    `CREATE INDEX IF NOT EXISTS idx_waste_email_reminder_subscriptions_email_location_status ON ${schema}.waste_email_reminder_subscriptions (email_hash, city_id, street_id, house_number_id, status);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_email_reminder_subscriptions_status_expires_at ON ${schema}.waste_email_reminder_subscriptions (status, expires_at);`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_email_reminder_subscription_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id UUID NOT NULL REFERENCES ${schema}.waste_email_reminder_subscriptions(id) ON DELETE CASCADE, fraction_id UUID NOT NULL REFERENCES ${schema}.waste_fractions(id) ON DELETE CASCADE, slot_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT waste_email_reminder_subscription_items_unique UNIQUE (subscription_id, fraction_id, slot_id));`,
    `CREATE INDEX IF NOT EXISTS idx_waste_email_reminder_subscription_items_subscription_id ON ${schema}.waste_email_reminder_subscription_items (subscription_id);`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_email_reminder_outbox (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id UUID NOT NULL REFERENCES ${schema}.waste_email_reminder_subscriptions(id) ON DELETE CASCADE, message_kind TEXT NOT NULL, transport_id TEXT NOT NULL, template_key TEXT NOT NULL, send_at TIMESTAMPTZ NOT NULL, dedupe_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', payload JSONB NOT NULL, leased_at TIMESTAMPTZ, sent_at TIMESTAMPTZ, attempt_count INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT waste_email_reminder_outbox_message_kind_check CHECK (message_kind IN ('doi', 'reminder')), CONSTRAINT waste_email_reminder_outbox_status_check CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')), CONSTRAINT waste_email_reminder_outbox_dedupe_key_unique UNIQUE (dedupe_key));`,
    `CREATE INDEX IF NOT EXISTS idx_waste_email_reminder_outbox_status_send_at ON ${schema}.waste_email_reminder_outbox (status, send_at);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_email_reminder_outbox_subscription_id ON ${schema}.waste_email_reminder_outbox (subscription_id);`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_tour_date_shifts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tour_id UUID NOT NULL REFERENCES ${schema}.waste_tours(id) ON DELETE CASCADE, original_date TEXT NOT NULL, actual_date TEXT NOT NULL, has_year BOOLEAN NOT NULL DEFAULT TRUE, reason_type TEXT, reason_key TEXT, follow_up_mode TEXT, description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    buildWasteTourCascadeConstraintStatement({
      schema,
      schemaName,
      tableName: 'waste_tour_date_shifts',
    }),
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_global_date_shifts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), original_date TEXT NOT NULL, actual_date TEXT NOT NULL, has_year BOOLEAN NOT NULL DEFAULT TRUE, reason_type TEXT, reason_key TEXT, description TEXT, tour_ids TEXT[], created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_holiday_rules (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), holiday_date DATE NOT NULL, holiday_name TEXT NOT NULL, year INTEGER NOT NULL, state_code TEXT NOT NULL, source_status TEXT NOT NULL CHECK (source_status IN ('confirmed', 'not-confirmed')), configuration_status TEXT NOT NULL CHECK (configuration_status IN ('draft', 'configured')), conflict_status TEXT NOT NULL CHECK (conflict_status IN ('none', 'manual-global-rule')), scope TEXT CHECK (scope IN ('holiday-only', 'full-week')), strategy TEXT CHECK (strategy IN ('advance', 'postpone')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT waste_holiday_rules_state_date_name_unique UNIQUE (state_code, holiday_date, holiday_name));`,
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_settings (id BOOLEAN PRIMARY KEY DEFAULT TRUE, pdf_branding_asset_url TEXT, pdf_contact_block TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT waste_settings_singleton_check CHECK (id = TRUE));`,
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
    `CREATE INDEX IF NOT EXISTS idx_waste_custom_recurrence_presets_name ON ${schema}.waste_custom_recurrence_presets(name);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_custom_recurrence_presets_interval_days ON ${schema}.waste_custom_recurrence_presets(interval_days);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_name ON ${schema}.waste_tours(name);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_active ON ${schema}.waste_tours(active);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_recurrence ON ${schema}.waste_tours(recurrence);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_custom_recurrence_id ON ${schema}.waste_tours(custom_recurrence_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tours_waste_fraction_ids ON ${schema}.waste_tours USING GIN(waste_fraction_ids);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_location_tour_links_location_id ON ${schema}.waste_location_tour_links(location_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_location_tour_links_tour_id ON ${schema}.waste_location_tour_links(tour_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_location_tour_pickup_dates_location_id ON ${schema}.waste_location_tour_pickup_dates(location_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_location_tour_pickup_dates_tour_id ON ${schema}.waste_location_tour_pickup_dates(tour_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_location_tour_pickup_dates_pickup_date ON ${schema}.waste_location_tour_pickup_dates(pickup_date);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tour_date_shifts_tour_id ON ${schema}.waste_tour_date_shifts(tour_id);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tour_date_shifts_original ON ${schema}.waste_tour_date_shifts(original_date);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_global_date_shifts_original ON ${schema}.waste_global_date_shifts(original_date);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_global_date_shifts_has_year ON ${schema}.waste_global_date_shifts(has_year);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_global_date_shifts_tour_ids ON ${schema}.waste_global_date_shifts USING GIN(tour_ids);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_holiday_rules_state_year ON ${schema}.waste_holiday_rules(state_code, year);`,
    `CREATE INDEX IF NOT EXISTS idx_waste_holiday_rules_holiday_date ON ${schema}.waste_holiday_rules(holiday_date);`,
  ];
};
