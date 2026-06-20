import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import { compareSchemaSnapshots } from './db-schema-snapshot.ts';
import type { RemoteRuntimeProfile } from '../runtime-env.shared.ts';
import { shellEscape } from './runtime-config.ts';

export type SchemaSnapshotVerificationReport = Readonly<{
  contentDrift: boolean;
  ignoredSchemas: readonly string[];
  missingObjects: readonly string[];
  status: 'drift' | 'ok';
  unexpectedObjects: readonly string[];
}>;

type RuntimeDbDeps = Readonly<{
  commandExists: (commandName: string) => boolean;
  getConfiguredQuantumEndpoint: (env: NodeJS.ProcessEnv) => string;
  getConfiguredStackName: (env: NodeJS.ProcessEnv) => string;
  isRemoteRuntimeProfile: (runtimeProfile: RuntimeProfile) => runtimeProfile is RemoteRuntimeProfile;
  rootDir: string;
  runCaptureDetailed: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => { status: number; stdout: string };
  runQuantumExec: (args: readonly string[], env: NodeJS.ProcessEnv, options: { failureMessage: string; marker?: string }) => string;
}>;

type DbEnv = {
  containerName: string;
  database: string;
  user: string;
};

export const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;
export const sqlIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const dbEnv = (env: NodeJS.ProcessEnv): DbEnv => ({
  containerName: env.SVA_LOCAL_POSTGRES_CONTAINER_NAME?.trim() || 'sva-studio-postgres',
  database: env.POSTGRES_DB ?? 'sva_studio',
  user: env.POSTGRES_USER ?? 'sva',
});

export const checkHttpHealth = async (url: string) => {
  const response = await fetch(url);
  const text = await response.text();
  let payload: unknown = text;

  try {
    payload = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    // keep the raw payload text for diagnostics
  }

  return { response, payload };
};

export const verifyDbSchemaSnapshot = (
  actualSql: string,
  expectedSql: string,
): SchemaSnapshotVerificationReport => {
  const comparison = compareSchemaSnapshots(actualSql, expectedSql);
  const hasDrift = !comparison.contentMatches || comparison.missingObjects.length > 0 || comparison.unexpectedObjects.length > 0;

  return {
    contentDrift: !comparison.contentMatches,
    ignoredSchemas: comparison.ignoredSchemas,
    missingObjects: comparison.missingObjects,
    status: hasDrift ? 'drift' : 'ok',
    unexpectedObjects: comparison.unexpectedObjects,
  };
};

const localPostgresContainerId = (deps: RuntimeDbDeps, env: NodeJS.ProcessEnv, containerName: string) => {
  const containerId = deps.runCaptureDetailed(
    'docker',
    ['ps', '--filter', `name=^/${containerName}$`, '--format', '{{.ID}}'],
    env,
  ).stdout.trim();
  if (containerId.length === 0) throw new Error(`Lokaler Postgres-Container ${containerName} nicht gefunden.`);
  return containerId;
};

const runLocalSql = (deps: RuntimeDbDeps, env: NodeJS.ProcessEnv, sql: string) => {
  const config = dbEnv(env);
  const containerId = localPostgresContainerId(deps, env, config.containerName);
  const result = spawnSync(
    'docker',
    ['exec', '-i', containerId, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', config.user, '-d', config.database, '-At', '-f', '-'],
    { cwd: deps.rootDir, env, encoding: 'utf8', input: sql },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout.trim() || 'SQL-Abfrage gegen lokalen Postgres fehlgeschlagen.');
  }
  return result.stdout.trim();
};

const remoteSqlScript = (sql: string, marker: string, config: DbEnv) => [
  'set -euo pipefail',
  "cat <<'SQL' >/tmp/sva-runtime-query.sql",
  sql,
  'SQL',
  `printf '%s\\n' '${marker}_START'`,
  `psql -X -P pager=off -v ON_ERROR_STOP=1 -U ${shellEscape(config.user)} -d ${shellEscape(config.database)} -At -f /tmp/sva-runtime-query.sql`,
  `printf '%s\\n' '${marker}_END'`,
  'rm -f /tmp/sva-runtime-query.sql',
  'sleep 1',
].join('\n');

const extractRemoteSqlPayload = (output: string, marker: string) => {
  const markerStart = `${marker}_START`;
  const markerEnd = `${marker}_END`;
  const markerStartIndex = output.indexOf(markerStart);
  const markerEndIndex = output.indexOf(markerEnd);

  if (markerStartIndex >= 0 && markerEndIndex > markerStartIndex) {
    const markerPayload = output.slice(markerStartIndex + markerStart.length, markerEndIndex).trim();
    if (markerPayload.length > 0) return markerPayload;
  }

  const jsonMatches = Array.from(output.matchAll(/\{.*\}/gu)).map((match) => match[0]);
  if (jsonMatches.length > 0) return jsonMatches.at(-1) ?? jsonMatches[0];

  const boolMatrixMatches = Array.from(output.matchAll(/(?:t|f)(?:\|(?:t|f)){3,}/gu)).map((match) => match[0]);
  if (boolMatrixMatches.length > 0) return boolMatrixMatches.at(-1) ?? boolMatrixMatches[0];

  const lines = output
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => entry !== markerStart && entry !== markerEnd);
  return lines.at(-1) ?? output;
};

const runAcceptanceSql = (deps: RuntimeDbDeps, env: NodeJS.ProcessEnv, sql: string) => {
  if (!deps.commandExists('quantum-cli')) throw new Error('quantum-cli ist fuer den Acceptance-DB-Check nicht verfuegbar.');

  const marker = '__SVA_DOCTOR_JSON__';
  const config = dbEnv(env);
  const output = deps.runQuantumExec(
    [
      'exec',
      '--endpoint',
      deps.getConfiguredQuantumEndpoint(env),
      '--stack',
      deps.getConfiguredStackName(env),
      '--service',
      env.SVA_ACCEPTANCE_POSTGRES_SERVICE ?? 'postgres',
      '--slot',
      env.SVA_ACCEPTANCE_POSTGRES_SLOT ?? '1',
      '-c',
      `sh -lc ${shellEscape(remoteSqlScript(sql, marker, config))}`,
    ],
    env,
    { marker, failureMessage: 'Remote-SQL-Abfrage fehlgeschlagen.' },
  );
  return extractRemoteSqlPayload(output, marker);
};

const createDbSqlRunner = (deps: RuntimeDbDeps, runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
  (sql: string) => (deps.isRemoteRuntimeProfile(runtimeProfile) ? runAcceptanceSql(deps, env, sql) : runLocalSql(deps, env, sql));

const createLocalSchemaDumpRunner = (deps: RuntimeDbDeps, env: NodeJS.ProcessEnv) => () => {
  const config = dbEnv(env);
  const containerId = localPostgresContainerId(deps, env, config.containerName);
  const result = spawnSync(
    'docker',
    ['exec', containerId, 'pg_dump', '--schema-only', '--no-owner', '--no-privileges', '-U', config.user, '-d', config.database],
    { cwd: deps.rootDir, env, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout.trim() || 'Schema-Dump gegen lokalen Postgres fehlgeschlagen.');
  }
  return result.stdout;
};

const verifyLocalDbSchemaSnapshot = (deps: RuntimeDbDeps, env: NodeJS.ProcessEnv): SchemaSnapshotVerificationReport => {
  const actualSql = createLocalSchemaDumpRunner(deps, env)();
  const expectedSql = readFileSync(resolve(deps.rootDir, 'docs/development/studio-db-schema-final.sql'), 'utf8');
  return verifyDbSchemaSnapshot(actualSql, expectedSql);
};

export const createRuntimeDbOps = (deps: RuntimeDbDeps) => ({
  createDbSqlRunner: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => createDbSqlRunner(deps, runtimeProfile, env),
  createLocalSchemaDumpRunner: (env: NodeJS.ProcessEnv) => createLocalSchemaDumpRunner(deps, env),
  verifyLocalDbSchemaSnapshot: (env: NodeJS.ProcessEnv) => verifyLocalDbSchemaSnapshot(deps, env),
}) as const;
