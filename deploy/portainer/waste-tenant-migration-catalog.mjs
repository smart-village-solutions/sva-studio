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
            AND table_row.relname <> 'waste_tour_fractions'
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
  Object.freeze({
    id: '20260915_01_add_waste_tour_status',
    statements: Object.freeze([
      'ALTER TABLE public.waste_tours ADD COLUMN IF NOT EXISTS status TEXT;',
      "UPDATE public.waste_tours SET status = CASE WHEN active THEN 'published' ELSE 'draft' END WHERE status IS NULL;",
      'ALTER TABLE public.waste_tours ALTER COLUMN status DROP DEFAULT;',
      'ALTER TABLE public.waste_tours ALTER COLUMN status SET NOT NULL;',
      'ALTER TABLE public.waste_tours ALTER COLUMN active DROP DEFAULT;',
      `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint AS constraint_row
          WHERE constraint_row.conrelid = 'public.waste_tours'::regclass
            AND constraint_row.conname = 'waste_tours_status_check'
        ) THEN
          ALTER TABLE public.waste_tours
            ADD CONSTRAINT waste_tours_status_check
            CHECK (status IN ('draft', 'published', 'archived'));
        END IF;
      END $$;`,
      `CREATE OR REPLACE FUNCTION public.sync_waste_tour_status_active()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $waste_tour_status$
      BEGIN
        IF TG_OP = 'UPDATE' AND TG_NARGS = 1 THEN
          IF TG_ARGV[0] = 'status'
            AND NEW.active IS DISTINCT FROM OLD.active
            AND NEW.active IS DISTINCT FROM (NEW.status = 'published') THEN
            RAISE EXCEPTION 'waste_tour_status_active_conflict';
          ELSIF TG_ARGV[0] = 'active'
            AND NEW.status IS DISTINCT FROM OLD.status
            AND NEW.active IS DISTINCT FROM (NEW.status = 'published') THEN
            RAISE EXCEPTION 'waste_tour_status_active_conflict';
          END IF;
          RETURN NEW;
        ELSIF TG_OP = 'INSERT' THEN
          IF NEW.status IS NULL AND NEW.active IS NULL THEN
            NEW.status := 'draft';
            NEW.active := FALSE;
          ELSIF NEW.status IS NULL THEN
            NEW.status := CASE WHEN NEW.active THEN 'published' ELSE 'draft' END;
          ELSIF NEW.active IS NULL THEN
            NEW.active := NEW.status = 'published';
          ELSIF NEW.active IS DISTINCT FROM (NEW.status = 'published') THEN
            RAISE EXCEPTION 'waste_tour_status_active_conflict';
          END IF;
        ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.active IS DISTINCT FROM OLD.active THEN
          IF NEW.active IS DISTINCT FROM (NEW.status = 'published') THEN
            RAISE EXCEPTION 'waste_tour_status_active_conflict';
          END IF;
        ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
          NEW.active := NEW.status = 'published';
        ELSIF NEW.active IS DISTINCT FROM OLD.active THEN
          NEW.status := CASE WHEN NEW.active THEN 'published' ELSE 'draft' END;
        END IF;

        RETURN NEW;
      END;
      $waste_tour_status$;`,
      'DROP TRIGGER IF EXISTS waste_tours_sync_status_active ON public.waste_tours;',
      'DROP TRIGGER IF EXISTS waste_tours_a_validate_status_write ON public.waste_tours;',
      "CREATE TRIGGER waste_tours_a_validate_status_write BEFORE UPDATE OF status ON public.waste_tours FOR EACH ROW EXECUTE FUNCTION public.sync_waste_tour_status_active('status');",
      'DROP TRIGGER IF EXISTS waste_tours_a_validate_active_write ON public.waste_tours;',
      "CREATE TRIGGER waste_tours_a_validate_active_write BEFORE UPDATE OF active ON public.waste_tours FOR EACH ROW EXECUTE FUNCTION public.sync_waste_tour_status_active('active');",
      'CREATE TRIGGER waste_tours_sync_status_active BEFORE INSERT OR UPDATE OF status, active ON public.waste_tours FOR EACH ROW EXECUTE FUNCTION public.sync_waste_tour_status_active();',
      'CREATE INDEX IF NOT EXISTS idx_waste_tours_status ON public.waste_tours(status);',
      'DROP TRIGGER IF EXISTS sva_mainserver_revision_tours_update ON public.waste_tours;',
      'CREATE TRIGGER sva_mainserver_revision_tours_update AFTER UPDATE OF waste_fraction_ids, recurrence, custom_recurrence_id, first_date, end_date, custom_dates, status, active ON public.waste_tours FOR EACH STATEMENT EXECUTE FUNCTION public.sva_bump_waste_mainserver_source_revision();',
    ]),
    verification: Object.freeze({
      sql: `
        WITH column_contract AS (
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'waste_tours'
              AND column_name = 'status'
              AND data_type = 'text'
              AND is_nullable = 'NO'
              AND column_default IS NULL
          ) AS satisfied
        ), constraint_contract AS (
          SELECT EXISTS (
            SELECT 1
            FROM pg_constraint AS constraint_row
            WHERE constraint_row.conrelid = 'public.waste_tours'::regclass
              AND constraint_row.conname = 'waste_tours_status_check'
              AND constraint_row.convalidated
          ) AS satisfied
        ), active_compatibility_column_contract AS (
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'waste_tours'
              AND column_name = 'active'
              AND data_type = 'boolean'
              AND is_nullable = 'NO'
              AND column_default IS NULL
          ) AS satisfied
        ), index_contract AS (
          SELECT EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'waste_tours'
              AND indexname = 'idx_waste_tours_status'
          ) AS satisfied
        ), compatibility_contract AS (
          SELECT COUNT(*) = 4 AS satisfied
          FROM pg_trigger AS trigger_row
          INNER JOIN pg_class AS table_row ON table_row.oid = trigger_row.tgrelid
          INNER JOIN pg_namespace AS namespace_row ON namespace_row.oid = table_row.relnamespace
          WHERE namespace_row.nspname = 'public'
            AND table_row.relname = 'waste_tours'
            AND NOT trigger_row.tgisinternal
            AND trigger_row.tgname IN (
              'waste_tours_a_validate_active_write',
              'waste_tours_a_validate_status_write',
              'waste_tours_sync_status_active',
              'sva_mainserver_revision_tours_update'
            )
        )
        SELECT
          (SELECT satisfied FROM column_contract)
          AND (SELECT satisfied FROM active_compatibility_column_contract)
          AND (SELECT satisfied FROM constraint_contract)
          AND (SELECT satisfied FROM index_contract)
          AND (SELECT satisfied FROM compatibility_contract)
          AS satisfied;
      `,
      values: Object.freeze([]),
    }),
  }),
  Object.freeze({
    id: '20261018_01_add_waste_email_reminder_settings',
    statements: Object.freeze([
      'ALTER TABLE public.waste_settings ADD COLUMN IF NOT EXISTS email_reminder_config JSONB;',
      'ALTER TABLE public.waste_settings ADD COLUMN IF NOT EXISTS email_reminder_signing_secret TEXT;',
    ]),
    verification: Object.freeze({
      sql: `SELECT COUNT(*) = 2
        AND BOOL_AND(is_nullable = 'YES')
        AND BOOL_AND((column_name = 'email_reminder_config' AND data_type = 'jsonb')
          OR (column_name = 'email_reminder_signing_secret' AND data_type = 'text')) AS satisfied
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'waste_settings'
          AND column_name = ANY($1::text[]);`,
      values: Object.freeze([['email_reminder_config', 'email_reminder_signing_secret']]),
    }),
  }),
  Object.freeze({
    id: '20261030_01_expand_waste_tour_fractions',
    statements: Object.freeze([
      `CREATE TABLE IF NOT EXISTS "public".waste_tour_fractions (
      tour_id UUID NOT NULL REFERENCES "public".waste_tours(id) ON DELETE CASCADE,
      fraction_id UUID NOT NULL REFERENCES "public".waste_fractions(id) ON DELETE RESTRICT,
      position INTEGER NOT NULL CHECK (position >= 0),
      PRIMARY KEY (tour_id, fraction_id), UNIQUE (tour_id, position));`,
      `CREATE INDEX IF NOT EXISTS idx_waste_tour_fractions_fraction ON "public".waste_tour_fractions(fraction_id);`,
      `DO $expand$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'waste_tours' AND column_name = 'waste_fraction_ids') THEN
    LOCK TABLE "public".waste_tours, "public".waste_fractions IN SHARE ROW EXCLUSIVE MODE;
    IF EXISTS (SELECT 1 FROM "public".waste_tours t, unnest(t.waste_fraction_ids) AS f(value)
      WHERE value IS NULL OR btrim(value) = '') THEN
      RAISE EXCEPTION 'waste_migration_tour_fractions_invalid_id';
    END IF;
    IF EXISTS (SELECT 1 FROM "public".waste_tours t, unnest(t.waste_fraction_ids) AS f(value)
      GROUP BY t.id, value::uuid HAVING count(*) > 1) THEN
      RAISE EXCEPTION 'waste_migration_tour_fractions_duplicate';
    END IF;
    INSERT INTO "public".waste_tour_fractions(tour_id, fraction_id, position)
      SELECT t.id, value::uuid, (n - 1)::integer FROM "public".waste_tours t,
        unnest(t.waste_fraction_ids) WITH ORDINALITY AS f(value, n)
      ON CONFLICT (tour_id, fraction_id) DO NOTHING;
    IF EXISTS (
    SELECT 1 FROM "public".waste_tours t
    WHERE ARRAY(SELECT value::uuid FROM unnest(t.waste_fraction_ids) WITH ORDINALITY AS f(value, n) ORDER BY n)
      IS DISTINCT FROM ARRAY(SELECT fraction_id FROM "public".waste_tour_fractions tf
        WHERE tf.tour_id = t.id ORDER BY position)
  ) THEN RAISE EXCEPTION 'waste_migration_tour_fractions_mismatch'; END IF;
    CREATE OR REPLACE FUNCTION "public".sync_waste_tour_fractions()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $bridge$
    BEGIN
      DELETE FROM "public".waste_tour_fractions WHERE tour_id = NEW.id;
      INSERT INTO "public".waste_tour_fractions(tour_id, fraction_id, position)
        SELECT NEW.id, value::uuid, (n - 1)::integer
        FROM unnest(NEW.waste_fraction_ids) WITH ORDINALITY AS f(value, n);
      RETURN NEW;
    END; $bridge$;
    REVOKE ALL ON FUNCTION "public".sync_waste_tour_fractions() FROM PUBLIC;
    DROP TRIGGER IF EXISTS waste_tours_sync_fractions ON "public".waste_tours;
    CREATE TRIGGER waste_tours_sync_fractions AFTER INSERT OR UPDATE OF waste_fraction_ids
      ON "public".waste_tours FOR EACH ROW EXECUTE FUNCTION "public".sync_waste_tour_fractions();
    CREATE OR REPLACE FUNCTION "public".replace_waste_tour_fractions(p_tour_id uuid, p_fraction_ids text[])
    RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $writer$
    BEGIN
      IF p_fraction_ids IS NULL THEN RAISE EXCEPTION 'waste_tour_fractions_required'; END IF;
      UPDATE "public".waste_tours SET waste_fraction_ids = p_fraction_ids WHERE id = p_tour_id;
      IF NOT FOUND THEN RAISE foreign_key_violation USING MESSAGE = 'waste_tour_missing'; END IF;
    END; $writer$;
    REVOKE ALL ON FUNCTION "public".replace_waste_tour_fractions(uuid, text[]) FROM PUBLIC;
  END IF;
END; $expand$;`,
      `CREATE OR REPLACE FUNCTION "public".upsert_waste_tour(
      p_id uuid, p_name text, p_description text, p_fraction_ids text[], p_recurrence text,
      p_custom_recurrence_id uuid, p_first_date date, p_end_date date, p_custom_dates jsonb, p_status text)
    RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $upsert$
    BEGIN
      INSERT INTO "public".waste_tours(id, name, description, recurrence, custom_recurrence_id,
        first_date, end_date, custom_dates, status, active)
      VALUES (p_id, p_name, p_description, p_recurrence, p_custom_recurrence_id,
        p_first_date, p_end_date, p_custom_dates, p_status, p_status = 'published')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
        recurrence = EXCLUDED.recurrence, custom_recurrence_id = EXCLUDED.custom_recurrence_id,
        first_date = EXCLUDED.first_date, end_date = EXCLUDED.end_date, custom_dates = EXCLUDED.custom_dates,
        status = EXCLUDED.status, active = EXCLUDED.active, updated_at = now();
      PERFORM "public".replace_waste_tour_fractions(p_id, p_fraction_ids);
    END; $upsert$;
    REVOKE ALL ON FUNCTION "public".upsert_waste_tour(uuid,text,text,text[],text,uuid,date,date,jsonb,text) FROM PUBLIC;`,
      `DROP TRIGGER IF EXISTS sva_mainserver_revision_tours_update ON public.waste_tours;`,
      `CREATE TRIGGER sva_mainserver_revision_tours_update AFTER UPDATE OF recurrence, custom_recurrence_id, first_date, end_date, custom_dates, status, active ON public.waste_tours FOR EACH STATEMENT EXECUTE FUNCTION public.sva_bump_waste_mainserver_source_revision();`,
      `DROP TRIGGER IF EXISTS sva_mainserver_revision_tour_fractions_change ON public.waste_tour_fractions;`,
      `CREATE TRIGGER sva_mainserver_revision_tour_fractions_change AFTER INSERT OR DELETE ON public.waste_tour_fractions FOR EACH STATEMENT EXECUTE FUNCTION public.sva_bump_waste_mainserver_source_revision();`,
      `DROP TRIGGER IF EXISTS sva_mainserver_revision_tour_fractions_update ON public.waste_tour_fractions;`,
      `CREATE TRIGGER sva_mainserver_revision_tour_fractions_update AFTER UPDATE OF tour_id, fraction_id, position ON public.waste_tour_fractions FOR EACH STATEMENT EXECUTE FUNCTION public.sva_bump_waste_mainserver_source_revision();`
    ]),
    verification: Object.freeze({ sql: `
SELECT
  (SELECT count(*) = 2 FROM pg_constraint
    WHERE conrelid = '"public".waste_tour_fractions'::regclass
      AND contype = 'f' AND convalidated
      AND ((confrelid = '"public".waste_tours'::regclass AND confdeltype = 'c'
        AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (tour_id)%')
        OR (confrelid = '"public".waste_fractions'::regclass AND confdeltype = 'r'
        AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (fraction_id)%')))
  AND (SELECT count(*) = 2 FROM pg_constraint
    WHERE conrelid = '"public".waste_tour_fractions'::regclass AND convalidated
      AND ((contype = 'p' AND pg_get_constraintdef(oid) = 'PRIMARY KEY (tour_id, fraction_id)')
        OR (contype = 'u' AND pg_get_constraintdef(oid) = 'UNIQUE (tour_id, "position")')))
  AND EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = '"public".waste_tour_fractions'::regclass AND contype = 'c'
      AND convalidated AND pg_get_constraintdef(oid) = 'CHECK (("position" >= 0))')
  AND (SELECT count(*) = 3 AND bool_and(is_nullable = 'NO')
    FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'waste_tour_fractions'
      AND ((column_name IN ('tour_id', 'fraction_id') AND data_type = 'uuid')
        OR (column_name = 'position' AND data_type = 'integer')))
  AND to_regprocedure('"public".replace_waste_tour_fractions(uuid,text[])') IS NOT NULL
  AND to_regprocedure('"public".upsert_waste_tour(uuid,text,text,text[],text,uuid,date,date,jsonb,text)') IS NOT NULL
  AND (NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'waste_tours'
        AND column_name = 'waste_fraction_ids')
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '"public".waste_tours'::regclass
      AND tgname = 'waste_tours_sync_fractions' AND tgenabled = 'O' AND NOT tgisinternal))
  AND (SELECT count(*) = 2 FROM pg_trigger
    WHERE tgrelid = '"public".waste_tour_fractions'::regclass AND tgenabled = 'O'
      AND NOT tgisinternal AND tgname IN (
        'sva_mainserver_revision_tour_fractions_change', 'sva_mainserver_revision_tour_fractions_update'))
  AS satisfied;`, values: Object.freeze([]) }),
  }),
]);

// Explicitly selected by the existing runner only after all legacy writers have retired.
export const wasteTenantContractMigrations = Object.freeze([
  Object.freeze({
    id: '20261030_02_contract_waste_tour_fractions',
    statements: Object.freeze([
      `LOCK TABLE "public".waste_tours, "public".waste_fractions, "public".waste_tour_fractions IN SHARE ROW EXCLUSIVE MODE;`,
      `DO $contract$ BEGIN IF EXISTS (
    SELECT 1 FROM "public".waste_tours t
    WHERE ARRAY(SELECT value::uuid FROM unnest(t.waste_fraction_ids) WITH ORDINALITY AS f(value, n) ORDER BY n)
      IS DISTINCT FROM ARRAY(SELECT fraction_id FROM "public".waste_tour_fractions tf
        WHERE tf.tour_id = t.id ORDER BY position)
  ) THEN RAISE EXCEPTION 'waste_migration_tour_fractions_mismatch'; END IF; END; $contract$;`,
      `CREATE OR REPLACE FUNCTION "public".replace_waste_tour_fractions(p_tour_id uuid, p_fraction_ids text[])
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $writer$
    BEGIN
      IF p_fraction_ids IS NULL THEN RAISE EXCEPTION 'waste_tour_fractions_required'; END IF;
      PERFORM 1 FROM "public".waste_tours WHERE id = p_tour_id FOR UPDATE;
      IF NOT FOUND THEN RAISE foreign_key_violation USING MESSAGE = 'waste_tour_missing'; END IF;
      DELETE FROM "public".waste_tour_fractions WHERE tour_id = p_tour_id;
      INSERT INTO "public".waste_tour_fractions(tour_id, fraction_id, position)
        SELECT p_tour_id, value::uuid, (n - 1)::integer
        FROM unnest(p_fraction_ids) WITH ORDINALITY AS f(value, n);
    END; $writer$;`,
      `DROP TRIGGER waste_tours_sync_fractions ON "public".waste_tours;`,
      `DROP FUNCTION "public".sync_waste_tour_fractions();`,
      `DROP INDEX IF EXISTS "public".idx_waste_tours_waste_fraction_ids;`,
      `ALTER TABLE "public".waste_tours DROP COLUMN waste_fraction_ids;`
    ]),
    verification: Object.freeze({ sql: `
SELECT
  (SELECT count(*) = 2 FROM pg_constraint
    WHERE conrelid = '"public".waste_tour_fractions'::regclass
      AND contype = 'f' AND convalidated
      AND ((confrelid = '"public".waste_tours'::regclass AND confdeltype = 'c'
        AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (tour_id)%')
        OR (confrelid = '"public".waste_fractions'::regclass AND confdeltype = 'r'
        AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (fraction_id)%')))
  AND (SELECT count(*) = 2 FROM pg_constraint
    WHERE conrelid = '"public".waste_tour_fractions'::regclass AND convalidated
      AND ((contype = 'p' AND pg_get_constraintdef(oid) = 'PRIMARY KEY (tour_id, fraction_id)')
        OR (contype = 'u' AND pg_get_constraintdef(oid) = 'UNIQUE (tour_id, "position")')))
  AND EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = '"public".waste_tour_fractions'::regclass AND contype = 'c'
      AND convalidated AND pg_get_constraintdef(oid) = 'CHECK (("position" >= 0))')
  AND (SELECT count(*) = 3 AND bool_and(is_nullable = 'NO')
    FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'waste_tour_fractions'
      AND ((column_name IN ('tour_id', 'fraction_id') AND data_type = 'uuid')
        OR (column_name = 'position' AND data_type = 'integer')))
  AND to_regprocedure('"public".replace_waste_tour_fractions(uuid,text[])') IS NOT NULL
  AND to_regprocedure('"public".upsert_waste_tour(uuid,text,text,text[],text,uuid,date,date,jsonb,text)') IS NOT NULL
  AND (NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'waste_tours'
        AND column_name = 'waste_fraction_ids')
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '"public".waste_tours'::regclass
      AND tgname = 'waste_tours_sync_fractions' AND tgenabled = 'O' AND NOT tgisinternal))
  AND (SELECT count(*) = 2 FROM pg_trigger
    WHERE tgrelid = '"public".waste_tour_fractions'::regclass AND tgenabled = 'O'
      AND NOT tgisinternal AND tgname IN (
        'sva_mainserver_revision_tour_fractions_change', 'sva_mainserver_revision_tour_fractions_update'))
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'waste_tours' AND column_name = 'waste_fraction_ids')
  AS satisfied;`, values: Object.freeze([]) }),
  }),
]);
