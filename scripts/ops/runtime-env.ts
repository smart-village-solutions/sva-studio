import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getRuntimeProfileDefinition,
  getRuntimeProfileRequiredEnvKeys,
  type RuntimeProfile,
  validateRuntimeProfileEnv,
} from '../../packages/sdk/src/runtime-profile.ts';
import {
  CRITICAL_IAM_SCHEMA_GUARD_SQL,
  evaluateCriticalIamSchemaGuard,
  summarizeSchemaGuardFailures,
  type SchemaGuardReport,
} from '../../packages/auth/src/iam-account-management/schema-guard.ts';
import {
  buildAcceptanceReportPaths,
  formatAcceptanceDeployReportMarkdown,
  parseRuntimeCliOptions,
  resolveAcceptanceDeployOptions,
  type AcceptanceDeployOptions,
  type AcceptanceDeployReport,
  type AcceptanceDeployStep,
  type AcceptanceFailureCategory,
  type AcceptanceProbeResult,
  type AcceptanceReleaseManifest,
} from './runtime-env.shared.ts';

type RuntimeCommand = 'deploy' | 'doctor' | 'down' | 'migrate' | 'precheck' | 'reset' | 'smoke' | 'status' | 'up' | 'update';
type DoctorCheckStatus = 'error' | 'ok' | 'skipped' | 'warn';

type DoctorCheck = {
  code: string;
  details?: Readonly<Record<string, unknown>>;
  message: string;
  name: string;
  status: DoctorCheckStatus;
};

type DoctorReport = {
  checks: readonly DoctorCheck[];
  generatedAt: string;
  profile: RuntimeProfile;
  status: 'error' | 'ok' | 'warn';
};

type LocalState = {
  logFile: string;
  pid: number;
  profile: RuntimeProfile;
  startedAt: string;
};

const [, , rawCommand, rawProfile, ...rawOptions] = process.argv;

const command = rawCommand as RuntimeCommand | undefined;
const profile = rawProfile as RuntimeProfile | undefined;
const cliOptions = parseRuntimeCliOptions(rawOptions);
const jsonOutput = cliOptions.jsonOutput;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeArtifactsDir = resolve(rootDir, 'artifacts/runtime');
const localStateFile = resolve(runtimeArtifactsDir, 'local-app-state.json');
const appLogDir = resolve(runtimeArtifactsDir, 'logs');
const deployReportDir = resolve(runtimeArtifactsDir, 'deployments');

const composeBaseArgs = ['compose', '-f', 'docker-compose.yml'];
const composeWithMonitoringArgs = ['compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.monitoring.yml'];
const localProfiles: readonly RuntimeProfile[] = ['local-keycloak', 'local-builder'];

const usage = () => {
  console.error(
    'Usage: tsx scripts/ops/runtime-env.ts <up|down|update|status|smoke|migrate|doctor|reset|precheck|deploy> <profile> [--json] [--local-override-file=<path>] [--release-mode=<app-only|schema-and-app>] [--image-digest=<sha256:...>] [--maintenance-window=<text>] [--rollback-hint=<text>]'
  );
  process.exit(2);
};

const ensureKnownCommand = (value: RuntimeCommand | undefined): RuntimeCommand => {
  if (
    !value ||
    !['up', 'down', 'update', 'status', 'smoke', 'migrate', 'doctor', 'reset', 'precheck', 'deploy'].includes(value)
  ) {
    usage();
    throw new Error('Unreachable');
  }

  return value as RuntimeCommand;
};

const ensureKnownProfile = (value: RuntimeProfile | undefined): RuntimeProfile => {
  if (!value || !['local-keycloak', 'local-builder', 'acceptance-hb'].includes(value)) {
    usage();
    throw new Error('Unreachable');
  }

  return value as RuntimeProfile;
};

const shellEscape = (value: string) => {
  if (/^[A-Za-z0-9_./:=,@+-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\"'\"'")}'`;
};

const getGitCommitSha = () => {
  try {
    return runCapture('git', ['rev-parse', 'HEAD']);
  } catch {
    return undefined;
  }
};

const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;

const sqlIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const parseVarsFile = (filePath: string): Record<string, string> => {
  const parsed: Record<string, string> = {};
  const content = readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    parsed[key] = value;
  }

  return parsed;
};

const buildProfileEnv = (runtimeProfile: RuntimeProfile): NodeJS.ProcessEnv => {
  const baseEnvPath = resolve(rootDir, 'config/runtime/base.vars');
  const profileEnvPath = resolve(rootDir, `config/runtime/${runtimeProfile}.vars`);
  const localOverridePath = cliOptions.localOverrideFile
    ? resolve(rootDir, cliOptions.localOverrideFile)
    : resolve(rootDir, `config/runtime/${runtimeProfile}.local.vars`);
  const env = {
    ...process.env,
    ...parseVarsFile(baseEnvPath),
    ...parseVarsFile(profileEnvPath),
    ...(existsSync(localOverridePath) ? parseVarsFile(localOverridePath) : {}),
  };

  env.SVA_RUNTIME_PROFILE = runtimeProfile;
  env.VITE_SVA_RUNTIME_PROFILE = runtimeProfile;

  if (runtimeProfile === 'local-builder') {
    env.SVA_MOCK_AUTH = 'true';
    env.VITE_MOCK_AUTH = 'true';
    env.BUILDER_DEV_AUTH = 'true';
  }

  env.SVA_MAINSERVER_DEV_GRAPHQL_URL = env.SVA_MAINSERVER_GRAPHQL_URL;
  env.SVA_MAINSERVER_DEV_OAUTH_TOKEN_URL = env.SVA_MAINSERVER_OAUTH_TOKEN_URL;
  env.SVA_MAINSERVER_DEV_API_KEY = env.SVA_MAINSERVER_CLIENT_ID;
  env.SVA_MAINSERVER_DEV_API_SECRET = env.SVA_MAINSERVER_CLIENT_SECRET;

  return env;
};

const assertRuntimeEnv = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const validation = validateRuntimeProfileEnv(runtimeProfile, env);
  if (validation.missing.length === 0 && validation.placeholders.length === 0 && validation.invalid.length === 0) {
    return;
  }

  const lines = [
    `Runtime-Profil ${runtimeProfile} ist nicht vollstaendig konfiguriert.`,
    validation.invalid.length > 0 ? `Ungueltig: ${validation.invalid.join(', ')}` : null,
    validation.missing.length > 0 ? `Fehlend: ${validation.missing.join(', ')}` : null,
    validation.placeholders.length > 0 ? `Platzhalter: ${validation.placeholders.join(', ')}` : null,
    `Erwartete Variablen: ${getRuntimeProfileRequiredEnvKeys(runtimeProfile).join(', ')}`,
    `Optionaler Override: config/runtime/${runtimeProfile}.local.vars`,
  ].filter((entry): entry is string => entry !== null);

  throw new Error(lines.join('\n'));
};

const run = (commandName: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env) => {
  const result = spawnSync(commandName, args, {
    cwd: rootDir,
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`${commandName} ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }
};

const runCapture = (commandName: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env) => {
  const result = spawnSync(commandName, args, {
    cwd: rootDir,
    env,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${commandName} ${args.join(' ')} failed`);
  }

  return result.stdout.trim();
};

const runCaptureDetailed = (commandName: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env) =>
  spawnSync(commandName, args, {
    cwd: rootDir,
    env,
    encoding: 'utf8',
  });

const commandExists = (commandName: string) =>
  spawnSync(commandName, ['--help'], {
    cwd: rootDir,
    stdio: 'ignore',
  }).status === 0;

const wait = (ms: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const stripControlArtifacts = (value: string) => value.replaceAll('\u0000', '');

const stripAnsiArtifacts = (value: string) => {
  const escapeChar = String.fromCharCode(27);
  return value.replace(new RegExp(`${escapeChar}\\[[0-9;?]*[ -/]*[@-~]`, 'gu'), '');
};

const stripCaretControlArtifacts = (value: string) => value.replaceAll('^@', '');

const sanitizeProcessOutput = (value: string) =>
  stripCaretControlArtifacts(stripAnsiArtifacts(stripControlArtifacts(value)));

const filterRemoteOutputLines = (value: string) =>
  sanitizeProcessOutput(value)
    .replace(/\ntime=.*level=/gu, '\ntime=')
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => !/^time=.*level=/u.test(entry))
    .filter((entry) => entry !== 'standard input')
    .filter((entry) => !/^~+$/u.test(entry));

const summarizeProcessOutput = (value: string, maxLines = 40) => {
  const lines = filterRemoteOutputLines(value);

  return lines.slice(-maxLines).join('\n');
};

const withoutDebugEnv = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const sanitized = { ...env };
  delete sanitized.DEBUG;
  return sanitized;
};

const parseMarkedOutput = (output: string, marker: string) => {
  const cleaned = sanitizeProcessOutput(output);
  const startMarker = `${marker}_START`;
  const endMarker = `${marker}_END`;
  const startIndex = cleaned.lastIndexOf(startMarker);
  const endIndex = startIndex === -1 ? -1 : cleaned.indexOf(endMarker, startIndex + startMarker.length);

  if (startIndex === -1) {
    throw new Error(`Markierte Ausgabe ${marker} nicht gefunden.`);
  }

  const segment = cleaned.slice(startIndex + startMarker.length, endIndex === -1 ? undefined : endIndex);
  const lines = filterRemoteOutputLines(segment.replace(/^\n+/u, '').trimStart()).filter(
    (entry) => entry !== startMarker && entry !== endMarker,
  );
  if (lines.length > 0) {
    return lines.join('\n');
  }

  const boolMatrixMatches = Array.from(segment.matchAll(/(?:t|f)(?:\|(?:t|f)){3,}/gu)).map((match) => match[0]);
  if (boolMatrixMatches.length > 0) {
    return boolMatrixMatches.at(-1) ?? boolMatrixMatches[0];
  }

  const statusMatches = Array.from(segment.matchAll(/\b(?:ok|applied:[^\s]+)\b/gu)).map((match) => match[0]);
  if (statusMatches.length > 0) {
    return statusMatches.join('\n');
  }

  throw new Error(`Markierte Ausgabe ${marker} enthält keine auswertbaren Daten.`);
};

const runQuantumExec = (
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  options?: {
    marker?: string;
    failureMessage: string;
  }
) => {
  const result = runCaptureDetailed('quantum-cli', args, withoutDebugEnv(env));
  const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

  if (result.status === 0 && options?.marker) {
    try {
      return parseMarkedOutput(combined, options.marker);
    } catch {
      // Fall through to status/output handling below when no valid marker was emitted.
    }
  }

  if (result.status !== 0) {
    throw new Error(summarizeProcessOutput(combined) || options?.failureMessage || 'quantum-cli exec fehlgeschlagen.');
  }

  return summarizeProcessOutput(combined);
};

const toDoctorCheck = (
  name: string,
  status: DoctorCheckStatus,
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>
): DoctorCheck => ({
  name,
  status,
  code,
  message,
  ...(details ? { details } : {}),
});

const printDoctorReport = (report: DoctorReport) => {
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Diagnose fuer ${report.profile}: ${report.status}`);
  for (const check of report.checks) {
    console.log(`[${check.status.toUpperCase()}] ${check.name}: ${check.message}`);
    if (check.details && Object.keys(check.details).length > 0) {
      console.log(`  ${JSON.stringify(check.details)}`);
    }
  }
};

const finalizeDoctorReport = (runtimeProfile: RuntimeProfile, checks: readonly DoctorCheck[]): DoctorReport => {
  const overallStatus = checks.some((check) => check.status === 'error')
    ? 'error'
    : checks.some((check) => check.status === 'warn')
      ? 'warn'
      : 'ok';

  return {
    profile: runtimeProfile,
    status: overallStatus,
    generatedAt: new Date().toISOString(),
    checks,
  };
};

const applyCliOptionEnvOverrides = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const nextEnv = { ...env };

  if (cliOptions.imageTag) {
    nextEnv.SVA_IMAGE_TAG = cliOptions.imageTag;
  }

  if (cliOptions.imageDigest) {
    nextEnv.SVA_IMAGE_DIGEST = cliOptions.imageDigest;
    const registry = nextEnv.SVA_REGISTRY?.trim() || 'ghcr.io/smart-village-solutions';
    const repository = nextEnv.SVA_IMAGE_REPOSITORY?.trim() || 'sva-studio';
    nextEnv.SVA_IMAGE_REF = `${registry}/${repository}@${cliOptions.imageDigest}`;
  }

  if (cliOptions.releaseMode) {
    nextEnv.SVA_ACCEPTANCE_RELEASE_MODE = cliOptions.releaseMode;
  }

  if (cliOptions.maintenanceWindow) {
    nextEnv.SVA_ACCEPTANCE_MAINTENANCE_WINDOW = cliOptions.maintenanceWindow;
  }

  if (cliOptions.rollbackHint) {
    nextEnv.SVA_ACCEPTANCE_ROLLBACK_HINT = cliOptions.rollbackHint;
  }

  if (cliOptions.actor) {
    nextEnv.SVA_ACCEPTANCE_DEPLOY_ACTOR = cliOptions.actor;
  }

  if (cliOptions.workflow) {
    nextEnv.SVA_ACCEPTANCE_DEPLOY_WORKFLOW = cliOptions.workflow;
  }

  if (cliOptions.reportSlug) {
    nextEnv.SVA_ACCEPTANCE_REPORT_SLUG = cliOptions.reportSlug;
  }

  if (cliOptions.grafanaUrl) {
    nextEnv.SVA_GRAFANA_URL = cliOptions.grafanaUrl;
  }

  if (cliOptions.lokiUrl) {
    nextEnv.SVA_LOKI_URL = cliOptions.lokiUrl;
  }

  return nextEnv;
};

const createStepResult = (
  name: AcceptanceDeployStep['name'],
  startedAt: number,
  status: AcceptanceDeployStep['status'],
  summary: string,
  details?: Readonly<Record<string, unknown>>
): AcceptanceDeployStep => ({
  name,
  status,
  summary,
  startedAt: new Date(startedAt).toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: Date.now() - startedAt,
  ...(details ? { details } : {}),
});

const printJsonIfRequested = (payload: unknown) => {
  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
  }
};

const ensureDirs = () => {
  mkdirSync(runtimeArtifactsDir, { recursive: true });
  mkdirSync(appLogDir, { recursive: true });
  mkdirSync(deployReportDir, { recursive: true });
};

const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const readLocalState = (): LocalState | null => {
  if (!existsSync(localStateFile)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(localStateFile, 'utf8')) as LocalState;
    return typeof parsed.pid === 'number' ? parsed : null;
  } catch {
    return null;
  }
};

const clearLocalState = () => {
  if (existsSync(localStateFile)) {
    unlinkSync(localStateFile);
  }
};

const stopKnownLocalDevServers = () => {
  const patterns = [
    'pnpm nx run sva-studio-react:serve',
    'vite.js dev --port 3000',
  ] as const;

  for (const pattern of patterns) {
    spawnSync('pkill', ['-f', pattern], {
      cwd: rootDir,
      stdio: 'ignore',
    });
  }
};

const stopLocalApp = () => {
  const state = readLocalState();
  if (!state) {
    stopKnownLocalDevServers();
    return;
  }

  if (!isProcessAlive(state.pid)) {
    clearLocalState();
    return;
  }

  try {
    process.kill(-state.pid, 'SIGTERM');
  } catch {
    try {
      process.kill(state.pid, 'SIGTERM');
    } catch {
      // Ignore stale process state.
    }
  }

  clearLocalState();
  stopKnownLocalDevServers();
};

const startLocalApp = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  ensureDirs();

  const existing = readLocalState();
  if (existing && isProcessAlive(existing.pid) && existing.profile !== runtimeProfile) {
    throw new Error(
      `Lokale App laeuft bereits mit Profil ${existing.profile}. Erst env:down:${existing.profile} ausfuehren.`,
    );
  }

  if (existing && isProcessAlive(existing.pid) && existing.profile === runtimeProfile) {
    console.log(`Lokale App fuer ${runtimeProfile} laeuft bereits (PID ${existing.pid}).`);
    return;
  }

  const logFile = resolve(appLogDir, `${runtimeProfile}.log`);
  const logFd = openSync(logFile, 'a');

  const child = spawn('pnpm', ['nx', 'run', 'sva-studio-react:serve'], {
    cwd: rootDir,
    env,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });

  if (child.pid === undefined) {
    throw new Error(`Dev-Server fuer ${runtimeProfile} konnte nicht gestartet werden.`);
  }

  child.unref();

  writeFileSync(
    localStateFile,
    `${JSON.stringify(
      {
        pid: child.pid,
        profile: runtimeProfile,
        startedAt: new Date().toISOString(),
        logFile,
      } satisfies LocalState,
      null,
      2,
    )}\n`,
    'utf8',
  );

  await waitForHttpOk(new URL('/health/live', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString(), 60_000);
};

const waitForHttpOk = async (url: string, timeoutMs: number) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling.
    }

    await wait(1_000);
  }

  throw new Error(`Timeout waiting for ${url}`);
};

const getComposeArgs = (env: NodeJS.ProcessEnv) =>
  env.SVA_ENABLE_MONITORING === 'false' ? composeBaseArgs : composeWithMonitoringArgs;

const upLocalInfra = (env: NodeJS.ProcessEnv) => {
  run('docker', [...getComposeArgs(env), 'up', '-d'], env);
};

const bootstrapLocalAppUser = (env: NodeJS.ProcessEnv) => {
  run('pnpm', ['nx', 'run', 'data:db:bootstrap-app-user'], env);
};

const downLocalInfra = (env: NodeJS.ProcessEnv) => {
  run('docker', [...composeWithMonitoringArgs, 'down'], env);
};

const pullLocalInfra = (env: NodeJS.ProcessEnv) => {
  run('docker', [...getComposeArgs(env), 'pull'], env);
};

const checkHttpHealth = async (url: string) => {
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

const createDbSqlRunner = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const postgresUser = env.POSTGRES_USER ?? 'sva';
  const postgresDb = env.POSTGRES_DB ?? 'sva_studio';
  const localPostgresContainerName = env.SVA_LOCAL_POSTGRES_CONTAINER_NAME?.trim() || 'sva-studio-postgres';

  const runLocalSql = (sql: string) => {
    const localContainerId = runCaptureDetailed(
      'docker',
      ['ps', '--filter', `name=^/${localPostgresContainerName}$`, '--format', '{{.ID}}'],
      env
    ).stdout.trim();

    if (localContainerId.length === 0) {
      throw new Error(`Lokaler Postgres-Container ${localPostgresContainerName} nicht gefunden.`);
    }

    const result = spawnSync(
      'docker',
      ['exec', '-i', localContainerId, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', postgresUser, '-d', postgresDb, '-At', '-f', '-'],
      {
        cwd: rootDir,
        env,
        encoding: 'utf8',
        input: sql,
      }
    );

    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || result.stdout.trim() || 'SQL-Abfrage gegen lokalen Postgres fehlgeschlagen.');
    }

    return result.stdout.trim();
  };

  const runAcceptanceSql = (sql: string) => {
    if (!commandExists('quantum-cli')) {
      throw new Error('quantum-cli ist fuer den Acceptance-DB-Check nicht verfuegbar.');
    }

    const stackName = env.SVA_STACK_NAME ?? 'sva-studio';
    const quantumEndpoint = env.QUANTUM_ENDPOINT ?? env.PORTAINER_ENDPOINT ?? 'sva';
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

    const output = runQuantumExec(
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
      }
    );

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

  return (sql: string) => (runtimeProfile === 'acceptance-hb' ? runAcceptanceSql(sql) : runLocalSql(sql));
};

const runSchemaGuard = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): SchemaGuardReport => {
  const runSql = createDbSqlRunner(runtimeProfile, env);
  const output = runSql(`${CRITICAL_IAM_SCHEMA_GUARD_SQL}`);
  const matches = Array.from(output.matchAll(/(?:t|f)(?:\|(?:t|f)){13}/gu)).map((match) => match[0]);
  const line = matches.at(-1);
  if (!line) {
    throw new Error(`Schema-Guard-Ausgabe konnte nicht als Bool-Matrix gelesen werden: ${output}`);
  }
  const row = Object.fromEntries(
    line.split('|').map((value, index) => {
      const keys = [
        'groups_exists',
        'group_roles_exists',
        'account_groups_exists',
        'activity_logs_exists',
        'accounts_instance_id_column_exists',
        'accounts_username_ciphertext_column_exists',
        'accounts_avatar_url_column_exists',
        'accounts_preferred_language_column_exists',
        'accounts_timezone_column_exists',
        'accounts_notes_column_exists',
        'account_groups_origin_column_exists',
        'idx_accounts_kc_subject_instance_exists',
        'accounts_isolation_policy_matches',
        'instance_memberships_isolation_policy_matches',
      ] as const;
      return [keys[index], value];
    })
  );
  return evaluateCriticalIamSchemaGuard(row);
};

const recoverSchemaGuardReportFromOutput = (value: string): SchemaGuardReport | null => {
  const matches = Array.from(value.matchAll(/(?:t|f)(?:\|(?:t|f)){13}/gu)).map((match) => match[0]);
  const line = matches.at(-1);
  if (!line) {
    return null;
  }

  const keys = [
    'groups_exists',
    'group_roles_exists',
    'account_groups_exists',
    'activity_logs_exists',
    'accounts_instance_id_column_exists',
    'accounts_username_ciphertext_column_exists',
    'accounts_avatar_url_column_exists',
    'accounts_preferred_language_column_exists',
    'accounts_timezone_column_exists',
    'accounts_notes_column_exists',
    'account_groups_origin_column_exists',
    'idx_accounts_kc_subject_instance_exists',
    'accounts_isolation_policy_matches',
    'instance_memberships_isolation_policy_matches',
  ] as const;
  const row = Object.fromEntries(line.split('|').map((entry, index) => [keys[index], entry]));
  return evaluateCriticalIamSchemaGuard(row);
};

const buildSchemaGuardCheck = (
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv
): DoctorCheck => {
  try {
    const report = runSchemaGuard(runtimeProfile, env);
    if (report.ok) {
      return toDoctorCheck('schema-guard', 'ok', 'schema_ok', 'Kritische IAM-Schema-Artefakte sind vorhanden.', {
        checks: report.checks,
      });
    }

    return toDoctorCheck(
      'schema-guard',
      'error',
      'schema_drift',
      summarizeSchemaGuardFailures(report) ?? 'Kritische IAM-Schema-Artefakte fehlen oder weichen ab.',
      {
        checks: report.checks,
      }
    );
  } catch (error) {
    const recovered = recoverSchemaGuardReportFromOutput(error instanceof Error ? error.message : String(error));
    if (recovered) {
      if (recovered.ok) {
        return toDoctorCheck('schema-guard', 'ok', 'schema_ok', 'Kritische IAM-Schema-Artefakte sind vorhanden.', {
          checks: recovered.checks,
          recoveredFromTransportNoise: true,
        });
      }

      return toDoctorCheck(
        'schema-guard',
        'error',
        'schema_drift',
        summarizeSchemaGuardFailures(recovered) ?? 'Kritische IAM-Schema-Artefakte fehlen oder weichen ab.',
        {
          checks: recovered.checks,
          recoveredFromTransportNoise: true,
        }
      );
    }

    return toDoctorCheck(
      'schema-guard',
      'error',
      'schema_check_failed',
      error instanceof Error ? error.message : String(error)
    );
  }
};

const buildActorDoctorCheck = (
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv
): DoctorCheck => {
  const keycloakSubject = env.SVA_DOCTOR_KEYCLOAK_SUBJECT?.trim();
  const instanceId = env.SVA_DOCTOR_INSTANCE_ID?.trim() || env.SVA_ALLOWED_INSTANCE_IDS?.split(',')[0]?.trim();
  const sessionRoles = (env.SVA_DOCTOR_SESSION_ROLES ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (!keycloakSubject || !instanceId) {
    return toDoctorCheck(
      'actor-diagnosis',
      'skipped',
      'actor_context_missing',
      'Kein konkreter Actor-Kontext gesetzt. Fuer tiefe Actor-Diagnose SVA_DOCTOR_KEYCLOAK_SUBJECT und optional SVA_DOCTOR_INSTANCE_ID setzen.'
    );
  }

  const sql = `
SELECT json_build_object(
  'keycloak_subject', ${sqlLiteral(keycloakSubject)},
  'instance_id', ${sqlLiteral(instanceId)},
  'account_exists', EXISTS(
    SELECT 1 FROM iam.accounts WHERE keycloak_subject = ${sqlLiteral(keycloakSubject)}
  ),
  'instance_account_exists', EXISTS(
    SELECT 1 FROM iam.accounts WHERE keycloak_subject = ${sqlLiteral(keycloakSubject)} AND instance_id = ${sqlLiteral(instanceId)}
  ),
  'membership_exists', EXISTS(
    SELECT 1
    FROM iam.accounts a
    JOIN iam.instance_memberships im
      ON im.account_id = a.id
     AND im.instance_id = ${sqlLiteral(instanceId)}
    WHERE a.keycloak_subject = ${sqlLiteral(keycloakSubject)}
  ),
  'persisted_role_keys', COALESCE((
    SELECT json_agg(DISTINCT r.role_key ORDER BY r.role_key)
    FROM iam.accounts a
    JOIN iam.instance_memberships im
      ON im.account_id = a.id
     AND im.instance_id = ${sqlLiteral(instanceId)}
    JOIN iam.account_roles ar
      ON ar.instance_id = im.instance_id
     AND ar.account_id = im.account_id
     AND ar.valid_from <= NOW()
     AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
    JOIN iam.roles r
      ON r.instance_id = ar.instance_id
     AND r.id = ar.role_id
    WHERE a.keycloak_subject = ${sqlLiteral(keycloakSubject)}
  ), '[]'::json)
)::text;
`;

  try {
    const output = createDbSqlRunner(runtimeProfile, env)(sql);
    const payload = JSON.parse(output.split(/\r?\n/u).filter((entry) => entry.trim().length > 0).slice(-1)[0] ?? '{}') as {
      account_exists?: boolean;
      instance_account_exists?: boolean;
      membership_exists?: boolean;
      persisted_role_keys?: string[];
    };

    if (!payload.account_exists) {
      return toDoctorCheck('actor-diagnosis', 'error', 'missing_actor_account', 'Kein IAM-Account fuer den Actor gefunden.', {
        instanceId,
        keycloakSubject,
        persistedRoles: payload.persisted_role_keys ?? [],
        sessionRoles,
      });
    }

    if (!payload.membership_exists) {
      return toDoctorCheck(
        'actor-diagnosis',
        'error',
        'missing_instance_membership',
        'Der Actor hat keine Instanz-Mitgliedschaft fuer die Zielinstanz.',
        {
          instanceId,
          keycloakSubject,
          persistedRoles: payload.persisted_role_keys ?? [],
          sessionRoles,
        }
      );
    }

    return toDoctorCheck('actor-diagnosis', 'ok', 'actor_resolved', 'Actor-Account und Instanz-Mitgliedschaft sind vorhanden.', {
      instanceId,
      keycloakSubject,
      persistedRoles: payload.persisted_role_keys ?? [],
      sessionRoles,
    });
  } catch (error) {
    return toDoctorCheck(
      'actor-diagnosis',
      'error',
      'actor_diagnosis_failed',
      error instanceof Error ? error.message : String(error),
      {
        instanceId,
        keycloakSubject,
        sessionRoles,
      }
    );
  }
};

const buildFeatureFlagCheck = (env: NodeJS.ProcessEnv) => {
  const details = {
    IAM_UI_ENABLED: env.IAM_UI_ENABLED ?? '',
    IAM_ADMIN_ENABLED: env.IAM_ADMIN_ENABLED ?? '',
    IAM_BULK_ENABLED: env.IAM_BULK_ENABLED ?? '',
    VITE_IAM_UI_ENABLED: env.VITE_IAM_UI_ENABLED ?? '',
    VITE_IAM_ADMIN_ENABLED: env.VITE_IAM_ADMIN_ENABLED ?? '',
    VITE_IAM_BULK_ENABLED: env.VITE_IAM_BULK_ENABLED ?? '',
  };

  const emptyFlags = Object.entries(details).filter(([, value]) => value.trim().length === 0);
  if (emptyFlags.length > 0) {
    return toDoctorCheck('feature-flags', 'warn', 'feature_flags_incomplete', 'Mindestens ein IAM-Feature-Flag ist leer.', {
      flags: details,
    });
  }

  return toDoctorCheck('feature-flags', 'ok', 'feature_flags_present', 'IAM-Feature-Flags sind gesetzt.', {
    flags: details,
  });
};

const buildAcceptanceServiceCheck = (env: NodeJS.ProcessEnv) => {
  if (!commandExists('quantum-cli')) {
    return toDoctorCheck(
      'acceptance-services',
      'skipped',
      'quantum_unavailable',
      'quantum-cli ist lokal nicht verfuegbar; Remote-Service-Status wird uebersprungen.'
    );
  }

  try {
    const stackName = env.SVA_STACK_NAME ?? 'sva-studio';
    const quantumEndpoint = env.QUANTUM_ENDPOINT ?? env.PORTAINER_ENDPOINT ?? 'sva';
    const output = runCapture('quantum-cli', ['ps', '--endpoint', quantumEndpoint, '--stack', stackName, '--all'], withoutDebugEnv(env));
    return toDoctorCheck('acceptance-services', 'ok', 'remote_services_visible', 'Remote-Service-Status konnte abgefragt werden.', {
      summary: output,
    });
  } catch (error) {
    return toDoctorCheck(
      'acceptance-services',
      'warn',
      'remote_service_status_failed',
      error instanceof Error ? error.message : String(error)
    );
  }
};

const buildAcceptancePostgresCheck = (env: NodeJS.ProcessEnv) => {
  const postgresUser = env.POSTGRES_USER ?? 'sva';
  const postgresDb = env.POSTGRES_DB ?? 'sva_studio';

  try {
    if (commandExists('quantum-cli')) {
      const summary = runAcceptanceServiceScript(
        env,
        env.SVA_ACCEPTANCE_POSTGRES_SERVICE ?? 'postgres',
        `pg_isready -U ${shellEscape(postgresUser)} -d ${shellEscape(postgresDb)}`,
        {
          failureMessage: 'Remote-Postgres-Healthcheck fehlgeschlagen.',
          slot: env.SVA_ACCEPTANCE_POSTGRES_SLOT ?? '1',
        }
      );

      return toDoctorCheck(
        'postgres-health',
        'ok',
        'postgres_ready',
        'Acceptance-Postgres ist ueber den offiziellen Betriebsweg erreichbar.',
        { summary }
      );
    }

    const containerOutput = runCapture('docker', ['ps', '--filter', `name=${env.SVA_STACK_NAME ?? 'sva-studio'}_postgres`, '--format', '{{.Status}}'], env);
    if (!containerOutput.trim()) {
      throw new Error('Weder quantum-cli noch lokaler Postgres-Container verfuegbar.');
    }

    return toDoctorCheck(
      'postgres-health',
      'ok',
      'postgres_visible',
      'Lokaler Acceptance-Postgres-Container ist sichtbar.',
      { summary: containerOutput }
    );
  } catch (error) {
    return toDoctorCheck(
      'postgres-health',
      'error',
      'postgres_unreachable',
      error instanceof Error ? error.message : String(error)
    );
  }
};

const precheckAcceptance = async (
  env: NodeJS.ProcessEnv,
  options?: AcceptanceDeployOptions
): Promise<DoctorReport> => {
  const checks: DoctorCheck[] = [];
  const validation = validateRuntimeProfileEnv('acceptance-hb', env);

  if (validation.missing.length > 0 || validation.placeholders.length > 0 || validation.invalid.length > 0) {
    checks.push(
      toDoctorCheck(
        'runtime-env',
        'error',
        'runtime_env_invalid',
        'Acceptance-Profil ist nicht vollstaendig konfiguriert.',
        {
          invalid: validation.invalid,
          missing: validation.missing,
          placeholders: validation.placeholders,
          requiredKeys: getRuntimeProfileRequiredEnvKeys('acceptance-hb'),
        }
      )
    );
  } else {
    checks.push(
      toDoctorCheck('runtime-env', 'ok', 'runtime_env_valid', 'Acceptance-Profil ist vollstaendig konfiguriert.', {
        requiredKeys: getRuntimeProfileRequiredEnvKeys('acceptance-hb'),
      })
    );
  }

  checks.push(buildAcceptanceServiceCheck(env));
  checks.push(buildAcceptancePostgresCheck(env));
  checks.push(buildSchemaGuardCheck('acceptance-hb', env));
  if (options) {
    checks.push(buildAcceptanceLiveSpecCheck(env, options));
  }

  return finalizeDoctorReport('acceptance-hb', checks);
};

const doctorRuntime = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): Promise<DoctorReport> => {
  const checks: DoctorCheck[] = [];
  const validation = validateRuntimeProfileEnv(runtimeProfile, env);

  if (validation.missing.length > 0 || validation.placeholders.length > 0 || validation.invalid.length > 0) {
    checks.push(
      toDoctorCheck(
        'runtime-env',
        'error',
        'runtime_env_invalid',
        'Runtime-Profil ist nicht vollstaendig konfiguriert.',
        {
          invalid: validation.invalid,
          missing: validation.missing,
          placeholders: validation.placeholders,
          requiredKeys: getRuntimeProfileRequiredEnvKeys(runtimeProfile),
        }
      )
    );
  } else {
    checks.push(
      toDoctorCheck('runtime-env', 'ok', 'runtime_env_valid', 'Runtime-Profil ist vollstaendig konfiguriert.', {
        requiredKeys: getRuntimeProfileRequiredEnvKeys(runtimeProfile),
      })
    );
  }

  const baseUrl = env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';

  try {
    const live = await checkHttpHealth(new URL('/health/live', baseUrl).toString());
    checks.push(
      toDoctorCheck(
        'health-live',
        live.response.ok ? 'ok' : 'error',
        live.response.ok ? 'live_ok' : 'live_failed',
        live.response.ok ? 'Live-Endpoint antwortet erfolgreich.' : `Live-Endpoint antwortet mit ${live.response.status}.`,
        {
          status: live.response.status,
          payload: live.payload as Record<string, unknown>,
        }
      )
    );
  } catch (error) {
    checks.push(toDoctorCheck('health-live', 'error', 'live_unreachable', error instanceof Error ? error.message : String(error)));
  }

  try {
    const ready = await checkHttpHealth(new URL('/health/ready', baseUrl).toString());
    const payload = (ready.payload ?? {}) as Record<string, unknown>;
    checks.push(
      toDoctorCheck(
        'health-ready',
        ready.response.ok ? 'ok' : 'error',
        ready.response.ok ? 'ready_ok' : 'ready_failed',
        ready.response.ok ? 'Readiness ist erfolgreich.' : `Readiness antwortet mit ${ready.response.status}.`,
        {
          status: ready.response.status,
          payload,
        }
      )
    );
  } catch (error) {
    checks.push(toDoctorCheck('health-ready', 'error', 'ready_unreachable', error instanceof Error ? error.message : String(error)));
  }

  try {
    await assertLoginFlow(runtimeProfile, env);
    checks.push(toDoctorCheck('auth-login', 'ok', 'auth_login_ok', 'Login-Verhalten entspricht dem Profil.'));
  } catch (error) {
    checks.push(toDoctorCheck('auth-login', 'error', 'auth_login_failed', error instanceof Error ? error.message : String(error)));
  }

  try {
    await assertMeEndpoint(runtimeProfile, env);
    checks.push(toDoctorCheck('auth-me', 'ok', 'auth_me_ok', '/auth/me entspricht dem Profil.'));
  } catch (error) {
    checks.push(toDoctorCheck('auth-me', 'error', 'auth_me_failed', error instanceof Error ? error.message : String(error)));
  }

  try {
    await assertMainserverSmoke(env);
    checks.push(toDoctorCheck('mainserver', 'ok', 'mainserver_ok', 'Mainserver-OAuth und GraphQL sind erreichbar.'));
  } catch (error) {
    checks.push(toDoctorCheck('mainserver', 'error', 'mainserver_failed', error instanceof Error ? error.message : String(error)));
  }

  if (localProfiles.includes(runtimeProfile)) {
    try {
      await assertOtelLocal(env);
      checks.push(toDoctorCheck('otel', 'ok', 'otel_ok', 'Lokaler OTEL-Collector ist erreichbar.'));
    } catch (error) {
      checks.push(toDoctorCheck('otel', 'error', 'otel_failed', error instanceof Error ? error.message : String(error)));
    }
  } else {
    checks.push(buildAcceptanceServiceCheck(env));
  }

  checks.push(buildFeatureFlagCheck(env));
  checks.push(buildSchemaGuardCheck(runtimeProfile, env));
  checks.push(buildActorDoctorCheck(runtimeProfile, env));

  return finalizeDoctorReport(runtimeProfile, checks);
};

const assertLoginFlow = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const loginUrl = new URL('/auth/login', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString();
  const response = await fetch(loginUrl, { redirect: 'manual' });
  const location = response.headers.get('location') ?? '';

  if (runtimeProfile === 'local-builder') {
    if (location !== '/?auth=mock-login') {
      throw new Error(`Builder-Mock-Login unerwartet: ${location}`);
    }

    return;
  }

  const issuer = env.SVA_AUTH_ISSUER ?? '';
  if (response.status !== 302 || !location.startsWith(issuer)) {
    throw new Error(`OIDC-Login redirect stimmt nicht. Erwartet Prefix ${issuer}, erhalten ${location}`);
  }
};

const assertMeEndpoint = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const meUrl = new URL('/auth/me', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString();
  const response = await fetch(meUrl, { redirect: 'manual' });

  if (runtimeProfile === 'local-builder') {
    if (!response.ok) {
      throw new Error(`/auth/me fuer ${runtimeProfile} antwortet mit ${response.status}`);
    }

    const payload = (await response.json()) as {
      user?: {
        email?: string;
        instanceId?: string;
        name?: string;
      };
    };

    if (payload.user?.name !== (env.SVA_MOCK_AUTH_USER_NAME ?? 'Builder Mock User')) {
      throw new Error(`Mock-User stimmt nicht: ${JSON.stringify(payload)}`);
    }

    return;
  }

  if (response.status !== 401) {
    throw new Error(`/auth/me ohne Session sollte 401 liefern, erhielt ${response.status}`);
  }
};

const assertIamContextEndpoint = async (env: NodeJS.ProcessEnv) => {
  const contextUrl = new URL('/api/v1/iam/me/context', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString();
  const response = await fetch(contextUrl, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  const body = await response.text();

  if ([200, 401, 403].includes(response.status)) {
    if (body.toLowerCase().includes('<html')) {
      throw new Error('/api/v1/iam/me/context lieferte HTML statt einer API-Antwort.');
    }
    return;
  }

  throw new Error(`/api/v1/iam/me/context antwortet unerwartet mit ${response.status}`);
};

const assertMainserverSmoke = async (env: NodeJS.ProcessEnv) => {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.SVA_MAINSERVER_CLIENT_ID ?? '',
    client_secret: env.SVA_MAINSERVER_CLIENT_SECRET ?? '',
  });

  const tokenResponse = await fetch(env.SVA_MAINSERVER_OAUTH_TOKEN_URL ?? '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Mainserver OAuth fehlgeschlagen: ${tokenResponse.status}`);
  }

  const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenPayload.access_token) {
    throw new Error('Mainserver OAuth liefert kein access_token.');
  }

  const graphqlResponse = await fetch(env.SVA_MAINSERVER_GRAPHQL_URL ?? '', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenPayload.access_token}`,
    },
    body: JSON.stringify({ query: '{ __typename }' }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!graphqlResponse.ok) {
    throw new Error(`Mainserver GraphQL fehlgeschlagen: ${graphqlResponse.status}`);
  }

  const graphqlPayload = (await graphqlResponse.json()) as { data?: { __typename?: string }; errors?: unknown[] };
  if (Array.isArray(graphqlPayload.errors) && graphqlPayload.errors.length > 0) {
    throw new Error(`Mainserver GraphQL antwortete mit Fehlern: ${JSON.stringify(graphqlPayload.errors)}`);
  }
};

const assertOtelLocal = async (env: NodeJS.ProcessEnv) => {
  if (env.SVA_ENABLE_MONITORING === 'false') {
    return;
  }

  const healthCandidates = [
    {
      name: 'collector-health',
      url: 'http://127.0.0.1:13133/healthz',
      validate: (response: Response) => {
        if (!response.ok) {
          throw new Error(`OTEL Collector Healthcheck fehlgeschlagen: ${response.status}`);
        }
      },
    },
    {
      name: 'otlp-endpoint',
      url: env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://127.0.0.1:4318',
      validate: (response: Response) => {
        if (response.status >= 500) {
          throw new Error(`OTEL Endpoint antwortet mit ${response.status}`);
        }
      },
    },
  ] as const;

  let lastError: unknown = new Error('OTEL Collector nicht erreichbar.');
  for (const candidate of healthCandidates) {
    try {
      const response = await fetch(candidate.url, { signal: AbortSignal.timeout(5_000) });
      candidate.validate(response);
      return;
    } catch (error) {
      lastError = new Error(
        `${candidate.name} fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  throw lastError;
};

const assertAcceptanceContainerHealth = (env: NodeJS.ProcessEnv) => {
  const stackName = env.SVA_STACK_NAME ?? 'sva-studio';
  const services = ['app', 'redis', 'postgres', 'otel-collector'];

  if (commandExists('quantum-cli')) {
    const quantumEndpoint = env.QUANTUM_ENDPOINT ?? env.PORTAINER_ENDPOINT ?? 'sva';
    const summary = runCapture('quantum-cli', ['ps', '--endpoint', quantumEndpoint, '--stack', stackName, '--all'], withoutDebugEnv(env));
    for (const service of services) {
      if (!summary.includes(service)) {
        throw new Error(`Remote-Service fuer ${service} nicht gefunden.`);
      }
    }
    return;
  }

  for (const service of services) {
    const output = runCapture('docker', ['ps', '--filter', `name=${stackName}_${service}`, '--format', '{{.Status}}']);
    if (output.length === 0) {
      throw new Error(`Container fuer ${service} nicht gefunden.`);
    }
  }
};

const smokeRuntime = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  assertRuntimeEnv(runtimeProfile, env);

  const live = await checkHttpHealth(new URL('/health/live', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString());
  if (!live.response.ok) {
    throw new Error(`Live-Healthcheck fehlgeschlagen: ${live.response.status}`);
  }

  const ready = await checkHttpHealth(new URL('/health/ready', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString());
  if (!ready.response.ok) {
    throw new Error(`Ready-Healthcheck fehlgeschlagen: ${ready.response.status} ${JSON.stringify(ready.payload)}`);
  }

  await assertLoginFlow(runtimeProfile, env);
  await assertMeEndpoint(runtimeProfile, env);
  await assertIamContextEndpoint(env);
  await assertMainserverSmoke(env);

  if (localProfiles.includes(runtimeProfile)) {
    await assertOtelLocal(env);
  } else {
    assertAcceptanceContainerHealth(env);
  }

  const schemaGuard = runSchemaGuard(runtimeProfile, env);
  if (!schemaGuard.ok) {
    throw new Error(`Kritische IAM-Schema-Drift erkannt: ${summarizeSchemaGuardFailures(schemaGuard)}`);
  }
};

const runLocalCommand = async (runtimeProfile: RuntimeProfile, runtimeCommand: RuntimeCommand) => {
  const env = buildProfileEnv(runtimeProfile);

  switch (runtimeCommand) {
    case 'up':
      assertRuntimeEnv(runtimeProfile, env);
      upLocalInfra(env);
      bootstrapLocalAppUser(env);
      await startLocalApp(runtimeProfile, env);
      console.log(`Profil ${runtimeProfile} gestartet.`);
      return;
    case 'down':
      stopLocalApp();
      downLocalInfra(env);
      console.log(`Profil ${runtimeProfile} gestoppt.`);
      return;
    case 'update':
      assertRuntimeEnv(runtimeProfile, env);
      pullLocalInfra(env);
      upLocalInfra(env);
      bootstrapLocalAppUser(env);
      stopLocalApp();
      await startLocalApp(runtimeProfile, env);
      console.log(`Profil ${runtimeProfile} aktualisiert.`);
      return;
    case 'status': {
      const state = readLocalState();
      console.log(JSON.stringify({ app: state, profile: runtimeProfile }, null, 2));
      run('docker', [...getComposeArgs(env), 'ps'], env);
      return;
    }
    case 'smoke':
      await smokeRuntime(runtimeProfile, env);
      console.log(`Smoke-Checks fuer ${runtimeProfile} erfolgreich.`);
      return;
    case 'migrate':
      assertRuntimeEnv(runtimeProfile, env);
      run('pnpm', ['nx', 'run', 'data:db:migrate'], env);
      bootstrapLocalAppUser(env);
      {
        const schemaGuard = runSchemaGuard(runtimeProfile, env);
        if (!schemaGuard.ok) {
          throw new Error(`Kritische IAM-Schema-Drift nach Migration: ${summarizeSchemaGuardFailures(schemaGuard)}`);
        }
      }
      console.log(`Migrationen fuer ${runtimeProfile} abgeschlossen.`);
      return;
    case 'doctor': {
      const report = await doctorRuntime(runtimeProfile, env);
      printDoctorReport(report);
      if (report.status === 'error') {
        process.exitCode = 1;
      }
      return;
    }
  }
};

const migrateAcceptance = (env: NodeJS.ProcessEnv) => {
  const stackName = env.SVA_STACK_NAME ?? 'sva-studio';
  const postgresUser = env.POSTGRES_USER ?? 'sva';
  const postgresDb = env.POSTGRES_DB ?? 'sva_studio';
  const quantumEndpoint = env.QUANTUM_ENDPOINT ?? env.PORTAINER_ENDPOINT ?? 'sva';
  const quantumService = env.SVA_ACCEPTANCE_POSTGRES_SERVICE ?? 'postgres';
  const quantumSlot = env.SVA_ACCEPTANCE_POSTGRES_SLOT ?? '1';
  const migrationFiles = runCapture('sh', ['-lc', 'printf "%s\n" packages/data/migrations/up/*.sql'])
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (migrationFiles.length === 0) {
    throw new Error('Keine SQL-Up-Migrationen in packages/data/migrations/up gefunden.');
  }

  const localContainerId = runCapture('docker', ['ps', '--filter', `name=${stackName}_postgres`, '--format', '{{.ID}}'], env);
  if (localContainerId.length > 0) {
    const escapedRoot = shellEscape(rootDir);
    const command =
      `cd ${escapedRoot} && ` +
      `for f in packages/data/migrations/up/*.sql; do ` +
      `echo "Applying $f"; ` +
      `docker exec ${shellEscape(localContainerId)} psql -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(postgresDb)} -f "$f"; ` +
      'done';

    run('sh', ['-lc', command], env);
    return;
  }

  if (!commandExists('quantum-cli')) {
    throw new Error(
      `Postgres-Container fuer Stack ${stackName} lokal nicht gefunden und quantum-cli ist nicht verfuegbar.`,
    );
  }

  for (const migrationFile of migrationFiles) {
    const sql = readFileSync(resolve(rootDir, migrationFile), 'utf8');
    const remoteScript = [
      'set -euo pipefail',
      `cat <<'SQL' >/tmp/sva-runtime-migration.sql`,
      sql,
      'SQL',
      `psql -X -P pager=off -q -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(postgresDb)} -f /tmp/sva-runtime-migration.sql >/tmp/sva-runtime-migration.log 2>&1`,
      'rm -f /tmp/sva-runtime-migration.sql',
    ].join('\n');

    const marker = '__SVA_MIGRATION_STATUS__';
    const markedRemoteScript = [
      remoteScript,
      `printf '%s\\n' '${marker}_START'`,
      `printf '%s\\n' 'applied:${migrationFile}'`,
      `printf '%s\\n' '${marker}_END'`,
      'sleep 1',
    ].join('\n');

    const summary = runQuantumExec(
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
        `sh -lc ${shellEscape(markedRemoteScript)}`,
      ],
      env,
      {
        marker,
        failureMessage: `Remote-Migration ${migrationFile} fehlgeschlagen.`,
      }
    );

    console.log(`Applying migration remotely via quantum-cli: ${migrationFile}`);
    console.log(summary);
  }

  const schemaGuard = runSchemaGuard('acceptance-hb', env);
  if (!schemaGuard.ok) {
    throw new Error(`Kritische IAM-Schema-Drift nach Acceptance-Migration: ${summarizeSchemaGuardFailures(schemaGuard)}`);
  }
};

const runAcceptanceServiceScript = (
  env: NodeJS.ProcessEnv,
  service: string,
  script: string,
  options: {
    failureMessage: string;
    marker?: string;
    slot?: string;
  }
) => {
  if (!commandExists('quantum-cli')) {
    throw new Error('quantum-cli ist fuer Acceptance-Operationen nicht verfuegbar.');
  }

  const stackName = env.SVA_STACK_NAME ?? 'sva-studio';
  const quantumEndpoint = env.QUANTUM_ENDPOINT ?? env.PORTAINER_ENDPOINT ?? 'sva';

  return runQuantumExec(
    [
      'exec',
      '--endpoint',
      quantumEndpoint,
      '--stack',
      stackName,
      '--service',
      service,
      '--slot',
      options.slot ?? '1',
      '-c',
      `sh -lc ${shellEscape(script)}`,
    ],
    env,
    {
      marker: options.marker,
      failureMessage: options.failureMessage,
    }
  );
};

const runAcceptanceSqlAgainstDatabase = (
  env: NodeJS.ProcessEnv,
  sql: string,
  database: string,
  failureMessage: string
) => {
  const postgresUser = env.POSTGRES_USER ?? 'sva';
  const marker = '__SVA_RESET_STATUS__';
  const remoteScript = [
    'set -euo pipefail',
    "cat <<'SQL' >/tmp/sva-runtime-reset.sql",
    sql,
    'SQL',
    `psql -X -P pager=off -q -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(database)} -f /tmp/sva-runtime-reset.sql >/tmp/sva-runtime-reset.log 2>&1`,
    'rm -f /tmp/sva-runtime-reset.sql /tmp/sva-runtime-reset.log',
    `printf '%s\\n' '${marker}_START'`,
    "printf '%s\\n' 'ok'",
    `printf '%s\\n' '${marker}_END'`,
    'sleep 1',
  ].join('\n');

  return runAcceptanceServiceScript(env, env.SVA_ACCEPTANCE_POSTGRES_SERVICE ?? 'postgres', remoteScript, {
    marker,
    slot: env.SVA_ACCEPTANCE_POSTGRES_SLOT ?? '1',
    failureMessage,
  });
};

const bootstrapAcceptanceAppUser = (env: NodeJS.ProcessEnv) => {
  const appDbUser = env.APP_DB_USER?.trim() || 'sva_app';
  const appDbPassword = env.APP_DB_PASSWORD?.trim();

  if (!appDbPassword) {
    throw new Error('APP_DB_PASSWORD fehlt fuer den Acceptance-Reset.');
  }

  const sql = `
DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(appDbUser)}) THEN
    EXECUTE format(
      'CREATE ROLE ${sqlIdentifier(appDbUser)} LOGIN PASSWORD ${sqlLiteral(appDbPassword)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
    );
  ELSE
    EXECUTE format(
      'ALTER ROLE ${sqlIdentifier(appDbUser)} WITH LOGIN PASSWORD ${sqlLiteral(appDbPassword)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
    );
  END IF;
END
$bootstrap$;

GRANT iam_app TO ${sqlIdentifier(appDbUser)};
GRANT USAGE ON SCHEMA iam TO ${sqlIdentifier(appDbUser)};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO ${sqlIdentifier(appDbUser)};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO ${sqlIdentifier(appDbUser)};
`;

  runAcceptanceSqlAgainstDatabase(env, sql, env.POSTGRES_DB ?? 'sva_studio', 'Acceptance-App-DB-User-Bootstrap fehlgeschlagen.');
};

const seedAcceptanceInstances = (env: NodeJS.ProcessEnv) => {
  const instanceIds = (env.SVA_ALLOWED_INSTANCE_IDS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (instanceIds.length === 0) {
    return;
  }

  const values = instanceIds
    .map((instanceId) => `(${sqlLiteral(instanceId)}, ${sqlLiteral(instanceId)})`)
    .join(',\n');

  const sql = `
INSERT INTO iam.instances (id, display_name)
VALUES
${values}
ON CONFLICT (id) DO NOTHING;
`;

  runAcceptanceSqlAgainstDatabase(env, sql, env.POSTGRES_DB ?? 'sva_studio', 'Acceptance-Instanz-Seed fehlgeschlagen.');
};

const resetAcceptance = (env: NodeJS.ProcessEnv) => {
  const postgresDb = env.POSTGRES_DB ?? 'sva_studio';
  const redisPassword = env.REDIS_PASSWORD?.trim();

  runAcceptanceSqlAgainstDatabase(
    env,
    'DROP SCHEMA IF EXISTS iam CASCADE;',
    postgresDb,
    'Acceptance-Postgres-Schema-Reset fehlgeschlagen.'
  );

  if (!redisPassword) {
    throw new Error('REDIS_PASSWORD fehlt fuer den Acceptance-Reset.');
  }

  const redisMarker = '__SVA_REDIS_RESET__';
  const redisScript = [
    'set -euo pipefail',
    `redis-cli --no-auth-warning -a ${shellEscape(redisPassword)} FLUSHALL >/dev/null`,
    `printf '%s\\n' '${redisMarker}_START'`,
    "printf '%s\\n' 'ok'",
    `printf '%s\\n' '${redisMarker}_END'`,
    'sleep 1',
  ].join('\n');

  runAcceptanceServiceScript(env, 'redis', redisScript, {
    marker: redisMarker,
    failureMessage: 'Acceptance-Redis-Reset fehlgeschlagen.',
  });

  migrateAcceptance(env);
  bootstrapAcceptanceAppUser(env);
  seedAcceptanceInstances(env);

  const schemaGuard = runSchemaGuard('acceptance-hb', env);
  if (!schemaGuard.ok) {
    throw new Error(`Kritische IAM-Schema-Drift nach Acceptance-Reset: ${summarizeSchemaGuardFailures(schemaGuard)}`);
  }
};

const captureAcceptanceStackStatus = (env: NodeJS.ProcessEnv) => {
  const stackName = env.SVA_STACK_NAME ?? 'sva-studio';

  try {
    if (commandExists('quantum-cli')) {
      try {
        const quantumEndpoint = env.QUANTUM_ENDPOINT ?? env.PORTAINER_ENDPOINT ?? 'sva';
        const services = runCapture(
          'quantum-cli',
          ['ps', '--endpoint', quantumEndpoint, '--stack', stackName, '--all'],
          withoutDebugEnv(env)
        );

        return {
          services,
          tasks: services,
        };
      } catch {
        // Fallback to docker below.
      }
    }

    return {
      services: runCaptureDetailed('docker', ['stack', 'services', stackName], env).stdout.trim(),
      tasks: runCaptureDetailed('docker', ['stack', 'ps', stackName], env).stdout.trim(),
    };
  } catch (error) {
    return {
      services: `Stack-Status konnte nicht erfasst werden: ${error instanceof Error ? error.message : String(error)}`,
      tasks: '',
    };
  }
};

const createProbeResult = (input: {
  details?: Readonly<Record<string, unknown>>;
  durationMs: number;
  httpStatus?: number;
  message: string;
  name: string;
  scope: AcceptanceProbeResult['scope'];
  status: AcceptanceProbeResult['status'];
  target: string;
}): AcceptanceProbeResult => ({
  ...input,
});

const buildAcceptanceReleaseManifest = (
  options: AcceptanceDeployOptions
): AcceptanceReleaseManifest => ({
  actor: options.actor,
  commitSha: getGitCommitSha(),
  imageDigest: options.imageDigest,
  imageRef: options.imageRef,
  imageRepository: options.imageRepository,
  imageTag: options.imageTag,
  monitoringConfigImageTag: options.monitoringConfigImageTag,
  profile: 'acceptance-hb',
  releaseMode: options.releaseMode,
  workflow: options.workflow,
});

const writeJsonArtifact = (filePath: string, payload: unknown) => {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const deployAcceptanceStack = (env: NodeJS.ProcessEnv) => {
  const stackName = env.SVA_STACK_NAME ?? 'sva-studio';

  if (commandExists('quantum-cli')) {
    const commandArgs = [
      'stacks',
      'update',
      ...(env.QUANTUM_ENVIRONMENT?.trim() ? ['--environment', env.QUANTUM_ENVIRONMENT.trim()] : []),
      '--endpoint',
      env.QUANTUM_ENDPOINT ?? env.PORTAINER_ENDPOINT ?? 'sva',
      '--stack',
      stackName,
      '--wait',
      '--project',
      '.',
    ];
    run('quantum-cli', commandArgs, withoutDebugEnv(env));
    return;
  }

  run('docker', ['stack', 'deploy', '-c', 'deploy/portainer/docker-compose.yml', stackName], env);
};

const writeAcceptanceDeployReport = (report: AcceptanceDeployReport) => {
  writeJsonArtifact(report.artifacts.jsonPath, report);
  writeFileSync(report.artifacts.markdownPath, `${formatAcceptanceDeployReportMarkdown(report)}\n`, 'utf8');
  writeJsonArtifact(report.artifacts.releaseManifestPath, report.releaseManifest);
  writeJsonArtifact(report.artifacts.phaseReportPath, {
    failureCategory: report.failureCategory ?? null,
    generatedAt: report.generatedAt,
    releaseDecision: report.releaseDecision,
    steps: report.steps,
  });
  writeJsonArtifact(report.artifacts.migrationReportPath, {
    migrationFiles: report.migrationFiles,
    migrationReport: report.migrationReport ?? { status: 'skipped' },
  });
  writeJsonArtifact(report.artifacts.internalVerifyPath, {
    probes: report.internalProbes,
    stackStatus: report.stackStatus,
  });
  writeJsonArtifact(report.artifacts.externalSmokePath, {
    probes: report.externalProbes,
  });
};

const createBaseAcceptanceDeployReport = (
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions,
  migrationFiles: readonly string[]
): AcceptanceDeployReport => {
  const generatedAt = new Date().toISOString();
  const reportPaths = buildAcceptanceReportPaths(deployReportDir, options.reportSlug, generatedAt);
  const releaseManifest = buildAcceptanceReleaseManifest(options);

  return {
    profile: 'acceptance-hb',
    status: 'ok',
    generatedAt,
    reportId: reportPaths.reportId,
    releaseMode: options.releaseMode,
    actor: options.actor,
    workflow: options.workflow,
    imageRef: options.imageRef,
    imageRepository: options.imageRepository,
    imageTag: options.imageTag,
    imageDigest: options.imageDigest,
    maintenanceWindow: options.maintenanceWindow,
    rollbackHint: options.rollbackHint,
    migrationFiles,
    internalProbes: [],
    externalProbes: [],
    releaseDecision: {
      technicalGatePassed: false,
      summary: 'Technische Freigabe noch nicht entschieden.',
    },
    releaseManifest,
    stackName: env.SVA_STACK_NAME ?? 'sva-studio',
    observability: {
      grafanaUrl: options.grafanaUrl,
      lokiUrl: options.lokiUrl,
      notes: [
        'Logs und Metriken bleiben intern; die Referenzen sind fuer Incident- und Release-Evidenz gedacht.',
      ],
    },
    steps: [],
    artifacts: {
      jsonPath: reportPaths.jsonPath,
      markdownPath: reportPaths.markdownPath,
      releaseManifestPath: reportPaths.releaseManifestPath,
      phaseReportPath: reportPaths.phaseReportPath,
      migrationReportPath: reportPaths.migrationReportPath,
      internalVerifyPath: reportPaths.internalVerifyPath,
      externalSmokePath: reportPaths.externalSmokePath,
    },
  };
};

const buildAcceptanceLiveSpecCheck = (env: NodeJS.ProcessEnv, options: AcceptanceDeployOptions): DoctorCheck => {
  const expected = {
    imageRef: options.imageRef,
    requiredKeys: getRuntimeProfileRequiredEnvKeys('acceptance-hb'),
  };

  try {
    const stackName = env.SVA_STACK_NAME ?? 'sva-studio';
    const dockerResult = runCaptureDetailed('docker', ['service', 'inspect', `${stackName}_app`, '--format', '{{.Spec.TaskTemplate.ContainerSpec.Image}}'], env);
    const liveImage = dockerResult.status === 0 ? dockerResult.stdout.trim() : '';

    if (!liveImage) {
      return toDoctorCheck(
        'live-spec-drift',
        'warn',
        'live_spec_unavailable',
        'Live-Service-Spec konnte nicht gelesen werden; Drift-Pruefung bleibt auf Soll-Konfiguration beschraenkt.',
        expected
      );
    }

    return toDoctorCheck(
      'live-spec-drift',
      liveImage === options.imageRef ? 'ok' : 'warn',
      liveImage === options.imageRef ? 'live_spec_matches' : 'live_spec_differs',
      liveImage === options.imageRef
        ? 'Live-Service-Spec entspricht dem Zielartefakt.'
        : 'Live-Service-Spec weicht vom Zielartefakt ab; Rollout aktualisiert diese Abweichung.',
      {
        ...expected,
        liveImage,
      }
    );
  } catch {
    return toDoctorCheck(
      'live-spec-drift',
      'warn',
      'live_spec_unavailable',
      'Live-Service-Spec konnte nicht gelesen werden; Drift-Pruefung bleibt auf Soll-Konfiguration beschraenkt.',
      expected
    );
  }
};

const runHttpProbe = async (input: {
  expect: (response: Response, payload: unknown) => string | null;
  name: string;
  scope: AcceptanceProbeResult['scope'];
  target: string;
}) => {
  const startedAt = Date.now();

  try {
    const response = await fetch(input.target, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    const rawText = await response.text();
    let payload: unknown;

    try {
      payload = rawText.length > 0 ? JSON.parse(rawText) : null;
    } catch {
      payload = rawText;
    }

    const expectationError = input.expect(response, payload);
    return createProbeResult({
      durationMs: Date.now() - startedAt,
      httpStatus: response.status,
      message: expectationError ?? `Probe erfolgreich mit HTTP ${response.status}.`,
      name: input.name,
      scope: input.scope,
      status: expectationError ? 'error' : 'ok',
      target: input.target,
      ...(expectationError ? { details: { payload } } : {}),
    });
  } catch (error) {
    return createProbeResult({
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
      name: input.name,
      scope: input.scope,
      status: 'error',
      target: input.target,
    });
  }
};

const runImageSmoke = async (
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions,
  reportId: string
): Promise<readonly AcceptanceProbeResult[]> => {
  if (!commandExists('docker')) {
    throw new Error('docker ist fuer image-smoke nicht verfuegbar.');
  }

  ensureDirs();
  const smokePort = Number(env.SVA_IMAGE_SMOKE_PORT ?? '39080');
  const containerName = `${reportId}-image-smoke`.replace(/[^a-z0-9-]/giu, '-').toLowerCase();
  const envFilePath = resolve(runtimeArtifactsDir, `${containerName}.env`);
  const runtimeEnvEntries = Object.entries(env)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => `${key}=${value as string}`);
  writeFileSync(envFilePath, `${runtimeEnvEntries.join('\n')}\n`, 'utf8');

  try {
    runCaptureDetailed('docker', ['rm', '-f', containerName], env);
  } catch {
    // ignore stale container
  }

  try {
    const runResult = runCaptureDetailed(
      'docker',
      [
        'run',
        '-d',
        '--name',
        containerName,
        '--env-file',
        envFilePath,
        '-e',
        `SVA_PUBLIC_BASE_URL=http://127.0.0.1:${smokePort}`,
        '-p',
        `127.0.0.1:${smokePort}:3000`,
        options.imageRef,
      ],
      env
    );

    if (runResult.status !== 0) {
      throw new Error(runResult.stderr?.trim() || runResult.stdout.trim() || 'Image-Smoke-Container konnte nicht gestartet werden.');
    }

    await waitForHttpOk(`http://127.0.0.1:${smokePort}/health/live`, 60_000);

    const probes = await Promise.all([
      runHttpProbe({
        name: 'image-live',
        scope: 'image-smoke',
        target: `http://127.0.0.1:${smokePort}/health/live`,
        expect: (response) => (response.status === 200 ? null : `Erwartet HTTP 200, erhalten ${response.status}.`),
      }),
      runHttpProbe({
        name: 'image-ready',
        scope: 'image-smoke',
        target: `http://127.0.0.1:${smokePort}/health/ready`,
        expect: (response) => (response.status === 200 || response.status === 503 ? null : `Unerwarteter Ready-Status ${response.status}.`),
      }),
    ]);

    const failingProbe = probes.find((probe) => probe.status === 'error');
    if (failingProbe) {
      const logResult = runCaptureDetailed('docker', ['logs', containerName], env);
      const inspectResult = runCaptureDetailed('docker', ['inspect', containerName, '--format', '{{json .State}}'], env);
      throw new Error(
        `${failingProbe.name} fehlgeschlagen. ${failingProbe.message}\n` +
          `State: ${inspectResult.stdout.trim() || inspectResult.stderr?.trim() || 'unbekannt'}\n` +
          summarizeProcessOutput(`${logResult.stdout ?? ''}\n${logResult.stderr ?? ''}`)
      );
    }

    return probes;
  } catch (error) {
    const logResult = runCaptureDetailed('docker', ['logs', containerName], env);
    const inspectResult = runCaptureDetailed('docker', ['inspect', containerName, '--format', '{{json .State}}'], env);
    const details = summarizeProcessOutput(`${logResult.stdout ?? ''}\n${logResult.stderr ?? ''}`);
    const state = inspectResult.stdout.trim() || inspectResult.stderr?.trim() || 'unbekannt';
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nState: ${state}${details ? `\n${details}` : ''}`, {
      cause: error,
    });
  } finally {
    runCaptureDetailed('docker', ['rm', '-f', containerName], env);
    if (existsSync(envFilePath)) {
      unlinkSync(envFilePath);
    }
  }
};

const runInternalVerify = async (env: NodeJS.ProcessEnv): Promise<{
  doctorReport: DoctorReport;
  probes: readonly AcceptanceProbeResult[];
}> => {
  const appService = env.SVA_ACCEPTANCE_APP_SERVICE ?? 'app';
  const marker = '__SVA_INTERNAL_HTTP__';
  const buildServiceProbe = (name: string, path: string) => {
    const startedAt = Date.now();

    try {
      const summary = runAcceptanceServiceScript(
        env,
        appService,
        `node -e "fetch('http://127.0.0.1:3000${path}', { redirect: 'manual' }).then(async (response) => { const body = await response.text(); console.log('${marker}_START'); console.log(JSON.stringify({ status: response.status, body })); console.log('${marker}_END'); }).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); })"`,
        {
          failureMessage: `Interne Probe ${path} fehlgeschlagen.`,
          marker,
          slot: env.SVA_ACCEPTANCE_APP_SLOT ?? '1',
        }
      );
      const payload = JSON.parse(summary) as { body?: string; status?: number };
      return createProbeResult({
        durationMs: Date.now() - startedAt,
        httpStatus: payload.status,
        message:
          payload.status === 200 || (name === 'internal-ready' && payload.status === 503)
            ? `Interne Probe ${path} antwortet deterministisch.`
            : `Interne Probe ${path} antwortet mit ${payload.status}.`,
        name,
        scope: 'internal',
        status: payload.status === 200 || (name === 'internal-ready' && payload.status === 503) ? 'ok' : 'error',
        target: `http://127.0.0.1:3000${path}`,
      });
    } catch (error) {
      return createProbeResult({
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
        name,
        scope: 'internal',
        status: 'error',
        target: `http://127.0.0.1:3000${path}`,
      });
    }
  };

  const doctorReport = await doctorRuntime('acceptance-hb', env);
  const probes = [
    buildServiceProbe('internal-live', '/health/live'),
    buildServiceProbe('internal-ready', '/health/ready'),
  ];

  return {
    doctorReport,
    probes,
  };
};

const runExternalSmoke = async (env: NodeJS.ProcessEnv): Promise<readonly AcceptanceProbeResult[]> => {
  const baseUrl = env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const authIssuer = env.SVA_AUTH_ISSUER ?? '';

  return await Promise.all([
    runHttpProbe({
      name: 'public-home',
      scope: 'external',
      target: baseUrl,
      expect: (response) => (response.status === 200 ? null : `Erwartet HTTP 200, erhalten ${response.status}.`),
    }),
    runHttpProbe({
      name: 'public-live',
      scope: 'external',
      target: new URL('/health/live', baseUrl).toString(),
      expect: (response) => (response.status === 200 ? null : `Erwartet HTTP 200, erhalten ${response.status}.`),
    }),
    runHttpProbe({
      name: 'public-ready',
      scope: 'external',
      target: new URL('/health/ready', baseUrl).toString(),
      expect: (response) =>
        response.status === 200 || response.status === 503 ? null : `Unerwarteter Ready-Status ${response.status}.`,
    }),
    runHttpProbe({
      name: 'public-auth-login',
      scope: 'external',
      target: new URL('/auth/login', baseUrl).toString(),
      expect: (response) => {
        const location = response.headers.get('location') ?? '';
        if (response.status !== 302) {
          return `Erwartet Redirect, erhalten ${response.status}.`;
        }
        if (authIssuer && !location.startsWith(authIssuer)) {
          return `OIDC-Redirect stimmt nicht: ${location}`;
        }
        return null;
      },
    }),
    runHttpProbe({
      name: 'public-iam-context',
      scope: 'external',
      target: new URL('/api/v1/iam/me/context', baseUrl).toString(),
      expect: (response, payload) => {
        if ([200, 401, 403].includes(response.status)) {
          return null;
        }
        if (typeof payload === 'string' && payload.toLowerCase().includes('<html')) {
          return 'IAM-Kontext lieferte HTML statt eines API-Vertrags.';
        }
        return `Unerwarteter IAM-Kontext-Status ${response.status}.`;
      },
    }),
  ]);
};

const runAcceptanceDeploy = async (env: NodeJS.ProcessEnv) => {
  const options = resolveAcceptanceDeployOptions(env, cliOptions);
  const migrationFiles =
    options.releaseMode === 'schema-and-app'
      ? runCapture('sh', ['-lc', 'printf "%s\n" packages/data/migrations/up/*.sql'])
          .split('\n')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      : [];

  let report = createBaseAcceptanceDeployReport(env, options, migrationFiles);
  const steps: AcceptanceDeployStep[] = [];

  try {
    const precheckStartedAt = Date.now();
    const precheckReport = await precheckAcceptance(env, options);
    if (precheckReport.status === 'error') {
      steps.push(
        createStepResult('environment-precheck', precheckStartedAt, 'error', 'Acceptance-Precheck ist fehlgeschlagen.', {
          report: precheckReport,
        })
      );
      report = {
        ...report,
        steps,
      };
      throw { category: 'config' as const, report };
    }

    steps.push(
      createStepResult('environment-precheck', precheckStartedAt, 'ok', 'Acceptance-Precheck erfolgreich abgeschlossen.', {
        report: precheckReport,
      })
    );

    const imageSmokeStartedAt = Date.now();
    try {
      const imageSmokeProbes = await runImageSmoke(env, options, report.reportId);
      report = {
        ...report,
        internalProbes: [...report.internalProbes, ...imageSmokeProbes],
      };
      steps.push(
        createStepResult('image-smoke', imageSmokeStartedAt, 'ok', 'Artefakt-Smoke erfolgreich abgeschlossen.', {
          probes: imageSmokeProbes,
        })
      );
    } catch (error) {
      steps.push(
        createStepResult('image-smoke', imageSmokeStartedAt, 'error', error instanceof Error ? error.message : String(error))
      );
      report = {
        ...report,
        steps,
      };
      throw { category: 'image' as const, report };
    }

    if (options.releaseMode === 'schema-and-app') {
      const migrateStartedAt = Date.now();
      try {
        migrateAcceptance(env);
        report = {
          ...report,
          migrationReport: {
            status: 'ok',
            startedAt: new Date(migrateStartedAt).toISOString(),
            completedAt: new Date().toISOString(),
          },
        };
        steps.push(
          createStepResult('migrate', migrateStartedAt, 'ok', 'Acceptance-Migration erfolgreich abgeschlossen.', {
            migrationFiles,
            maintenanceWindow: options.maintenanceWindow,
          })
        );
      } catch (error) {
        report = {
          ...report,
          migrationReport: {
            status: 'error',
            startedAt: new Date(migrateStartedAt).toISOString(),
            completedAt: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        };
        steps.push(
          createStepResult('migrate', migrateStartedAt, 'error', error instanceof Error ? error.message : String(error), {
            migrationFiles,
          })
        );
        report = {
          ...report,
          steps,
        };
        throw { category: 'migration' as const, report };
      }
    } else {
      const migrateStartedAt = Date.now();
      report = {
        ...report,
        migrationReport: {
          status: 'skipped',
        },
      };
      steps.push(createStepResult('migrate', migrateStartedAt, 'skipped', 'Migrationen fuer app-only ausgelassen.'));
    }

    const deployStartedAt = Date.now();
    try {
      deployAcceptanceStack(env);
      steps.push(
        createStepResult('deploy', deployStartedAt, 'ok', 'Acceptance-Stack erfolgreich aktualisiert.', {
          imageTag: options.imageTag,
          imageDigest: options.imageDigest,
        })
      );
    } catch (error) {
      steps.push(
        createStepResult('deploy', deployStartedAt, 'error', error instanceof Error ? error.message : String(error), {
          imageTag: options.imageTag,
          imageDigest: options.imageDigest,
        })
      );
      report = {
        ...report,
        steps,
      };
      throw { category: 'startup' as const, report };
    }

    const internalVerifyStartedAt = Date.now();
    const internalVerify = await runInternalVerify(env);
    report = {
      ...report,
      internalProbes: [...report.internalProbes, ...internalVerify.probes],
    };
    const internalVerifyFailed =
      internalVerify.doctorReport.status === 'error' || internalVerify.probes.some((probe) => probe.status === 'error');
    if (internalVerifyFailed) {
      steps.push(
        createStepResult('internal-verify', internalVerifyStartedAt, 'error', 'Interne Verifikation meldet Fehler.', {
          report: internalVerify.doctorReport,
          probes: internalVerify.probes,
        })
      );
      report = {
        ...report,
        steps,
      };
      throw { category: 'health' as const, report };
    }

    steps.push(
      createStepResult('internal-verify', internalVerifyStartedAt, 'ok', 'Interne Verifikation erfolgreich abgeschlossen.', {
        report: internalVerify.doctorReport,
        probes: internalVerify.probes,
      })
    );

    const externalSmokeStartedAt = Date.now();
    try {
      const externalProbes = await runExternalSmoke(env);
      report = {
        ...report,
        externalProbes,
      };
      const failingProbe = externalProbes.find((probe) => probe.status === 'error');
      if (failingProbe) {
        throw new Error(`${failingProbe.name}: ${failingProbe.message}`);
      }
      steps.push(
        createStepResult('external-smoke', externalSmokeStartedAt, 'ok', 'Externe Smoke-Probes erfolgreich abgeschlossen.', {
          probes: externalProbes,
        })
      );
    } catch (error) {
      steps.push(
        createStepResult('external-smoke', externalSmokeStartedAt, 'error', error instanceof Error ? error.message : String(error))
      );
      report = {
        ...report,
        steps,
      };
      throw { category: 'ingress' as const, report };
    }

    const releaseDecisionStartedAt = Date.now();
    report = {
      ...report,
      releaseDecision: {
        technicalGatePassed: true,
        summary: 'Alle technischen Gates erfolgreich.',
      },
    };
    steps.push(
      createStepResult('release-decision', releaseDecisionStartedAt, 'ok', 'Technische Freigabe erteilt.', {
        technicalGatePassed: true,
      })
    );

    report = {
      ...report,
      steps,
      stackStatus: captureAcceptanceStackStatus(env),
    };
    writeAcceptanceDeployReport(report);
    printJsonIfRequested(report);
    if (!jsonOutput) {
      console.log(`Acceptance-Deploy erfolgreich. Bericht: ${report.artifacts.markdownPath}`);
    }
    return;
  } catch (error) {
    const category =
      typeof error === 'object' && error !== null && 'category' in error
        ? (error.category as AcceptanceFailureCategory)
        : 'dependency';
    const partialReport =
      typeof error === 'object' && error !== null && 'report' in error
        ? (error.report as AcceptanceDeployReport)
        : {
            ...report,
            steps,
          };
    const failedReport = {
      ...partialReport,
      status: 'error' as const,
      failureCategory: category,
      releaseDecision: {
        technicalGatePassed: false,
        summary: `Technische Freigabe verweigert (${category}).`,
      },
      stackStatus: captureAcceptanceStackStatus(env),
    };
    writeAcceptanceDeployReport(failedReport);
    printJsonIfRequested(failedReport);
    throw new Error(`Acceptance-Deploy fehlgeschlagen (${category}). Bericht: ${failedReport.artifacts.markdownPath}`, {
      cause: error,
    });
  }
};

const runAcceptanceCommand = async (runtimeProfile: RuntimeProfile, runtimeCommand: RuntimeCommand) => {
  const env = applyCliOptionEnvOverrides(buildProfileEnv(runtimeProfile));
  const stackName = env.SVA_STACK_NAME ?? 'sva-studio';

  switch (runtimeCommand) {
    case 'up':
    case 'update':
      throw new Error(
        `Direkte Acceptance-Deploys ueber ${runtimeCommand} sind gesperrt. Nutze den kanonischen Pfad pnpm env:deploy:${runtimeProfile}.`
      );
    case 'down':
      run('docker', ['stack', 'rm', stackName], env);
      console.log(`Stack ${stackName} entfernt.`);
      return;
    case 'status':
      assertRuntimeEnv(runtimeProfile, env);
      run('docker', ['stack', 'services', stackName], env);
      run('docker', ['stack', 'ps', stackName], env);
      return;
    case 'precheck': {
      const report = await precheckAcceptance(env);
      printDoctorReport(report);
      if (report.status === 'error') {
        process.exitCode = 1;
      }
      return;
    }
    case 'deploy':
      assertRuntimeEnv(runtimeProfile, env);
      await runAcceptanceDeploy(env);
      return;
    case 'smoke':
      assertRuntimeEnv(runtimeProfile, env);
      await smokeRuntime(runtimeProfile, env);
      console.log(`Smoke-Checks fuer ${runtimeProfile} erfolgreich.`);
      return;
    case 'migrate':
      migrateAcceptance(env);
      console.log(`Migrationen fuer ${runtimeProfile} abgeschlossen.`);
      return;
    case 'reset':
      assertRuntimeEnv(runtimeProfile, env);
      resetAcceptance(env);
      console.log(`Postgres und Redis fuer ${runtimeProfile} wurden zurueckgesetzt.`);
      return;
    case 'doctor': {
      const report = await doctorRuntime(runtimeProfile, env);
      printDoctorReport(report);
      if (report.status === 'error') {
        process.exitCode = 1;
      }
      return;
    }
  }
};

const main = async () => {
  ensureDirs();

  const runtimeCommand = ensureKnownCommand(command);
  const runtimeProfile = ensureKnownProfile(profile);
  const definition = getRuntimeProfileDefinition(runtimeProfile);

  if (definition.isLocal) {
    await runLocalCommand(runtimeProfile, runtimeCommand);
    return;
  }

  await runAcceptanceCommand(runtimeProfile, runtimeCommand);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[runtime-env] ${message}`);
  process.exit(1);
});
