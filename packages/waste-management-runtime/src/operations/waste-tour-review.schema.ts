const wasteTourReviewRelations = [
  'waste_tour_fractions',
  'waste_location_tour_links',
  'waste_location_tour_pickup_dates',
  'waste_tour_assignments',
  'waste_tour_assignment_locations',
  'waste_tour_date_shifts',
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
];
