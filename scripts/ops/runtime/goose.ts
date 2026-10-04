import { basename } from 'node:path';
import { readdirSync } from 'node:fs';

import type { RemoteRuntimeProfile } from '../runtime-env.shared.ts';
import {
  prepareAcceptanceGooseAssets,
  queryAppliedRemoteVersions,
  buildRemoteStatusSummary,
  applyRemoteMigrationWithPsql,
} from './goose-remote.ts';

export type GooseDeps = {
  commandExists: (rootDir: string, commandName: string) => boolean;
  getConfiguredStackName: (env: NodeJS.ProcessEnv) => string;
  rootDir: string;
  run: (
    rootDir: string,
    commandName: string,
    args: readonly string[],
    env?: NodeJS.ProcessEnv
  ) => void;
  runAcceptanceServiceScript: (
    env: NodeJS.ProcessEnv,
    service: string,
    script: string,
    options: {
      failureMessage: string;
      marker?: string;
      slot?: string;
    }
  ) => string;
  runCapture: (
    rootDir: string,
    commandName: string,
    args: readonly string[],
    env?: NodeJS.ProcessEnv
  ) => string;
  shellEscape: (value: string) => string;
};

export type GooseConfig = {
  repo: string;
  version: string;
};

type GooseCommand = 'status' | 'up';

export type MigrationFileEntry = {
  file: string;
  versionId: number;
  basename: string;
};

const buildPostgresConnectionString = (
  user: string,
  database: string,
  host: string,
  port: string
) => `postgres://${encodeURIComponent(user)}@${host}:${port}/${database}?sslmode=disable`;

export const listGooseMigrationFiles = (gooseMigrationsDir: string) =>
  readdirSync(gooseMigrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => `packages/data/migrations/${entry.name}`)
    .sort();

export const getGooseConfiguredVersion = (gooseConfig: GooseConfig) => gooseConfig.version;

const getMigrationFileEntries = (gooseMigrationsDir: string): MigrationFileEntry[] =>
  listGooseMigrationFiles(gooseMigrationsDir).map((file) => {
    const fileBasename = basename(file);
    const versionPrefix = fileBasename.split('_', 1)[0] ?? '';
    const versionId = Number.parseInt(versionPrefix, 10);
    if (!Number.isInteger(versionId)) {
      throw new Error(
        `Migration ${fileBasename} hat keinen gueltigen numerischen Versionspraefix.`
      );
    }
    return {
      file,
      versionId,
      basename: fileBasename,
    };
  });

export const getGooseLocalBinaryPath = (
  deps: Pick<GooseDeps, 'rootDir' | 'runCapture'>,
  gooseWrapperPath: string
) => deps.runCapture(deps.rootDir, 'bash', [gooseWrapperPath, '--print-bin']);

export const runLocalGooseStatus = (
  deps: Pick<GooseDeps, 'rootDir' | 'runCapture'>,
  gooseConfig: GooseConfig,
  env: NodeJS.ProcessEnv
) => {
  const summary = deps.runCapture(
    deps.rootDir,
    'bash',
    ['packages/data/scripts/run-migrations.sh', 'status'],
    env
  );
  return {
    summary,
    version: getGooseConfiguredVersion(gooseConfig),
  };
};

const runGooseAgainstLocalAcceptanceContainer = (
  deps: Pick<GooseDeps, 'rootDir' | 'run' | 'runCapture'>,
  gooseMigrationsDir: string,
  gooseWrapperPath: string,
  containerId: string,
  postgresUser: string,
  postgresPassword: string,
  postgresDb: string,
  gooseCommand: GooseCommand
) => {
  const gooseBinary = getGooseLocalBinaryPath(deps, gooseWrapperPath);
  const dbString = buildPostgresConnectionString(postgresUser, postgresDb, '127.0.0.1', '5432');
  const dockerEnv = { ...process.env, PGPASSWORD: postgresPassword };
  const gooseRuntimeDir = '/var/tmp/sva-goose';
  const gooseRuntimeBinary = `${gooseRuntimeDir}/goose`;
  const gooseRuntimeMigrationsDir = `${gooseRuntimeDir}/migrations`;

  deps.run(deps.rootDir, 'docker', ['exec', containerId, 'rm', '-rf', gooseRuntimeDir], dockerEnv);
  deps.run(
    deps.rootDir,
    'docker',
    ['exec', containerId, 'mkdir', '-p', gooseRuntimeMigrationsDir],
    dockerEnv
  );
  deps.run(
    deps.rootDir,
    'docker',
    ['cp', gooseBinary, `${containerId}:${gooseRuntimeBinary}`],
    dockerEnv
  );
  deps.run(
    deps.rootDir,
    'docker',
    ['exec', containerId, 'chmod', '+x', gooseRuntimeBinary],
    dockerEnv
  );
  deps.run(
    deps.rootDir,
    'docker',
    ['cp', `${gooseMigrationsDir}/.`, `${containerId}:${gooseRuntimeMigrationsDir}/`],
    dockerEnv
  );

  try {
    return deps.runCapture(
      deps.rootDir,
      'docker',
      [
        'exec',
        '-e',
        `PGPASSWORD=${postgresPassword}`,
        containerId,
        gooseRuntimeBinary,
        '-dir',
        gooseRuntimeMigrationsDir,
        'postgres',
        dbString,
        gooseCommand,
      ],
      dockerEnv
    );
  } finally {
    try {
      deps.run(
        deps.rootDir,
        'docker',
        ['exec', containerId, 'rm', '-rf', gooseRuntimeDir],
        dockerEnv
      );
    } catch {
      // Best-effort cleanup; the primary failure should remain visible to the caller.
    }
  }
};

export const runGooseAgainstAcceptance = (
  deps: GooseDeps,
  gooseConfig: GooseConfig,
  gooseMigrationsDir: string,
  gooseWrapperPath: string,
  env: NodeJS.ProcessEnv,
  runtimeProfile: RemoteRuntimeProfile,
  gooseCommand: GooseCommand
) => {
  const stackName = deps.getConfiguredStackName(env);
  const postgresUser = env.POSTGRES_USER ?? 'sva';
  const postgresPassword = env.POSTGRES_PASSWORD ?? '';
  const postgresDb = env.POSTGRES_DB ?? 'sva_studio';
  const quantumService = env.SVA_ACCEPTANCE_POSTGRES_SERVICE ?? 'postgres';
  const quantumSlot = env.SVA_ACCEPTANCE_POSTGRES_SLOT ?? '1';
  const migrationEntries = getMigrationFileEntries(gooseMigrationsDir);

  if (migrationEntries.length === 0) {
    throw new Error('Keine Goose-Migrationen unter packages/data/migrations gefunden.');
  }

  if (!postgresPassword) {
    throw new Error(
      `POSTGRES_PASSWORD ist fuer Goose-Operationen im Profil ${runtimeProfile} erforderlich.`
    );
  }

  const localContainerId = deps.runCapture(
    deps.rootDir,
    'docker',
    ['ps', '--filter', `name=${stackName}_postgres`, '--format', '{{.ID}}'],
    env
  );
  if (localContainerId.length > 0) {
    return {
      summary: runGooseAgainstLocalAcceptanceContainer(
        deps,
        gooseMigrationsDir,
        gooseWrapperPath,
        localContainerId,
        postgresUser,
        postgresPassword,
        postgresDb,
        gooseCommand
      ),
      version: getGooseConfiguredVersion(gooseConfig),
    };
  }

  if (!deps.commandExists(deps.rootDir, 'quantum-cli')) {
    throw new Error(
      `Postgres-Container fuer Stack ${stackName} lokal nicht gefunden und quantum-cli ist nicht verfuegbar.`
    );
  }

  if (gooseCommand === 'status') {
    const appliedVersions = queryAppliedRemoteVersions(
      deps,
      env,
      quantumService,
      quantumSlot,
      postgresUser,
      postgresDb
    );
    return {
      summary: buildRemoteStatusSummary(migrationEntries, appliedVersions),
      version: getGooseConfiguredVersion(gooseConfig),
    };
  }

  prepareAcceptanceGooseAssets(
    deps,
    gooseConfig,
    gooseMigrationsDir,
    env,
    quantumService,
    quantumSlot,
    migrationEntries.map((entry) => entry.file)
  );
  const appliedVersions = queryAppliedRemoteVersions(
    deps,
    env,
    quantumService,
    quantumSlot,
    postgresUser,
    postgresDb
  );
  const pendingEntries = migrationEntries.filter((entry) => !appliedVersions.has(entry.versionId));
  const appliedSummaries = pendingEntries.map((entry) =>
    applyRemoteMigrationWithPsql(
      deps,
      env,
      quantumService,
      quantumSlot,
      postgresUser,
      postgresDb,
      entry
    )
  );

  return {
    summary: appliedSummaries.length > 0 ? appliedSummaries.join('\n') : 'already_up_to_date',
    version: getGooseConfiguredVersion(gooseConfig),
  };
};
