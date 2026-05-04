import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DeleteLocalInstanceCliOptions = {
  dryRun: boolean;
  force: boolean;
  targetDbContainer: string;
  targetDbName: string;
  targetDbUser: string;
  targetInstanceId: string;
  yes: boolean;
};

const KNOWN_INDIRECT_CASCADE_TABLES = [
  'account_groups',
  'account_organizations',
  'account_permissions',
  'account_roles',
  'group_roles',
  'role_permissions',
] as const;

const EXPLICIT_PREDELETE_TABLES = ['content_history', 'contents'] as const;

const KNOWN_NON_CASCADE_INSTANCE_TABLES = new Set<string>([
  ...KNOWN_INDIRECT_CASCADE_TABLES,
  ...EXPLICIT_PREDELETE_TABLES,
]);

const [, , ...rawArgs] = process.argv;

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const entrypointPath = fileURLToPath(import.meta.url);

const usage = () => {
  process.stderr.write(`Usage: tsx scripts/ops/delete-local-instance-db.ts \\
  --target-instance-id=<id> \\
  --target-db-container=<docker-container> \\
  --force \\
  [--target-db-name=sva_studio] \\
  [--target-db-user=sva] \\
  [--dry-run] \\
  [--yes]
`);
  process.exit(2);
};

const readOptionValue = (entry: string) => {
  const separatorIndex = entry.indexOf('=');
  if (separatorIndex === -1) {
    return null;
  }

  return {
    key: entry.slice(2, separatorIndex),
    value: entry.slice(separatorIndex + 1),
  };
};

export const parseDeleteLocalInstanceArgs = (args: readonly string[]): DeleteLocalInstanceCliOptions => {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (const entry of args) {
    if (!entry.startsWith('--')) {
      usage();
    }

    const option = readOptionValue(entry);
    if (!option) {
      flags.add(entry.slice(2));
      continue;
    }

    values.set(option.key, option.value);
  }

  const readRequired = (key: string): string => {
    const value = values.get(key)?.trim();
    if (!value) {
      throw new Error(`Missing required option --${key}=...`);
    }
    return value;
  };

  if (!flags.has('force')) {
    throw new Error('Hard delete requires the explicit --force flag.');
  }

  return {
    dryRun: flags.has('dry-run'),
    force: true,
    targetDbContainer: readRequired('target-db-container'),
    targetDbName: values.get('target-db-name')?.trim() || 'sva_studio',
    targetDbUser: values.get('target-db-user')?.trim() || 'sva',
    targetInstanceId: readRequired('target-instance-id'),
    yes: flags.has('yes'),
  };
};

export const shouldRequireInteractiveConfirmation = (input: {
  dryRun: boolean;
  isTty: boolean;
  yes: boolean;
}): boolean => input.isTty && !input.dryRun && !input.yes;

const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;

export const buildDeleteLocalInstanceSummarySql = (instanceId: string): string => `
SELECT 'content_history' AS table_name, COUNT(*)::text AS row_count
FROM iam.content_history
WHERE instance_id = ${sqlLiteral(instanceId)}
UNION ALL
SELECT 'contents' AS table_name, COUNT(*)::text AS row_count
FROM iam.contents
WHERE instance_id = ${sqlLiteral(instanceId)}
UNION ALL
SELECT 'instances' AS table_name, COUNT(*)::text AS row_count
FROM iam.instances
WHERE id = ${sqlLiteral(instanceId)}
ORDER BY table_name;
`;

export const buildDeleteLocalInstanceExecutionSql = (instanceId: string): string => `BEGIN;
SET LOCAL iam.retention_mode = 'true';
DELETE FROM iam.activity_logs WHERE instance_id = ${sqlLiteral(instanceId)};
DELETE FROM iam.content_history WHERE instance_id = ${sqlLiteral(instanceId)};
DELETE FROM iam.contents WHERE instance_id = ${sqlLiteral(instanceId)};
DELETE FROM iam.instances WHERE id = ${sqlLiteral(instanceId)};
COMMIT;
`;

const buildNonCascadeInstanceTableInspectionSql = (): string => `
WITH instance_tables AS (
  SELECT table_name
  FROM information_schema.columns
  WHERE table_schema = 'iam'
    AND column_name = 'instance_id'
),
tables_without_direct_instance_fk AS (
  SELECT instance_table.table_name
  FROM instance_tables instance_table
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel
      ON rel.oid = con.conrelid
    JOIN pg_namespace nsp
      ON nsp.oid = rel.relnamespace
    JOIN pg_class target_rel
      ON target_rel.oid = con.confrelid
    JOIN pg_namespace target_nsp
      ON target_nsp.oid = target_rel.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS key_attnum(attnum, ordinality)
      ON true
    JOIN pg_attribute source_att
      ON source_att.attrelid = rel.oid
     AND source_att.attnum = key_attnum.attnum
    WHERE con.contype = 'f'
      AND nsp.nspname = 'iam'
      AND rel.relname = instance_table.table_name
      AND target_nsp.nspname = 'iam'
      AND target_rel.relname = 'instances'
      AND source_att.attname = 'instance_id'
  )
)
SELECT table_name
FROM tables_without_direct_instance_fk
ORDER BY table_name;
`;

export const resolveUnknownNonCascadeInstanceTables = (tableNames: readonly string[]): string[] =>
  [...new Set(tableNames.filter((tableName) => !KNOWN_NON_CASCADE_INSTANCE_TABLES.has(tableName)))].sort((left, right) =>
    left.localeCompare(right),
  );

const run = (commandName: string, args: readonly string[], input?: string) => {
  const result = spawnSync(commandName, args, {
    cwd: rootDir,
    encoding: 'utf8',
    input,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${commandName} ${args.join(' ')} failed`);
  }

  return result.stdout;
};

const dockerPsql = (container: string, dbUser: string, dbName: string, sql: string) =>
  run('docker', ['exec', '-i', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', dbUser, '-d', dbName], sql);

const dockerPsqlQuiet = (container: string, dbUser: string, dbName: string, sql: string) =>
  run('docker', ['exec', '-i', container, 'psql', '-At', '-F', '\t', '-U', dbUser, '-d', dbName], sql).trim();

const logStep = (message: string) => {
  process.stdout.write(`\n==> ${message}\n`);
};

const parseTabSeparatedRows = (raw: string): string[][] =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('\t'));

const loadSummary = (options: DeleteLocalInstanceCliOptions) => {
  const raw = dockerPsqlQuiet(
    options.targetDbContainer,
    options.targetDbUser,
    options.targetDbName,
    buildDeleteLocalInstanceSummarySql(options.targetInstanceId),
  );

  return Object.fromEntries(parseTabSeparatedRows(raw).map(([tableName, rowCount]) => [tableName, Number.parseInt(rowCount, 10)]));
};

const loadNonCascadeInstanceTables = (options: DeleteLocalInstanceCliOptions) => {
  const raw = dockerPsqlQuiet(
    options.targetDbContainer,
    options.targetDbUser,
    options.targetDbName,
    buildNonCascadeInstanceTableInspectionSql(),
  );

  return parseTabSeparatedRows(raw).map(([tableName]) => tableName);
};

const assertKnownSchemaShape = (options: DeleteLocalInstanceCliOptions) => {
  const nonCascadeTables = loadNonCascadeInstanceTables(options);
  const unknownTables = resolveUnknownNonCascadeInstanceTables(nonCascadeTables);

  if (unknownTables.length > 0) {
    throw new Error(
      `Hard delete blocked because the schema contains unknown instance-bound non-cascade tables: ${unknownTables.join(', ')}.`,
    );
  }
};

const assertInstanceExists = (summary: Record<string, number>, instanceId: string) => {
  if ((summary.instances ?? 0) === 0) {
    throw new Error(`Instance ${instanceId} does not exist in the target database.`);
  }
};

const renderSummary = (summary: Record<string, number>) => {
  const lines = Object.entries(summary)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tableName, rowCount]) => `${tableName}: ${rowCount}`);

  process.stdout.write(`${lines.join('\n')}\n`);
};

const confirmDeletion = async (options: DeleteLocalInstanceCliOptions) => {
  if (!shouldRequireInteractiveConfirmation({ dryRun: options.dryRun, isTty: Boolean(process.stdin.isTTY), yes: options.yes })) {
    return;
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const confirmation = await readline.question(
      `Type the instance id "${options.targetInstanceId}" to confirm the local hard delete: `,
    );

    if (confirmation.trim() !== options.targetInstanceId) {
      throw new Error('Interactive confirmation did not match the target instance id.');
    }
  } finally {
    readline.close();
  }
};

const executeHardDelete = (options: DeleteLocalInstanceCliOptions) => {
  dockerPsql(
    options.targetDbContainer,
    options.targetDbUser,
    options.targetDbName,
    buildDeleteLocalInstanceExecutionSql(options.targetInstanceId),
  );
};

const main = async () => {
  const options = parseDeleteLocalInstanceArgs(rawArgs);

  logStep(`Pruefe Schema-Sicherungen fuer ${options.targetInstanceId}`);
  assertKnownSchemaShape(options);

  logStep(`Lese lokalen Loeschumfang fuer ${options.targetInstanceId}`);
  const summary = loadSummary(options);
  assertInstanceExists(summary, options.targetInstanceId);
  renderSummary(summary);

  if (options.dryRun) {
    logStep('Dry-run aktiviert; es wurden keine Daten geloescht.');
    return;
  }

  await confirmDeletion(options);

  logStep(`Loesche lokale Instanzdaten fuer ${options.targetInstanceId}`);
  executeHardDelete(options);
  logStep('Lokaler Hard-Delete abgeschlossen.');
};

if (process.argv[1] && resolve(process.argv[1]) === entrypointPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
