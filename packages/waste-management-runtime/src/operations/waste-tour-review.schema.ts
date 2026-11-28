const wasteTourReviewRelations = [
  'waste_tour_fractions',
  'waste_location_tour_links',
  'waste_location_tour_pickup_dates',
  'waste_tour_assignments',
  'waste_tour_assignment_locations',
  'waste_tour_date_shifts',
];

const buildSharedTourReviewStatements = (schema: string) => [
  `CREATE OR REPLACE FUNCTION ${schema}.reset_global_shift_tour_review() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog AS $review$
    DECLARE
      old_ids text[] := CASE WHEN TG_OP <> 'INSERT'
        THEN NULLIF(array_remove(OLD.tour_ids, NULL), '{}'::text[]) END;
      new_ids text[] := CASE WHEN TG_OP <> 'DELETE'
        THEN NULLIF(array_remove(NEW.tour_ids, NULL), '{}'::text[]) END;
      applies_to_all boolean := (TG_OP <> 'INSERT' AND old_ids IS NULL)
        OR (TG_OP <> 'DELETE' AND new_ids IS NULL);
      affected_ids text[] := COALESCE(old_ids, '{}') || COALESCE(new_ids, '{}');
    BEGIN
      IF TG_OP = 'UPDATE' AND old_ids IS NOT DISTINCT FROM new_ids
        AND (to_jsonb(OLD) - ARRAY['updated_at', 'tour_ids']) = (to_jsonb(NEW) - ARRAY['updated_at', 'tour_ids']) THEN
        RETURN NULL;
      END IF;

      -- Missing and empty scopes both apply tenant-wide for an existing shift.
      PERFORM 1 FROM ${schema}.waste_tours
        WHERE applies_to_all OR id::text = ANY(affected_ids) ORDER BY id FOR NO KEY UPDATE;
      UPDATE ${schema}.waste_tours SET reviewed_on = NULL
        WHERE reviewed_on IS NOT NULL AND (applies_to_all OR id::text = ANY(affected_ids));
      RETURN NULL;
    END; $review$;`,
  `DROP TRIGGER IF EXISTS waste_tours_reset_review ON ${schema}.waste_global_date_shifts;`,
  `CREATE TRIGGER waste_tours_reset_review AFTER INSERT OR UPDATE OR DELETE ON ${schema}.waste_global_date_shifts
    FOR EACH ROW EXECUTE FUNCTION ${schema}.reset_global_shift_tour_review();`,
  `CREATE OR REPLACE FUNCTION ${schema}.reset_preset_tour_review() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog AS $review$
    BEGIN
      PERFORM 1 FROM ${schema}.waste_tours WHERE custom_recurrence_id = NEW.id
        ORDER BY id FOR NO KEY UPDATE;
      UPDATE ${schema}.waste_tours SET reviewed_on = NULL
        WHERE custom_recurrence_id = NEW.id AND reviewed_on IS NOT NULL;
      RETURN NULL;
    END; $review$;`,
  `DROP TRIGGER IF EXISTS waste_tours_reset_review ON ${schema}.waste_custom_recurrence_presets;`,
  `CREATE TRIGGER waste_tours_reset_review AFTER UPDATE OF interval_days ON ${schema}.waste_custom_recurrence_presets
    FOR EACH ROW WHEN (OLD.interval_days IS DISTINCT FROM NEW.interval_days)
    EXECUTE FUNCTION ${schema}.reset_preset_tour_review();`,
  `CREATE OR REPLACE FUNCTION ${schema}.reset_holiday_rule_tour_review() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog AS $review$
    DECLARE
      old_schedule text[] := CASE
        WHEN TG_OP = 'INSERT' THEN NULL
        WHEN OLD.scope IS NOT NULL AND OLD.strategy IS NOT NULL
          THEN ARRAY[OLD.holiday_date::text, OLD.scope, OLD.strategy]
      END;
      new_schedule text[] := CASE
        WHEN TG_OP = 'DELETE' THEN NULL
        WHEN NEW.scope IS NOT NULL AND NEW.strategy IS NOT NULL
          THEN ARRAY[NEW.holiday_date::text, NEW.scope, NEW.strategy]
      END;
    BEGIN
      IF old_schedule IS DISTINCT FROM new_schedule THEN
        -- Configured holiday rules apply across the tenant.
        PERFORM 1 FROM ${schema}.waste_tours ORDER BY id FOR NO KEY UPDATE;
        UPDATE ${schema}.waste_tours SET reviewed_on = NULL WHERE reviewed_on IS NOT NULL;
      END IF;
      RETURN NULL;
    END; $review$;`,
  `DROP TRIGGER IF EXISTS waste_tours_reset_review ON ${schema}.waste_holiday_rules;`,
  `CREATE TRIGGER waste_tours_reset_review AFTER INSERT OR UPDATE OR DELETE ON ${schema}.waste_holiday_rules
    FOR EACH ROW EXECUTE FUNCTION ${schema}.reset_holiday_rule_tour_review();`,
];

export const buildWasteTourReviewStatements = (schema: string) => [
  `ALTER TABLE ${schema}.waste_tours ADD COLUMN IF NOT EXISTS reviewed_on DATE;`,
  `CREATE OR REPLACE FUNCTION ${schema}.reset_waste_tour_review() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog AS $review$
    BEGIN
      NEW.reviewed_on := NULL;
      RETURN NEW;
    END; $review$;`,
  `DROP TRIGGER IF EXISTS waste_tours_reset_review ON ${schema}.waste_tours;`,
  `CREATE TRIGGER waste_tours_reset_review BEFORE UPDATE ON ${schema}.waste_tours
    FOR EACH ROW WHEN (
      OLD.reviewed_on IS NOT NULL AND
      ROW(OLD.name, OLD.description, OLD.recurrence, OLD.custom_recurrence_id, OLD.first_date, OLD.end_date, OLD.custom_dates)
      IS DISTINCT FROM
      ROW(NEW.name, NEW.description, NEW.recurrence, NEW.custom_recurrence_id, NEW.first_date, NEW.end_date, NEW.custom_dates)
    ) EXECUTE FUNCTION ${schema}.reset_waste_tour_review();`,
  `CREATE OR REPLACE FUNCTION ${schema}.reset_related_waste_tour_review() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog AS $review$
    DECLARE
      old_tour uuid;
      new_tour uuid;
    BEGIN
      IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'updated_at') = (to_jsonb(NEW) - 'updated_at') THEN
        RETURN NULL;
      END IF;

      IF TG_ARGV[0] = 'assignment' THEN
        IF TG_OP <> 'INSERT' THEN
          SELECT tour_id INTO old_tour FROM ${schema}.waste_tour_assignments WHERE id = OLD.assignment_id;
        END IF;
        IF TG_OP <> 'DELETE' THEN
          SELECT tour_id INTO new_tour FROM ${schema}.waste_tour_assignments WHERE id = NEW.assignment_id;
        END IF;
      ELSE
        IF TG_OP <> 'INSERT' THEN old_tour := OLD.tour_id; END IF;
        IF TG_OP <> 'DELETE' THEN new_tour := NEW.tour_id; END IF;
      END IF;

      -- Lock even an unchecked tour so a concurrent batch cannot mark it mid-edit.
      PERFORM 1 FROM ${schema}.waste_tours
        WHERE id IN (old_tour, new_tour) ORDER BY id FOR NO KEY UPDATE;
      UPDATE ${schema}.waste_tours SET reviewed_on = NULL
        WHERE id IN (old_tour, new_tour) AND reviewed_on IS NOT NULL;
      RETURN NULL;
    END; $review$;`,
  ...wasteTourReviewRelations.flatMap((table) => [
    `DROP TRIGGER IF EXISTS waste_tours_reset_review ON ${schema}.${table};`,
    `CREATE TRIGGER waste_tours_reset_review AFTER INSERT OR UPDATE OR DELETE ON ${schema}.${table}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.reset_related_waste_tour_review(${
        table === 'waste_tour_assignment_locations' ? "'assignment'" : ''
      });`,
  ]),
  ...buildSharedTourReviewStatements(schema),
];
