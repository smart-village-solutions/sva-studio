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
  runCaptureDetailed: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => {
    status: number;
    stdout: string;
  };
  runQuantumExec: (
    args: readonly string[],
    env: NodeJS.ProcessEnv,
    options: {
      failureMessage: string;
      marker?: string;
    },
  ) => string;
}>;

export const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;
export const sqlIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

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

export const createRuntimeDbOps = (deps: RuntimeDbDeps) => {
  const createDbSqlRunner = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
    const postgresUser = env.POSTGRES_USER ?? 'sva';
    const postgresDb = env.POSTGRES_DB ?? 'sva_studio';
    const localPostgresContainerName = env.SVA_LOCAL_POSTGRES_CONTAINER_NAME?.trim() || 'sva-studio-postgres';

    const runLocalSql = (sql: string) => {
      const localContainerId = deps.runCaptureDetailed(
        'docker',
        ['ps', '--filter', `name=^/${localPostgresContainerName}$`, '--format', '{{.ID}}'],
        env,
      ).stdout.trim();

      if (localContainerId.length === 0) {
        throw new Error(`Lokaler Postgres-Container ${localPostgresContainerName} nicht gefunden.`);
      }

      const result = spawnSync(
        'docker',
        ['exec', '-i', localContainerId, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', postgresUser, '-d', postgresDb, '-At', '-f', '-'],
        {
          cwd: deps.rootDir,
          env,
          encoding: 'utf8',
          input: sql,
        },
      );

      if (result.status !== 0) {
        throw new Error(result.stderr?.trim() || result.stdout.trim() || 'SQL-Abfrage gegen lokalen Postgres fehlgeschlagen.');
      }

      return result.stdout.trim();
    };

    const runAcceptanceSql = (sql: string) => {
      if (!deps.commandExists('quantum-cli')) {
        throw new Error('quantum-cli ist fuer den Acceptance-DB-Check nicht verfuegbar.');
      }

      const stackName = deps.getConfiguredStackName(env);
      const quantumEndpoint = deps.getConfiguredQuantumEndpoint(env);
      const quantumService = env.SVA_ACCEPTANCE_POSTGRES_SERVICE ?? 'postgres';
      const quantumSlot = env.SVA_ACCEPTANCE_POSTGRES_SLOT ?? '1';
      const marker = '__SVA_DOCTOR_JSON__';
      const remoteScript = [
        'set -euo pipefail',
        "cat <<'SQL' >/tmp/sva-runtime-query.sql",
        sql,
        'SQL',
        `printf '%s\\n' '${marker}_START'`,
        `psql -X -P pager=off -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(postgresDb)} -At -f /tmp/sva-runtime-query.sql`,
        `printf '%s\\n' '${marker}_END'`,
        'rm -f /tmp/sva-runtime-query.sql',
        'sleep 1',
      ].join('\n');

      const output = deps.runQuantumExec(
        [
          'exec',
          '--endpoint',
          quantumEndpoint,
          '--stack',
          stackName,
          '--service',
          quantumService,
          '--slot',
          quantumSlot,
          '-c',
          `sh -lc ${shellEscape(remoteScript)}`,
        ],
        env,
        {
          marker,
          failureMessage: 'Remote-SQL-Abfrage fehlgeschlagen.',
        },
      );

      const markerStart = `${marker}_START`;
      const markerEnd = `${marker}_END`;
      const markerStartIndex = output.indexOf(markerStart);
      const markerEndIndex = output.indexOf(markerEnd);

      if (markerStartIndex >= 0 && markerEndIndex > markerStartIndex) {
        const markerPayload = output
          .slice(markerStartIndex + markerStart.length, markerEndIndex)
          .trim();
        if (markerPayload.length > 0) {
          return markerPayload;
        }
      }

      const jsonMatches = Array.from(output.matchAll(/\{.*\}/gu)).map((match) => match[0]);
      if (jsonMatches.length > 0) {
        return jsonMatches.at(-1) ?? jsonMatches[0];
      }

      const boolMatrixMatches = Array.from(output.matchAll(/(?:t|f)(?:\|(?:t|f)){3,}/gu)).map((match) => match[0]);
      if (boolMatrixMatches.length > 0) {
        return boolMatrixMatches.at(-1) ?? boolMatrixMatches[0];
      }

      const lines = output
        .split(/\r?\n/u)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .filter((entry) => entry !== `${marker}_START` && entry !== `${marker}_END`);

      return lines.at(-1) ?? output;
    };

    return (sql: string) => (deps.isRemoteRuntimeProfile(runtimeProfile) ? runAcceptanceSql(sql) : runLocalSql(sql));
  };

  const createLocalSchemaDumpRunner = (env: NodeJS.ProcessEnv) => {
    const postgresUser = env.POSTGRES_USER ?? 'sva';
    const postgresDb = env.POSTGRES_DB ?? 'sva_studio';
    const localPostgresContainerName = env.SVA_LOCAL_POSTGRES_CONTAINER_NAME?.trim() || 'sva-studio-postgres';

    return () => {
      const localContainerId = deps.runCaptureDetailed(
        'docker',
        ['ps', '--filter', `name=^/${localPostgresContainerName}$`, '--format', '{{.ID}}'],
        env,
      ).stdout.trim();

      if (localContainerId.length === 0) {
        throw new Error(`Lokaler Postgres-Container ${localPostgresContainerName} nicht gefunden.`);
      }

      const result = spawnSync(
        'docker',
        ['exec', localContainerId, 'pg_dump', '--schema-only', '--no-owner', '--no-privileges', '-U', postgresUser, '-d', postgresDb],
        {
          cwd: deps.rootDir,
          env,
          encoding: 'utf8',
        },
      );

      if (result.status !== 0) {
        throw new Error(result.stderr?.trim() || result.stdout.trim() || 'Schema-Dump gegen lokalen Postgres fehlgeschlagen.');
      }

      return result.stdout;
    };
  };

  const verifyLocalDbSchemaSnapshot = (env: NodeJS.ProcessEnv): SchemaSnapshotVerificationReport => {
    const actualSql = createLocalSchemaDumpRunner(env)();
    const expectedSql = readFileSync(resolve(deps.rootDir, 'docs/development/studio-db-schema-final.sql'), 'utf8');
    return verifyDbSchemaSnapshot(actualSql, expectedSql);
  };

  return {
    createDbSqlRunner,
    createLocalSchemaDumpRunner,
    verifyLocalDbSchemaSnapshot,
  } as const;
};
