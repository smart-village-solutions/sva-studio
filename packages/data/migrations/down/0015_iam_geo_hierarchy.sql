DROP TRIGGER IF EXISTS geo_hierarchy_depth_check ON iam.geo_hierarchy;
DROP FUNCTION IF EXISTS iam.check_geo_hierarchy_depth();

DROP POLICY IF EXISTS geo_nodes_isolation_policy ON iam.geo_nodes;

DROP INDEX IF EXISTS iam.idx_geo_hierarchy_ancestor;
DROP INDEX IF EXISTS iam.idx_geo_hierarchy_descendant;
DROP INDEX IF EXISTS iam.idx_geo_nodes_instance;

DROP TABLE IF EXISTS iam.geo_hierarchy;
DROP TABLE IF EXISTS iam.geo_nodes;
