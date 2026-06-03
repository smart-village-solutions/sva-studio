import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  compareSchemaSnapshots,
  DEFAULT_IGNORED_SCHEMA_NAMES,
} from '../ops/runtime/db-schema-snapshot.ts';

export const DEFAULT_CI_SCHEMA_SNAPSHOT_DB = 'sva_schema_snapshot_ci';

export interface SchemaSnapshotVerificationReport {
  contentDrift: boolean;
  ignoredSchemas: readonly string[];
  missingObjects: readonly string[];
  status: 'drift' | 'ok';
  unexpectedObjects: readonly string[];
}

interface CliOptions {
  json: boolean;
}

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const parseCliOptions = (args: readonly string[]): CliOptions => ({
  json: args.includes('--json'),
});

const runCommand = (
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): string =>
  execFileSync(command, args, {
    cwd: rootDir,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const runComposeCommand = (args: readonly string[], env: NodeJS.ProcessEnv = process.env): string =>
  runCommand('docker', ['compose', ...args], env);

const ensurePostgresService = (): void => {
  const composeUpHelp = runComposeCommand(['up', '--help']);
  const supportsWait = composeUpHelp.includes('--wait');

  if (supportsWait) {
    runComposeCommand(['up', '-d', '--wait', '--wait-timeout', '120', 'postgres']);
    return;
  }

  runComposeCommand(['up', '-d', 'postgres']);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      runComposeCommand(['exec', '-T', 'postgres', 'pg_isready', '-U', 'sva', '-d', 'postgres']);
      return;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
  }

  throw new Error('Postgres wurde fuer den Schema-Snapshot-Check nicht rechtzeitig bereit.');
};

const recreateSnapshotDatabaseViaSql = (databaseName: string): void => {
  const sql = [
    'SELECT pg_terminate_backend(pid)',
    'FROM pg_stat_activity',
    "WHERE datname = :'db_name'",
    '  AND pid <> pg_backend_pid();',
    "SELECT format('DROP DATABASE IF EXISTS %I;', :'db_name');",
    '\\gexec',
    "SELECT format('CREATE DATABASE %I;', :'db_name');",
    '\\gexec',
  ].join('\n');

  execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'sva',
      '-d',
      'postgres',
      '-v',
      `db_name=${databaseName}`,
    ],
    {
      cwd: rootDir,
      env: process.env,
      input: sql,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
};

const applyMigrations = (databaseName: string): void => {
  execFileSync('bash', ['packages/data/scripts/run-migrations.sh', 'up'], {
    cwd: rootDir,
    env: {
      ...process.env,
      POSTGRES_DB: databaseName,
    },
    stdio: 'inherit',
  });
};

const dumpSchema = (databaseName: string): string =>
  runComposeCommand([
    'exec',
    '-T',
    'postgres',
    'pg_dump',
    '--schema-only',
    '--no-owner',
    '--no-privileges',
    '-U',
    'sva',
    '-d',
    databaseName,
  ]);

export const createSchemaSnapshotVerificationReport = (
  actualSql: string,
  expectedSql: string,
): SchemaSnapshotVerificationReport => {
  const comparison = compareSchemaSnapshots(actualSql, expectedSql, DEFAULT_IGNORED_SCHEMA_NAMES);
  const hasDrift =
    !comparison.contentMatches || comparison.missingObjects.length > 0 || comparison.unexpectedObjects.length > 0;

  return {
    contentDrift: !comparison.contentMatches,
    ignoredSchemas: comparison.ignoredSchemas,
    missingObjects: comparison.missingObjects,
    status: hasDrift ? 'drift' : 'ok',
    unexpectedObjects: comparison.unexpectedObjects,
  };
};

export const runDbSchemaSnapshotCheck = (args: readonly string[]): number => {
  const options = parseCliOptions(args);
  const startedAt = performance.now();

  ensurePostgresService();
  recreateSnapshotDatabaseViaSql(DEFAULT_CI_SCHEMA_SNAPSHOT_DB);
  applyMigrations(DEFAULT_CI_SCHEMA_SNAPSHOT_DB);

  const actualSql = dumpSchema(DEFAULT_CI_SCHEMA_SNAPSHOT_DB);
  const expectedSql = readFileSync(resolve(rootDir, 'docs/development/studio-db-schema-final.sql'), 'utf8');
  const report = createSchemaSnapshotVerificationReport(actualSql, expectedSql);
  const durationMs = performance.now() - startedAt;

  if (options.json) {
    console.log(JSON.stringify({ ...report, benchmarkMs: Math.round(durationMs) }, null, 2));
  } else if (report.status === 'ok') {
    console.log(
      `Der DB-Schema-Snapshot entspricht dem migrationsbasierten Referenzstand. Laufzeit: ${(durationMs / 1000).toFixed(2)}s.`
    );
  } else {
    console.log('Der DB-Schema-Snapshot driftet vom migrationsbasierten Referenzstand ab.');
    console.log(`  Definitionsdrift: ${report.contentDrift ? 'ja' : 'nein'}`);
    console.log(`  Fehlende Objekte: ${report.missingObjects.join(', ') || 'keine'}`);
    console.log(`  Unerwartete Objekte: ${report.unexpectedObjects.join(', ') || 'keine'}`);
    console.log(`  Laufzeit: ${(durationMs / 1000).toFixed(2)}s`);
  }

  if (report.status === 'drift') {
    return 1;
  }

  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runDbSchemaSnapshotCheck(process.argv.slice(2)));
}
