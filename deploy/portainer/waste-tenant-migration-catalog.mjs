const mainserverRevisionTriggerSpecs = Object.freeze([
  ['waste_cities', ['name', 'postal_code']],
  ['waste_streets', ['name']],
  ['waste_house_numbers', ['number', 'street_id']],
  ['waste_collection_locations', ['city_id', 'street_id', 'house_number_id', 'active']],
  ['waste_fractions', ['name']],
  ['waste_custom_recurrence_presets', ['interval_days']],
  [
    'waste_tours',
    [
      'waste_fraction_ids',
      'recurrence',
      'custom_recurrence_id',
      'first_date',
      'end_date',
      'custom_dates',
      'active',
    ],
  ],
  ['waste_location_tour_links', ['location_id', 'tour_id']],
  ['waste_location_tour_pickup_dates', ['location_id', 'tour_id', 'pickup_date', 'note']],
  ['waste_tour_assignments', ['tour_id', 'pickup_date', 'note']],
  ['waste_tour_assignment_locations', ['assignment_id', 'collection_location_id']],
  [
    'waste_tour_date_shifts',
    ['tour_id', 'original_date', 'actual_date', 'has_year', 'follow_up_mode'],
  ],
  ['waste_global_date_shifts', ['original_date', 'actual_date', 'has_year', 'tour_ids']],
  ['waste_holiday_rules', ['holiday_date', 'scope', 'strategy']],
]);

const buildMainserverRevisionTriggerStatements = () => {
  const functionName = 'public.sva_bump_waste_mainserver_source_revision';
  const statements = [
    'CREATE TABLE IF NOT EXISTS public.waste_mainserver_source_state (id BOOLEAN PRIMARY KEY DEFAULT TRUE, source_revision BIGINT NOT NULL DEFAULT 0, changed_at TIMESTAMPTZ, CONSTRAINT waste_mainserver_source_state_singleton_check CHECK (id = TRUE), CONSTRAINT waste_mainserver_source_state_revision_check CHECK (source_revision >= 0));',
    'INSERT INTO public.waste_mainserver_source_state (id, source_revision, changed_at) VALUES (TRUE, 0, NULL) ON CONFLICT (id) DO NOTHING;',
    `CREATE OR REPLACE FUNCTION ${functionName}() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$ BEGIN UPDATE public.waste_mainserver_source_state SET source_revision = source_revision + 1, changed_at = statement_timestamp() WHERE id = TRUE; RETURN NULL; END; $$;`,
    `REVOKE ALL ON FUNCTION ${functionName}() FROM PUBLIC;`,
  ];

  for (const [tableName, updateColumns] of mainserverRevisionTriggerSpecs) {
    const suffix = tableName.replace(/^waste_/u, '');
    const changeTrigger = `sva_mainserver_revision_${suffix}_change`;
    const updateTrigger = `sva_mainserver_revision_${suffix}_update`;
    statements.push(
      `DROP TRIGGER IF EXISTS ${changeTrigger} ON public.${tableName};`,
      `CREATE TRIGGER ${changeTrigger} AFTER INSERT OR DELETE ON public.${tableName} FOR EACH STATEMENT EXECUTE FUNCTION ${functionName}();`,
      `DROP TRIGGER IF EXISTS ${updateTrigger} ON public.${tableName};`,
      `CREATE TRIGGER ${updateTrigger} AFTER UPDATE OF ${updateColumns.join(', ')} ON public.${tableName} FOR EACH STATEMENT EXECUTE FUNCTION ${functionName}();`
    );
  }

  return Object.freeze(statements);
};

export const wasteTenantMigrations = Object.freeze([
  Object.freeze({
    id: '20260816_01_add_waste_city_postal_code',
    statements: Object.freeze([
      'ALTER TABLE public.waste_cities ADD COLUMN IF NOT EXISTS postal_code TEXT;',
    ]),
    verification: Object.freeze({
      sql: `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = $2
            AND column_name = $3
        ) AS satisfied;
      `,
      values: Object.freeze(['public', 'waste_cities', 'postal_code']),
    }),
  }),
  Object.freeze({
    id: '20260816_02_tour_date_shift_date_contract',
    statements: Object.freeze([
      `DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM public.waste_tour_date_shifts LIMIT 1) THEN
          RAISE EXCEPTION 'waste_migration_tour_date_shift_data_present';
        END IF;
      END $$;`,
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'waste_tour_date_shifts'
            AND column_name = 'original_date'
            AND data_type <> 'date'
        ) THEN
          EXECUTE 'ALTER TABLE public.waste_tour_date_shifts ALTER COLUMN original_date TYPE DATE USING original_date::date';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'waste_tour_date_shifts'
            AND column_name = 'actual_date'
            AND data_type <> 'date'
        ) THEN
          EXECUTE 'ALTER TABLE public.waste_tour_date_shifts ALTER COLUMN actual_date TYPE DATE USING actual_date::date';
        END IF;
      END $$;`,
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_waste_tour_date_shifts_specific_origin ON public.waste_tour_date_shifts(tour_id, original_date) WHERE has_year;',
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_waste_tour_date_shifts_annual_origin ON public.waste_tour_date_shifts(tour_id, (EXTRACT(MONTH FROM original_date)), (EXTRACT(DAY FROM original_date))) WHERE NOT has_year;',
    ]),
    verification: Object.freeze({
      sql: `
        WITH date_columns AS (
          SELECT COUNT(*) = 2 AS satisfied
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'waste_tour_date_shifts'
            AND column_name IN ('original_date', 'actual_date')
            AND data_type = 'date'
        ), index_contracts AS (
          SELECT
            index_class.relname AS index_name,
            index_definition.indisunique,
            index_definition.indnkeyatts,
            pg_get_indexdef(index_definition.indexrelid, 1, TRUE) AS first_key,
            pg_get_indexdef(index_definition.indexrelid, 2, TRUE) AS second_key,
            pg_get_indexdef(index_definition.indexrelid, 3, TRUE) AS third_key,
            pg_get_expr(index_definition.indpred, index_definition.indrelid, TRUE) AS predicate
          FROM pg_index AS index_definition
          INNER JOIN pg_class AS table_class
            ON table_class.oid = index_definition.indrelid
          INNER JOIN pg_namespace AS table_namespace
            ON table_namespace.oid = table_class.relnamespace
          INNER JOIN pg_class AS index_class
            ON index_class.oid = index_definition.indexrelid
          WHERE table_namespace.nspname = 'public'
            AND table_class.relname = 'waste_tour_date_shifts'
            AND index_class.relname IN (
              'uq_waste_tour_date_shifts_specific_origin',
              'uq_waste_tour_date_shifts_annual_origin'
            )
        )
        SELECT
          (SELECT satisfied FROM date_columns)
          AND COALESCE((
            SELECT indisunique
              AND indnkeyatts = 2
              AND first_key = 'tour_id'
              AND second_key = 'original_date'
              AND regexp_replace(lower(predicate), '[[:space:]()]', '', 'g') = 'has_year'
            FROM index_contracts
            WHERE index_name = 'uq_waste_tour_date_shifts_specific_origin'
          ), FALSE)
          AND COALESCE((
            SELECT indisunique
              AND indnkeyatts = 3
              AND first_key = 'tour_id'
              AND regexp_replace(lower(second_key), '[[:space:]()]', '', 'g') =
                'extractmonthfromoriginal_date'
              AND regexp_replace(lower(third_key), '[[:space:]()]', '', 'g') =
                'extractdayfromoriginal_date'
              AND regexp_replace(lower(predicate), '[[:space:]()]', '', 'g') = 'nothas_year'
            FROM index_contracts
            WHERE index_name = 'uq_waste_tour_date_shifts_annual_origin'
          ), FALSE)
          AS satisfied;
      `,
      values: Object.freeze([]),
    }),
  }),
  Object.freeze({
    id: '20260824_01_add_german_numeric_collation',
    statements: Object.freeze([
      "CREATE COLLATION IF NOT EXISTS public.sva_de_numeric (provider = icu, locale = 'de-u-kn-true-ks-level2', deterministic = false);",
    ]),
    verification: Object.freeze({
      sql: `
        SELECT COALESCE((
          SELECT
            collation_row.collprovider = 'i'
            AND NOT collation_row.collisdeterministic
            AND collation_row.colliculocale IN ('de-u-kn-true-ks-level2', 'de-u-kn-ks-level2')
            AND collation_row.collversion = pg_collation_actual_version(collation_row.oid)
          FROM pg_collation AS collation_row
          INNER JOIN pg_namespace AS namespace_row
            ON namespace_row.oid = collation_row.collnamespace
          WHERE namespace_row.nspname = $1
            AND collation_row.collname = $2
        ), FALSE) AS satisfied;
      `,
      values: Object.freeze(['public', 'sva_de_numeric']),
    }),
  }),
  Object.freeze({
    id: '20260827_01_add_mainserver_source_revision',
    statements: buildMainserverRevisionTriggerStatements(),
    verification: Object.freeze({
      sql: `
        WITH state_contract AS (
          SELECT
            COUNT(*) = 3
            AND BOOL_AND(
              (column_name = 'id' AND data_type = 'boolean')
              OR (column_name = 'source_revision' AND data_type = 'bigint' AND is_nullable = 'NO')
              OR (column_name = 'changed_at' AND data_type = 'timestamp with time zone')
            ) AS satisfied
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'waste_mainserver_source_state'
            AND column_name IN ('id', 'source_revision', 'changed_at')
        ), function_contract AS (
          SELECT EXISTS (
            SELECT 1
            FROM pg_proc AS procedure_row
            INNER JOIN pg_namespace AS namespace_row
              ON namespace_row.oid = procedure_row.pronamespace
            WHERE namespace_row.nspname = 'public'
              AND procedure_row.proname = 'sva_bump_waste_mainserver_source_revision'
              AND procedure_row.prosecdef
          ) AS satisfied
        ), trigger_contract AS (
          SELECT COUNT(*) = $1::int AS satisfied
          FROM pg_trigger AS trigger_row
          INNER JOIN pg_class AS table_row
            ON table_row.oid = trigger_row.tgrelid
          INNER JOIN pg_namespace AS namespace_row
            ON namespace_row.oid = table_row.relnamespace
          WHERE namespace_row.nspname = 'public'
            AND NOT trigger_row.tgisinternal
            AND trigger_row.tgname LIKE 'sva_mainserver_revision_%'
        )
        SELECT
          (SELECT satisfied FROM state_contract)
          AND (SELECT satisfied FROM function_contract)
          AND (SELECT satisfied FROM trigger_contract)
          AS satisfied;
      `,
      values: Object.freeze([mainserverRevisionTriggerSpecs.length * 2]),
    }),
  }),
  Object.freeze({
    id: '20260901_01_add_waste_disruption_settings',
    statements: Object.freeze([
      'ALTER TABLE public.waste_settings ADD COLUMN IF NOT EXISTS disruption_location_enabled BOOLEAN NOT NULL DEFAULT FALSE;',
      'ALTER TABLE public.waste_settings ADD COLUMN IF NOT EXISTS disruption_all_locations_enabled BOOLEAN NOT NULL DEFAULT FALSE;',
    ]),
    verification: Object.freeze({
      sql: `
        SELECT COUNT(*) = 2
          AND BOOL_AND(data_type = 'boolean')
          AND BOOL_AND(is_nullable = 'NO')
          AND BOOL_AND(column_default = 'false') AS satisfied
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND column_name = ANY($3::text[]);
      `,
      values: Object.freeze([
        'public',
        'waste_settings',
        ['disruption_location_enabled', 'disruption_all_locations_enabled'],
      ]),
    }),
  }),
]);
