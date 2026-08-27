import { quoteIdentifier } from './waste-management-operations.shared.js';

export const wasteMainserverSourceStateTable = 'waste_mainserver_source_state' as const;

type WasteMainserverRevisionTriggerSpec = Readonly<{
  tableName: string;
  updateColumns: readonly string[];
}>;

export const wasteMainserverRevisionTriggerSpecs = [
  { tableName: 'waste_cities', updateColumns: ['name', 'postal_code'] },
  { tableName: 'waste_streets', updateColumns: ['name'] },
  { tableName: 'waste_house_numbers', updateColumns: ['number', 'street_id'] },
  {
    tableName: 'waste_collection_locations',
    updateColumns: ['city_id', 'street_id', 'house_number_id', 'active'],
  },
  { tableName: 'waste_fractions', updateColumns: ['name'] },
  { tableName: 'waste_custom_recurrence_presets', updateColumns: ['interval_days'] },
  {
    tableName: 'waste_tours',
    updateColumns: [
      'waste_fraction_ids',
      'recurrence',
      'custom_recurrence_id',
      'first_date',
      'end_date',
      'custom_dates',
      'active',
    ],
  },
  { tableName: 'waste_location_tour_links', updateColumns: ['location_id', 'tour_id'] },
  {
    tableName: 'waste_location_tour_pickup_dates',
    updateColumns: ['location_id', 'tour_id', 'pickup_date', 'note'],
  },
  { tableName: 'waste_tour_assignments', updateColumns: ['tour_id', 'pickup_date', 'note'] },
  {
    tableName: 'waste_tour_assignment_locations',
    updateColumns: ['assignment_id', 'collection_location_id'],
  },
  {
    tableName: 'waste_tour_date_shifts',
    updateColumns: ['tour_id', 'original_date', 'actual_date', 'has_year', 'follow_up_mode'],
  },
  {
    tableName: 'waste_global_date_shifts',
    updateColumns: ['original_date', 'actual_date', 'has_year', 'tour_ids'],
  },
  {
    tableName: 'waste_holiday_rules',
    updateColumns: ['holiday_date', 'scope', 'strategy'],
  },
] as const satisfies readonly WasteMainserverRevisionTriggerSpec[];

const buildTriggerName = (tableName: string, operation: 'change' | 'update'): string =>
  `sva_mainserver_revision_${tableName.replace(/^waste_/u, '')}_${operation}`;

export const buildWasteMainserverRevisionSchemaStatements = (
  schemaName: string
): readonly string[] => {
  const schema = quoteIdentifier(schemaName);
  const stateTable = `${schema}.${wasteMainserverSourceStateTable}`;
  const functionName = `${schema}.sva_bump_waste_mainserver_source_revision`;
  const statements: string[] = [
    `CREATE TABLE IF NOT EXISTS ${stateTable} (id BOOLEAN PRIMARY KEY DEFAULT TRUE, source_revision BIGINT NOT NULL DEFAULT 0, changed_at TIMESTAMPTZ, CONSTRAINT waste_mainserver_source_state_singleton_check CHECK (id = TRUE), CONSTRAINT waste_mainserver_source_state_revision_check CHECK (source_revision >= 0));`,
    `INSERT INTO ${stateTable} (id, source_revision, changed_at) VALUES (TRUE, 0, NULL) ON CONFLICT (id) DO NOTHING;`,
    `CREATE OR REPLACE FUNCTION ${functionName}() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$ BEGIN UPDATE ${stateTable} SET source_revision = source_revision + 1, changed_at = statement_timestamp() WHERE id = TRUE; RETURN NULL; END; $$;`,
    `REVOKE ALL ON FUNCTION ${functionName}() FROM PUBLIC;`,
  ];

  for (const spec of wasteMainserverRevisionTriggerSpecs) {
    const table = `${schema}.${quoteIdentifier(spec.tableName)}`;
    const changeTrigger = quoteIdentifier(buildTriggerName(spec.tableName, 'change'));
    const updateTrigger = quoteIdentifier(buildTriggerName(spec.tableName, 'update'));
    const updateColumns = spec.updateColumns.map(quoteIdentifier).join(', ');
    statements.push(
      `DROP TRIGGER IF EXISTS ${changeTrigger} ON ${table};`,
      `CREATE TRIGGER ${changeTrigger} AFTER INSERT OR DELETE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION ${functionName}();`,
      `DROP TRIGGER IF EXISTS ${updateTrigger} ON ${table};`,
      `CREATE TRIGGER ${updateTrigger} AFTER UPDATE OF ${updateColumns} ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION ${functionName}();`
    );
  }

  return statements;
};
