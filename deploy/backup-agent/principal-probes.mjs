import { sqlLiteral, assertRuntimePrincipalTarget } from './principal-reconciliation.mjs';

export const runtimePrincipalProbeSql = (target) => {
  assertRuntimePrincipalTarget(target);
  if (target.database === 'waste') return wasteRuntimePrincipalProbeSql(target);
  if (target.database === 'ssf') return ssfRuntimePrincipalProbeSql(target);
  const database = sqlLiteral(target.postgresDatabase);
  const runtimeRole = sqlLiteral(target.runtimeRole);
  const runtimeUser = sqlLiteral(target.runtimeUser);
  return `
SELECT json_build_object(
  'databaseConnect', has_database_privilege(${runtimeUser}, ${database}, 'CONNECT'),
  'roleMembership', pg_has_role(${runtimeUser}, ${runtimeRole}, 'MEMBER'),
  'runtimeUserSchemaUsage', has_schema_privilege(${runtimeUser}, 'iam', 'USAGE'),
  'runtimeRoleSchemaUsage', has_schema_privilege(${runtimeRole}, 'iam', 'USAGE'),
  'runtimeUserTablesReady', COALESCE(
    (
      SELECT bool_and(
        has_table_privilege(${runtimeUser}, relation.oid, 'SELECT')
        AND has_table_privilege(${runtimeUser}, relation.oid, 'INSERT')
        AND has_table_privilege(${runtimeUser}, relation.oid, 'UPDATE')
        AND has_table_privilege(${runtimeUser}, relation.oid, 'DELETE')
      )
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'iam' AND relation.relkind IN ('r', 'p')
    ),
    false
  ),
  'runtimeRoleTablesReady', COALESCE(
    (
      SELECT bool_and(
        has_table_privilege(${runtimeRole}, relation.oid, 'SELECT')
        AND has_table_privilege(${runtimeRole}, relation.oid, 'INSERT')
        AND has_table_privilege(${runtimeRole}, relation.oid, 'UPDATE')
        AND has_table_privilege(${runtimeRole}, relation.oid, 'DELETE')
      )
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'iam' AND relation.relkind IN ('r', 'p')
    ),
    false
  ),
  'runtimeUserSequencesReady', COALESCE(
    (
      SELECT bool_and(
        has_sequence_privilege(${runtimeUser}, sequence.oid, 'USAGE')
        AND has_sequence_privilege(${runtimeUser}, sequence.oid, 'SELECT')
      )
      FROM pg_class sequence
      JOIN pg_namespace namespace ON namespace.oid = sequence.relnamespace
      WHERE namespace.nspname = 'iam' AND sequence.relkind = 'S'
    ),
    true
  ),
  'runtimeRoleSequencesReady', COALESCE(
    (
      SELECT bool_and(
        has_sequence_privilege(${runtimeRole}, sequence.oid, 'USAGE')
        AND has_sequence_privilege(${runtimeRole}, sequence.oid, 'SELECT')
      )
      FROM pg_class sequence
      JOIN pg_namespace namespace ON namespace.oid = sequence.relnamespace
      WHERE namespace.nspname = 'iam' AND sequence.relkind = 'S'
    ),
    true
  )
)::text;
`;
};

export const ssfRuntimePrincipalProbeSql = (target) => {
  assertRuntimePrincipalTarget(target);
  if (target.database !== 'ssf') throw new Error('runtime_principal_target_invalid');
  const database = sqlLiteral(target.postgresDatabase);
  const runtimeRole = sqlLiteral(target.runtimeRole);
  const runtimeUser = sqlLiteral(target.runtimeUser);
  return `
SELECT json_build_object(
  'databaseConnect', has_database_privilege(${runtimeUser}, ${database}, 'CONNECT'),
  'roleMembership', pg_has_role(${runtimeUser}, ${runtimeRole}, 'MEMBER'),
  'runtimeUserSchemaUsage', has_schema_privilege(${runtimeUser}, 'ssf', 'USAGE'),
  'runtimeRoleSchemaUsage', has_schema_privilege(${runtimeRole}, 'ssf', 'USAGE'),
  'runtimeUserTablesReady', has_table_privilege(${runtimeUser}, 'ssf.tenant_settings', 'SELECT'),
  'runtimeRoleTablesReady', has_table_privilege(${runtimeRole}, 'ssf.tenant_settings', 'SELECT'),
  'runtimeUserSequencesReady', true,
  'runtimeRoleSequencesReady', true
)::text;
`;
};

export const wasteRuntimePrincipalProbeSql = (target) => {
  assertRuntimePrincipalTarget(target);
  if (target.database !== 'waste') throw new Error('runtime_principal_target_invalid');
  const database = sqlLiteral(target.postgresDatabase);
  const app = sqlLiteral(target.runtimeUser);
  const publicApp = sqlLiteral(target.publicRuntimeUser);
  return `
SELECT json_build_object(
  'databaseConnect', has_database_privilege(${app}, ${database}, 'CONNECT'),
  'runtimeUserSchemaUsage', has_schema_privilege(${app}, 'public', 'USAGE'),
  'runtimeUserTablesReady', COALESCE((
    SELECT bool_and(
      has_table_privilege(${app}, relation.oid, 'SELECT')
      AND has_table_privilege(${app}, relation.oid, 'INSERT')
      AND has_table_privilege(${app}, relation.oid, 'UPDATE')
      AND has_table_privilege(${app}, relation.oid, 'DELETE')
    ) FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public' AND relation.relkind IN ('r', 'p') AND relation.relname LIKE 'waste\\_%' ESCAPE '\\'
  ), false),
  'publicRuntimeSchemaUsage', has_schema_privilege(${publicApp}, 'public', 'USAGE'),
  'publicRuntimeTablesReadable', COALESCE((
    SELECT bool_and(has_table_privilege(${publicApp}, relation.oid, 'SELECT'))
    FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public' AND relation.relkind IN ('r', 'p') AND relation.relname LIKE 'waste\\_%' ESCAPE '\\'
  ), false),
  'publicRuntimeReminderWrites', (
    SELECT bool_and(
      has_table_privilege(${publicApp}, relation.oid, 'INSERT')
      AND has_table_privilege(${publicApp}, relation.oid, 'UPDATE')
      AND has_table_privilege(${publicApp}, relation.oid, 'DELETE')
    )
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public' AND relation.relname = ANY (ARRAY[
      'waste_email_reminder_subscriptions',
      'waste_email_reminder_subscription_items',
      'waste_email_reminder_outbox'
    ])
  )
)::text;
`;
};

export const validateRuntimePrincipalProbe = (probe) => {
  const requiredChecks =
    probe && 'publicRuntimeSchemaUsage' in probe
      ? [
          'databaseConnect',
          'runtimeUserSchemaUsage',
          'runtimeUserTablesReady',
          'publicRuntimeSchemaUsage',
          'publicRuntimeTablesReadable',
          'publicRuntimeReminderWrites',
        ]
      : [
          'databaseConnect',
          'roleMembership',
          'runtimeUserSchemaUsage',
          'runtimeRoleSchemaUsage',
          'runtimeUserTablesReady',
          'runtimeRoleTablesReady',
          'runtimeUserSequencesReady',
          'runtimeRoleSequencesReady',
        ];
  if (!probe || typeof probe !== 'object' || requiredChecks.some((check) => probe[check] !== true))
    throw new Error('runtime_principal_probe_failed');
  return Object.fromEntries(requiredChecks.map((check) => [check, true]));
};
