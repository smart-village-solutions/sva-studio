-- +goose Up
-- +goose StatementBegin
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'iam'
  LOOP
    EXECUTE format('ALTER TABLE iam.%I NO FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE iam.%I DISABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END
$$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'iam'
  LOOP
    EXECUTE format('ALTER TABLE iam.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE iam.%I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END
$$;
-- +goose StatementEnd
