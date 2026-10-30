// Expand/contract SQL is also embedded in the versioned deployment catalogue.
// The PostgreSQL integration test checks that both paths stay identical.
const quoteSchema = (name: string): string => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) throw new Error('invalid_waste_schema');
  return `"${name}"`;
};

export const buildWasteTourFractionsVerification = (schemaName: string): string => {
  const schema = quoteSchema(schemaName);
  return `
SELECT
  (SELECT count(*) = 2 FROM pg_constraint
    WHERE conrelid = '${schema}.waste_tour_fractions'::regclass
      AND contype = 'f' AND convalidated
      AND ((confrelid = '${schema}.waste_tours'::regclass AND confdeltype = 'c'
        AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (tour_id)%')
        OR (confrelid = '${schema}.waste_fractions'::regclass AND confdeltype = 'r'
        AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (fraction_id)%')))
  AND (SELECT count(*) = 2 FROM pg_constraint
    WHERE conrelid = '${schema}.waste_tour_fractions'::regclass AND convalidated
      AND ((contype = 'p' AND pg_get_constraintdef(oid) = 'PRIMARY KEY (tour_id, fraction_id)')
        OR (contype = 'u' AND pg_get_constraintdef(oid) = 'UNIQUE (tour_id, "position")')))
  AND EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = '${schema}.waste_tour_fractions'::regclass AND contype = 'c'
      AND convalidated AND pg_get_constraintdef(oid) = 'CHECK (("position" >= 0))')
  AND (SELECT count(*) = 3 AND bool_and(is_nullable = 'NO')
    FROM information_schema.columns WHERE table_schema = '${schemaName}'
      AND table_name = 'waste_tour_fractions'
      AND ((column_name IN ('tour_id', 'fraction_id') AND data_type = 'uuid')
        OR (column_name = 'position' AND data_type = 'integer')))
  AND to_regprocedure('${schema}.replace_waste_tour_fractions(uuid,text[])') IS NOT NULL
  AND to_regprocedure('${schema}.upsert_waste_tour(uuid,text,text,text[],text,uuid,date,date,jsonb,text)') IS NOT NULL
  AND (NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = '${schemaName}' AND table_name = 'waste_tours'
        AND column_name = 'waste_fraction_ids')
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '${schema}.waste_tours'::regclass
      AND tgname = 'waste_tours_sync_fractions' AND tgenabled = 'O' AND NOT tgisinternal))
  AND (SELECT count(*) = 2 FROM pg_trigger
    WHERE tgrelid = '${schema}.waste_tour_fractions'::regclass AND tgenabled = 'O'
      AND NOT tgisinternal AND tgname IN (
        'sva_mainserver_revision_tour_fractions_change', 'sva_mainserver_revision_tour_fractions_update'))
  AS satisfied;`;
};

const buildArrayEqualityCheck = (schema: string): string =>
  `
  IF EXISTS (
    SELECT 1 FROM ${schema}.waste_tours t
    WHERE ARRAY(SELECT value::uuid FROM unnest(t.waste_fraction_ids) WITH ORDINALITY AS f(value, n) ORDER BY n)
      IS DISTINCT FROM ARRAY(SELECT fraction_id FROM ${schema}.waste_tour_fractions tf
        WHERE tf.tour_id = t.id ORDER BY position)
  ) THEN RAISE EXCEPTION 'waste_migration_tour_fractions_mismatch'; END IF;`.trim();

export const buildWasteTourFractionsExpandStatements = (schemaName: string): readonly string[] => {
  const schema = quoteSchema(schemaName);
  return [
    `CREATE TABLE IF NOT EXISTS ${schema}.waste_tour_fractions (
      tour_id UUID NOT NULL REFERENCES ${schema}.waste_tours(id) ON DELETE CASCADE,
      fraction_id UUID NOT NULL REFERENCES ${schema}.waste_fractions(id) ON DELETE RESTRICT,
      position INTEGER NOT NULL CHECK (position >= 0),
      PRIMARY KEY (tour_id, fraction_id), UNIQUE (tour_id, position));`,
    `CREATE INDEX IF NOT EXISTS idx_waste_tour_fractions_fraction ON ${schema}.waste_tour_fractions(fraction_id);`,
    `DO $expand$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '${schemaName}'
      AND table_name = 'waste_tours' AND column_name = 'waste_fraction_ids') THEN
    LOCK TABLE ${schema}.waste_tours, ${schema}.waste_fractions IN SHARE ROW EXCLUSIVE MODE;
    IF EXISTS (SELECT 1 FROM ${schema}.waste_tours t, unnest(t.waste_fraction_ids) AS f(value)
      WHERE value IS NULL OR btrim(value) = '') THEN
      RAISE EXCEPTION 'waste_migration_tour_fractions_invalid_id';
    END IF;
    IF EXISTS (SELECT 1 FROM ${schema}.waste_tours t, unnest(t.waste_fraction_ids) AS f(value)
      GROUP BY t.id, value::uuid HAVING count(*) > 1) THEN
      RAISE EXCEPTION 'waste_migration_tour_fractions_duplicate';
    END IF;
    INSERT INTO ${schema}.waste_tour_fractions(tour_id, fraction_id, position)
      SELECT t.id, value::uuid, (n - 1)::integer FROM ${schema}.waste_tours t,
        unnest(t.waste_fraction_ids) WITH ORDINALITY AS f(value, n)
      ON CONFLICT (tour_id, fraction_id) DO NOTHING;
    ${buildArrayEqualityCheck(schema)}
    CREATE OR REPLACE FUNCTION ${schema}.sync_waste_tour_fractions()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $bridge$
    BEGIN
      DELETE FROM ${schema}.waste_tour_fractions WHERE tour_id = NEW.id;
      INSERT INTO ${schema}.waste_tour_fractions(tour_id, fraction_id, position)
        SELECT NEW.id, value::uuid, (n - 1)::integer
        FROM unnest(NEW.waste_fraction_ids) WITH ORDINALITY AS f(value, n);
      RETURN NEW;
    END; $bridge$;
    REVOKE ALL ON FUNCTION ${schema}.sync_waste_tour_fractions() FROM PUBLIC;
    DROP TRIGGER IF EXISTS waste_tours_sync_fractions ON ${schema}.waste_tours;
    CREATE TRIGGER waste_tours_sync_fractions AFTER INSERT OR UPDATE OF waste_fraction_ids
      ON ${schema}.waste_tours FOR EACH ROW EXECUTE FUNCTION ${schema}.sync_waste_tour_fractions();
    CREATE OR REPLACE FUNCTION ${schema}.replace_waste_tour_fractions(p_tour_id uuid, p_fraction_ids text[])
    RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $writer$
    BEGIN
      IF p_fraction_ids IS NULL THEN RAISE EXCEPTION 'waste_tour_fractions_required'; END IF;
      UPDATE ${schema}.waste_tours SET waste_fraction_ids = p_fraction_ids WHERE id = p_tour_id;
      IF NOT FOUND THEN RAISE foreign_key_violation USING MESSAGE = 'waste_tour_missing'; END IF;
    END; $writer$;
    REVOKE ALL ON FUNCTION ${schema}.replace_waste_tour_fractions(uuid, text[]) FROM PUBLIC;
  END IF;
END; $expand$;`,
    `CREATE OR REPLACE FUNCTION ${schema}.upsert_waste_tour(
      p_id uuid, p_name text, p_description text, p_fraction_ids text[], p_recurrence text,
      p_custom_recurrence_id uuid, p_first_date date, p_end_date date, p_custom_dates jsonb, p_status text)
    RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $upsert$
    BEGIN
      INSERT INTO ${schema}.waste_tours(id, name, description, recurrence, custom_recurrence_id,
        first_date, end_date, custom_dates, status, active)
      VALUES (p_id, p_name, p_description, p_recurrence, p_custom_recurrence_id,
        p_first_date, p_end_date, p_custom_dates, p_status, p_status = 'published')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
        recurrence = EXCLUDED.recurrence, custom_recurrence_id = EXCLUDED.custom_recurrence_id,
        first_date = EXCLUDED.first_date, end_date = EXCLUDED.end_date, custom_dates = EXCLUDED.custom_dates,
        status = EXCLUDED.status, active = EXCLUDED.active, updated_at = now();
      PERFORM ${schema}.replace_waste_tour_fractions(p_id, p_fraction_ids);
    END; $upsert$;
    REVOKE ALL ON FUNCTION ${schema}.upsert_waste_tour(uuid,text,text,text[],text,uuid,date,date,jsonb,text) FROM PUBLIC;`,
  ];
};

export const buildWasteTourFractionsContractStatements = (
  schemaName: string
): readonly string[] => {
  const schema = quoteSchema(schemaName);
  return [
    `LOCK TABLE ${schema}.waste_tours, ${schema}.waste_fractions, ${schema}.waste_tour_fractions IN SHARE ROW EXCLUSIVE MODE;`,
    `DO $contract$ BEGIN ${buildArrayEqualityCheck(schema)} END; $contract$;`,
    `CREATE OR REPLACE FUNCTION ${schema}.replace_waste_tour_fractions(p_tour_id uuid, p_fraction_ids text[])
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $writer$
    BEGIN
      IF p_fraction_ids IS NULL THEN RAISE EXCEPTION 'waste_tour_fractions_required'; END IF;
      PERFORM 1 FROM ${schema}.waste_tours WHERE id = p_tour_id FOR UPDATE;
      IF NOT FOUND THEN RAISE foreign_key_violation USING MESSAGE = 'waste_tour_missing'; END IF;
      DELETE FROM ${schema}.waste_tour_fractions WHERE tour_id = p_tour_id;
      INSERT INTO ${schema}.waste_tour_fractions(tour_id, fraction_id, position)
        SELECT p_tour_id, value::uuid, (n - 1)::integer
        FROM unnest(p_fraction_ids) WITH ORDINALITY AS f(value, n);
    END; $writer$;`,
    `DROP TRIGGER waste_tours_sync_fractions ON ${schema}.waste_tours;`,
    `DROP FUNCTION ${schema}.sync_waste_tour_fractions();`,
    `DROP INDEX IF EXISTS ${schema}.idx_waste_tours_waste_fraction_ids;`,
    `ALTER TABLE ${schema}.waste_tours DROP COLUMN waste_fraction_ids;`,
  ];
};
