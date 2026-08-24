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
      'ALTER TABLE public.waste_tour_date_shifts ALTER COLUMN original_date TYPE DATE USING original_date::date;',
      'ALTER TABLE public.waste_tour_date_shifts ALTER COLUMN actual_date TYPE DATE USING actual_date::date;',
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
]);
