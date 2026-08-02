WITH waste_tables AS (
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema = current_schema()
    AND table_type = 'BASE TABLE'
    AND table_name LIKE 'waste\_%' ESCAPE '\'
  ORDER BY table_name
), counts AS (
  SELECT jsonb_object_agg(table_name, row_count ORDER BY table_name) AS value
  FROM (
    SELECT table_name, (xpath('/row/count/text()', query_to_xml(
      format('SELECT count(*) AS count FROM %I.%I', table_schema, table_name),
      false, true, ''
    )))[1]::text::bigint AS row_count
    FROM waste_tables
  ) rows_by_table
), objects AS (
  SELECT jsonb_build_object(
    'tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name LIKE 'waste\_%' ESCAPE '\'),
    'sequences', (SELECT count(*) FROM information_schema.sequences WHERE sequence_schema = current_schema()),
    'constraints', (SELECT count(*) FROM information_schema.table_constraints WHERE table_schema = current_schema() AND table_name LIKE 'waste\_%' ESCAPE '\'),
    'indexes', (SELECT count(*) FROM pg_indexes WHERE schemaname = current_schema() AND tablename LIKE 'waste\_%' ESCAPE '\'),
    'functions', (SELECT count(*) FROM information_schema.routines WHERE routine_schema = current_schema())
  ) AS value
)
SELECT jsonb_build_object(
  'schema', current_schema(),
  'objects', objects.value,
  'rowCounts', COALESCE(counts.value, '{}'::jsonb)
)::text
FROM objects, counts;
