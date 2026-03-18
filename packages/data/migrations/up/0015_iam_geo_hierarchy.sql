-- Migration 0015: Geo-Hierarchie Closure-Table (Paket 3)
-- Kanonisches Hierarchie-Read-Modell für geografische Einheiten.
-- Key-Format: {ebene}:{schlüssel} (z. B. district:09162, municipality:09162000).
-- Maximale Tiefe: 5 Ebenen.

CREATE TABLE IF NOT EXISTS iam.geo_nodes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID        NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  key         TEXT        NOT NULL,
  display_name TEXT       NOT NULL,
  node_type   TEXT        NOT NULL DEFAULT 'district',
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT geo_nodes_instance_key_uniq UNIQUE (instance_id, key)
);

CREATE INDEX IF NOT EXISTS idx_geo_nodes_instance
  ON iam.geo_nodes(instance_id)
  WHERE deleted_at IS NULL;

-- Closure-Table für effiziente Vorfahren-/Nachfahren-Abfragen in O(1)
-- depth = 0: self-referenzierender Eintrag (ancestor_id = descendant_id)
CREATE TABLE IF NOT EXISTS iam.geo_hierarchy (
  ancestor_id   UUID    NOT NULL REFERENCES iam.geo_nodes(id) ON DELETE CASCADE,
  descendant_id UUID    NOT NULL REFERENCES iam.geo_nodes(id) ON DELETE CASCADE,
  depth         INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id),
  CONSTRAINT geo_hierarchy_depth_range_chk CHECK (depth >= 0 AND depth <= 5)
);

CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_descendant
  ON iam.geo_hierarchy(descendant_id, depth);

CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_ancestor
  ON iam.geo_hierarchy(ancestor_id, depth);

-- Trigger-Funktion: verhindert Einfügungen, die Tiefe > 5 erzeugen würden.
-- Applikation prüft zusätzlich und wirft HTTP 422.
CREATE OR REPLACE FUNCTION iam.check_geo_hierarchy_depth()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  max_existing_depth INTEGER;
BEGIN
  IF NEW.depth > 5 THEN
    RAISE EXCEPTION 'geo_hierarchy_depth_exceeded'
      USING DETAIL = 'Maximum geo hierarchy depth is 5',
            ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(MAX(h.depth), 0)
    INTO max_existing_depth
    FROM iam.geo_hierarchy h
   WHERE h.ancestor_id = NEW.ancestor_id
      OR h.descendant_id = NEW.descendant_id;

  IF max_existing_depth >= 5 THEN
    RAISE EXCEPTION 'geo_hierarchy_depth_exceeded'
      USING DETAIL = 'Maximum geo hierarchy depth is 5',
            ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS geo_hierarchy_depth_check ON iam.geo_hierarchy;
CREATE TRIGGER geo_hierarchy_depth_check
  BEFORE INSERT ON iam.geo_hierarchy
  FOR EACH ROW EXECUTE FUNCTION iam.check_geo_hierarchy_depth();

-- RLS: Instanzisolation über geo_nodes (geo_hierarchy über FKs abgesichert)
ALTER TABLE iam.geo_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.geo_nodes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_nodes_isolation_policy ON iam.geo_nodes;
CREATE POLICY geo_nodes_isolation_policy
  ON iam.geo_nodes
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
