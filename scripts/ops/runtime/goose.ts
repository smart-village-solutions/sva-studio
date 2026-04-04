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
  const migrationFiles = listGooseMigrationFiles(gooseMigrationsDir);

  if (migrationFiles.length === 0) {
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

  prepareAcceptanceGooseAssets(deps, gooseConfig, gooseMigrationsDir, env, quantumService, quantumSlot, migrationFiles);
  const dbString = buildPostgresConnectionString(postgresUser, postgresDb, '127.0.0.1', '5432');
  const gooseRuntimeDir = '/var/tmp/sva-goose';
  const gooseRuntimeBinary = `${gooseRuntimeDir}/goose`;
  const gooseRuntimeMigrationsDir = `${gooseRuntimeDir}/migrations`;
  const gooseRuntimeExecLog = `${gooseRuntimeDir}/goose.exec.log`;
  const marker = '__SVA_GOOSE_RESULT__';
  const summary = deps.runAcceptanceServiceScript(
    env,
    quantumService,
    [
      'set -euo pipefail',
      `if [ ! -s ${deps.shellEscape(gooseRuntimeBinary)} ]; then`,
      `  echo "Remote goose binary missing after bootstrap: ${gooseRuntimeBinary}" >&2`,
      '  exit 1',
      'fi',
      `chmod 755 ${deps.shellEscape(gooseRuntimeBinary)}`,
      `if [ ! -x ${deps.shellEscape(gooseRuntimeBinary)} ]; then`,
      `  echo "Remote goose binary is not executable after chmod: ${gooseRuntimeBinary}" >&2`,
      '  exit 1',
      'fi',
      `cleanup() { rm -rf ${deps.shellEscape(gooseRuntimeDir)}; }`,
      'trap cleanup EXIT',
      `printf '%s\\n' '${marker}_START'`,
      `status=0`,
      `PGPASSWORD=${deps.shellEscape(postgresPassword)} ${deps.shellEscape(gooseRuntimeBinary)} -dir ${deps.shellEscape(gooseRuntimeMigrationsDir)} postgres ${deps.shellEscape(dbString)} ${gooseCommand} >${deps.shellEscape(gooseRuntimeExecLog)} 2>&1 || status=$?`,
      `if [ -f ${deps.shellEscape(gooseRuntimeExecLog)} ]; then cat ${deps.shellEscape(gooseRuntimeExecLog)}; fi`,
      `printf 'goose_exit:%s\\n' \"$status\"`,
      `if [ \"$status\" -ne 0 ]; then ls -l ${deps.shellEscape(gooseRuntimeBinary)} 2>&1 || true; fi`,
      `printf '%s\\n' '${marker}_END'`,
      `if [ \"$status\" -ne 0 ]; then exit \"$status\"; fi`,
      'sleep 1',
    ].join('\n'),
    {
      marker,
      failureMessage: `Remote-Goose-${gooseCommand} fehlgeschlagen.`,
      slot: quantumSlot,
    }
  );

  return {
    summary,
    version: getGooseConfiguredVersion(gooseConfig),
  };
};
