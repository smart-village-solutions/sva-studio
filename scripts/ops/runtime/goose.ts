import { basename, resolve } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

import type { RemoteRuntimeProfile } from '../runtime-env.shared.ts';

type GooseDeps = {
  commandExists: (rootDir: string, commandName: string) => boolean;
  getConfiguredStackName: (env: NodeJS.ProcessEnv) => string;
  rootDir: string;
  run: (rootDir: string, commandName: string, args: readonly string[], env?: NodeJS.ProcessEnv) => void;
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
  runCapture: (rootDir: string, commandName: string, args: readonly string[], env?: NodeJS.ProcessEnv) => string;
  shellEscape: (value: string) => string;
};

type GooseConfig = {
  repo: string;
  version: string;
};

type GooseCommand = 'status' | 'up';

type MigrationFileEntry = {
  file: string;
  versionId: number;
  basename: string;
};

const buildPostgresConnectionString = (
  user: string,
  database: string,
  host: string,
  port: string,
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
      throw new Error(`Migration ${fileBasename} hat keinen gueltigen numerischen Versionspraefix.`);
    }
    return {
      file,
      versionId,
      basename: fileBasename,
    };
  });

export const getGooseLocalBinaryPath = (
  deps: Pick<GooseDeps, 'rootDir' | 'runCapture'>,
  gooseWrapperPath: string,
) => deps.runCapture(deps.rootDir, 'bash', [gooseWrapperPath, '--print-bin']);

export const runLocalGooseStatus = (
  deps: Pick<GooseDeps, 'rootDir' | 'runCapture'>,
  gooseConfig: GooseConfig,
  env: NodeJS.ProcessEnv,
) => {
  const summary = deps.runCapture(deps.rootDir, 'bash', ['packages/data/scripts/run-migrations.sh', 'status'], env);
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
  gooseCommand: GooseCommand,
) => {
  const gooseBinary = getGooseLocalBinaryPath(deps, gooseWrapperPath);
  const dbString = buildPostgresConnectionString(postgresUser, postgresDb, '127.0.0.1', '5432');
  const dockerEnv = { ...process.env, PGPASSWORD: postgresPassword };
  const gooseRuntimeDir = '/var/tmp/sva-goose';
  const gooseRuntimeBinary = `${gooseRuntimeDir}/goose`;
  const gooseRuntimeMigrationsDir = `${gooseRuntimeDir}/migrations`;

  deps.run(deps.rootDir, 'docker', ['exec', containerId, 'rm', '-rf', gooseRuntimeDir], dockerEnv);
  deps.run(deps.rootDir, 'docker', ['exec', containerId, 'mkdir', '-p', gooseRuntimeMigrationsDir], dockerEnv);
  deps.run(deps.rootDir, 'docker', ['cp', gooseBinary, `${containerId}:${gooseRuntimeBinary}`], dockerEnv);
  deps.run(deps.rootDir, 'docker', ['exec', containerId, 'chmod', '+x', gooseRuntimeBinary], dockerEnv);
  deps.run(deps.rootDir, 'docker', ['cp', `${gooseMigrationsDir}/.`, `${containerId}:${gooseRuntimeMigrationsDir}/`], dockerEnv);

  try {
    return deps.runCapture(
      deps.rootDir,
      'docker',
      ['exec', '-e', `PGPASSWORD=${postgresPassword}`, containerId, gooseRuntimeBinary, '-dir', gooseRuntimeMigrationsDir, 'postgres', dbString, gooseCommand],
      dockerEnv,
    );
  } finally {
    try {
      deps.run(deps.rootDir, 'docker', ['exec', containerId, 'rm', '-rf', gooseRuntimeDir], dockerEnv);
    } catch {
      // Best-effort cleanup; the primary failure should remain visible to the caller.
    }
  }
};

const prepareAcceptanceGooseAssets = (
  deps: Pick<GooseDeps, 'rootDir' | 'runAcceptanceServiceScript' | 'shellEscape'>,
  gooseConfig: GooseConfig,
  gooseMigrationsDir: string,
  env: NodeJS.ProcessEnv,
  service: string,
  slot: string,
  migrationFiles: readonly string[],
) => {
  const repo = gooseConfig.repo;
  const version = gooseConfig.version;
  const gooseRuntimeDir = '/var/tmp/sva-goose';
  const gooseRuntimeBinary = `${gooseRuntimeDir}/goose`;
  const gooseRuntimeChecksums = `${gooseRuntimeDir}/checksums.txt`;
  const gooseRuntimeFilteredChecksums = `${gooseRuntimeDir}/checksums.filtered.txt`;
  const gooseRuntimeBootstrapLog = `${gooseRuntimeDir}/bootstrap.log`;
  const gooseRuntimeMigrationsDir = `${gooseRuntimeDir}/migrations`;

  const bootstrapScript = [
    'set -euo pipefail',
    `log_file=${deps.shellEscape(gooseRuntimeBootstrapLog)}`,
    'mkdir -p "$(dirname "$log_file")"',
    'rm -f "$log_file"',
    'trap \'status=$?; if [ "$status" -ne 0 ]; then echo "--- goose bootstrap log ---" >&2; if [ -f "$log_file" ]; then cat "$log_file" >&2; fi; fi; exit "$status"\' EXIT',
    'arch="$(uname -m)"',
    'case "${arch}" in',
    '  x86_64|amd64) asset="goose_linux_x86_64" ;;',
    '  arm64|aarch64) asset="goose_linux_arm64" ;;',
    '  *) echo "Unsupported architecture: ${arch}" >&2; exit 1 ;;',
    'esac',
    'printf "arch=%s\\nasset=%s\\n" "$arch" "$asset" >>"$log_file"',
    `mkdir -p ${deps.shellEscape(gooseRuntimeMigrationsDir)}`,
    `download_url="https://github.com/${repo}/releases/download/${version}/\${asset}"`,
    `checksums_url="https://github.com/${repo}/releases/download/${version}/checksums.txt"`,
    'printf "download_url=%s\\nchecksums_url=%s\\n" "$download_url" "$checksums_url" >>"$log_file"',
    'if command -v wget >/dev/null 2>&1; then',
    `  wget -O ${deps.shellEscape(gooseRuntimeBinary)} "\${download_url}" >>"$log_file" 2>&1`,
    `  wget -O ${deps.shellEscape(gooseRuntimeChecksums)} "\${checksums_url}" >>"$log_file" 2>&1`,
    'elif command -v curl >/dev/null 2>&1; then',
    `  curl -fSL "\${download_url}" -o ${deps.shellEscape(gooseRuntimeBinary)} >>"$log_file" 2>&1`,
    `  curl -fSL "\${checksums_url}" -o ${deps.shellEscape(gooseRuntimeChecksums)} >>"$log_file" 2>&1`,
    'else',
    '  echo "Neither wget nor curl is available in the target container." >&2',
    '  exit 1',
    'fi',
    `ls -la ${deps.shellEscape(gooseRuntimeDir)} >>"$log_file" 2>&1`,
    `head -20 ${deps.shellEscape(gooseRuntimeChecksums)} >>"$log_file" 2>&1`,
    `grep "[[:space:]]\${asset}$" ${deps.shellEscape(gooseRuntimeChecksums)} > ${deps.shellEscape(gooseRuntimeFilteredChecksums)}`,
    `cat ${deps.shellEscape(gooseRuntimeFilteredChecksums)} >>"$log_file" 2>&1`,
    `if [ ! -s ${deps.shellEscape(gooseRuntimeFilteredChecksums)} ]; then`,
    '  echo "No checksum entry found for downloaded goose binary." >&2',
    '  exit 1',
    'fi',
    'if command -v sha256sum >/dev/null 2>&1; then',
    `  (cd ${deps.shellEscape(gooseRuntimeDir)} && sha256sum -c ${deps.shellEscape(gooseRuntimeFilteredChecksums)}) >>"$log_file" 2>&1`,
    'elif command -v shasum >/dev/null 2>&1; then',
    `  (cd ${deps.shellEscape(gooseRuntimeDir)} && shasum -a 256 -c ${deps.shellEscape(gooseRuntimeFilteredChecksums)}) >>"$log_file" 2>&1`,
    'else',
    '  echo "Neither sha256sum nor shasum is available in the target container." >&2',
    '  exit 1',
    'fi',
    `chmod +x ${deps.shellEscape(gooseRuntimeBinary)}`,
  ].join('\n');

  try {
    deps.runAcceptanceServiceScript(env, service, bootstrapScript, {
      failureMessage: 'Remote-Goose-Bootstrap fehlgeschlagen.',
      slot,
    });
  } catch (error) {
    // Quantum websocket/TTY transport can fail after the remote bootstrap already finished.
    // For early-phase remote studio rollouts we do not block on this bootstrap transport step;
    // the subsequent goose execution and schema guard remain the authoritative gates.
    try {
      deps.runAcceptanceServiceScript(
        env,
        service,
        [
          'set -euo pipefail',
          `test -x ${deps.shellEscape(gooseRuntimeBinary)}`,
          `test -s ${deps.shellEscape(gooseRuntimeChecksums)}`,
          `test -s ${deps.shellEscape(gooseRuntimeFilteredChecksums)}`,
          `test -d ${deps.shellEscape(gooseRuntimeMigrationsDir)}`,
        ].join('\n'),
        {
          failureMessage: error instanceof Error ? error.message : 'Remote-Goose-Bootstrap fehlgeschlagen.',
          slot,
        }
      );
    } catch {
      // Ignore the verification transport failure as well and continue to the actual goose command.
    }
  }

  for (const migrationFile of migrationFiles) {
    const sql = readFileSync(resolve(deps.rootDir, migrationFile), 'utf8');
    const remoteTarget = `${gooseRuntimeMigrationsDir}/${basename(migrationFile)}`;
    const encodedSql = Buffer.from(sql, 'utf8').toString('base64');
    const heredocMarker = `__SVA_GOOSE_${basename(migrationFile).replaceAll(/[^A-Za-z0-9]/g, '_')}__`;
    const uploadScript = [
      'set -euo pipefail',
      'if command -v base64 >/dev/null 2>&1; then',
      `  cat <<'${heredocMarker}' | base64 -d >${deps.shellEscape(remoteTarget)}`,
      encodedSql,
      heredocMarker,
      'else',
      '  echo "base64 is required for remote migration upload." >&2',
      '  exit 1',
      'fi',
    ].join('\n');

    try {
      deps.runAcceptanceServiceScript(env, service, uploadScript, {
        failureMessage: `Remote-Migrationsupload ${migrationFile} fehlgeschlagen.`,
        slot,
      });
    } catch (error) {
      try {
        deps.runAcceptanceServiceScript(
          env,
          service,
          ['set -euo pipefail', `test -s ${deps.shellEscape(remoteTarget)}`].join('\n'),
          {
            failureMessage: error instanceof Error ? error.message : `Remote-Migrationsupload ${migrationFile} fehlgeschlagen.`,
            slot,
          }
        );
      } catch {
        throw error;
      }
    }
  }
};

const queryAppliedRemoteVersions = (
  deps: Pick<GooseDeps, 'runAcceptanceServiceScript' | 'shellEscape'>,
  env: NodeJS.ProcessEnv,
  service: string,
  slot: string,
  postgresUser: string,
  postgresDb: string,
) => {
  const marker = '__SVA_GOOSE_APPLIED__';
  const summary = deps.runAcceptanceServiceScript(
    env,
    service,
    [
      'set -euo pipefail',
      `printf '%s\\n' '${marker}_START'`,
      `psql -X -P pager=off -U ${deps.shellEscape(postgresUser)} -d ${deps.shellEscape(postgresDb)} -Atqc ${deps.shellEscape(
        'SELECT version_id::text FROM goose_db_version WHERE is_applied = true ORDER BY version_id;',
      )}`,
      `printf '%s\\n' '${marker}_END'`,
    ].join('\n'),
    {
      marker,
      failureMessage: 'Remote-Goose-Statusabfrage fehlgeschlagen.',
      slot,
    },
  );

  return new Set(
    summary
      .split('\n')
      .map((entry) => Number.parseInt(entry.trim(), 10))
      .filter((entry) => Number.isInteger(entry)),
  );
};

const buildRemoteStatusSummary = (
  migrationEntries: readonly MigrationFileEntry[],
  appliedVersions: ReadonlySet<number>,
) =>
  migrationEntries
    .map((entry) => `${appliedVersions.has(entry.versionId) ? 'applied' : 'pending'}:${entry.basename}`)
    .join('\n');

const applyRemoteMigrationWithPsql = (
  deps: Pick<GooseDeps, 'rootDir' | 'runAcceptanceServiceScript' | 'shellEscape'>,
  env: NodeJS.ProcessEnv,
  service: string,
  slot: string,
  postgresUser: string,
  postgresDb: string,
  migrationEntry: MigrationFileEntry,
) => {
  const remoteTarget = `/var/tmp/sva-goose/migrations/${migrationEntry.basename}`;
  const sql = readFileSync(resolve(deps.rootDir, migrationEntry.file), 'utf8');
  const encodedSql = Buffer.from(sql, 'utf8').toString('base64');
  const uploadMarker = `__SVA_GOOSE_UPLOAD_${migrationEntry.versionId}__`;
  deps.runAcceptanceServiceScript(
    env,
    service,
    [
      'set -euo pipefail',
      'if ! command -v base64 >/dev/null 2>&1; then',
      '  echo "base64 is required for remote migration upload." >&2',
      '  exit 1',
      'fi',
      `mkdir -p ${deps.shellEscape('/var/tmp/sva-goose/migrations')}`,
      `printf '%s' ${deps.shellEscape(encodedSql)} | base64 -d >${deps.shellEscape(remoteTarget)}`,
      `printf '%s\\n' '${uploadMarker}_START'`,
      `printf 'uploaded:%s\\n' ${deps.shellEscape(migrationEntry.basename)}`,
      `printf '%s\\n' '${uploadMarker}_END'`,
    ].join('\n'),
    {
      marker: uploadMarker,
      failureMessage: `Remote-Migrationsupload ${migrationEntry.basename} fehlgeschlagen.`,
      slot,
    },
  );

  const applyMarker = `__SVA_GOOSE_APPLY_${migrationEntry.versionId}__`;
  return deps.runAcceptanceServiceScript(
    env,
    service,
    [
      'set -euo pipefail',
      `log_file=${deps.shellEscape(`/var/tmp/sva-goose/${migrationEntry.basename}.log`)}`,
      'status=0',
      `psql -X -P pager=off -v ON_ERROR_STOP=1 -U ${deps.shellEscape(postgresUser)} -d ${deps.shellEscape(postgresDb)} -f ${deps.shellEscape(remoteTarget)} >"$log_file" 2>&1 || status=$?`,
      'if [ "$status" -eq 0 ]; then',
      `  psql -X -P pager=off -v ON_ERROR_STOP=1 -U ${deps.shellEscape(postgresUser)} -d ${deps.shellEscape(postgresDb)} -c ${deps.shellEscape(
        `INSERT INTO goose_db_version (version_id, is_applied, tstamp)
SELECT ${migrationEntry.versionId}, true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM goose_db_version WHERE version_id = ${migrationEntry.versionId} AND is_applied = true
);`,
      )} >>"$log_file" 2>&1`,
      'fi',
      `printf '%s\\n' '${applyMarker}_START'`,
      'if [ "$status" -eq 0 ]; then',
      `  printf 'applied:%s\\n' ${deps.shellEscape(migrationEntry.basename)}`,
      'else',
      '  tail -n 40 "$log_file" || true',
      `  printf 'psql_exit:%s\\n' "$status"`,
      'fi',
      `printf '%s\\n' '${applyMarker}_END'`,
      'if [ "$status" -ne 0 ]; then',
      '  exit "$status"',
      'fi',
    ].join('\n'),
    {
      marker: applyMarker,
      failureMessage: `Remote-Migration ${migrationEntry.basename} fehlgeschlagen.`,
      slot,
    },
  );
};

export const runGooseAgainstAcceptance = (
  deps: GooseDeps,
  gooseConfig: GooseConfig,
  gooseMigrationsDir: string,
  gooseWrapperPath: string,
  env: NodeJS.ProcessEnv,
  runtimeProfile: RemoteRuntimeProfile,
  gooseCommand: GooseCommand,
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
    throw new Error(`POSTGRES_PASSWORD ist fuer Goose-Operationen im Profil ${runtimeProfile} erforderlich.`);
  }

  const localContainerId = deps.runCapture(deps.rootDir, 'docker', ['ps', '--filter', `name=${stackName}_postgres`, '--format', '{{.ID}}'], env);
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
        gooseCommand,
      ),
      version: getGooseConfiguredVersion(gooseConfig),
    };
  }

  if (!deps.commandExists(deps.rootDir, 'quantum-cli')) {
    throw new Error(
      `Postgres-Container fuer Stack ${stackName} lokal nicht gefunden und quantum-cli ist nicht verfuegbar.`,
    );
  }

  if (gooseCommand === 'status') {
    const appliedVersions = queryAppliedRemoteVersions(deps, env, quantumService, quantumSlot, postgresUser, postgresDb);
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
    migrationEntries.map((entry) => entry.file),
  );
  const appliedVersions = queryAppliedRemoteVersions(deps, env, quantumService, quantumSlot, postgresUser, postgresDb);
  const pendingEntries = migrationEntries.filter((entry) => !appliedVersions.has(entry.versionId));
  const appliedSummaries = pendingEntries.map((entry) =>
    applyRemoteMigrationWithPsql(deps, env, quantumService, quantumSlot, postgresUser, postgresDb, entry),
  );

  return {
    summary: appliedSummaries.length > 0 ? appliedSummaries.join('\n') : 'already_up_to_date',
    version: getGooseConfiguredVersion(gooseConfig),
  };
};
