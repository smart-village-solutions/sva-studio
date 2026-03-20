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
  type AcceptanceReleaseMode,
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
    'Usage: tsx scripts/ops/runtime-env.ts <up|down|update|status|smoke|migrate|doctor|reset|precheck|deploy> <profile> [--json] [--release-mode=<app-only|schema-and-app>] [--maintenance-window=<text>] [--rollback-hint=<text>]'
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
  const localOverridePath = resolve(rootDir, `config/runtime/${runtimeProfile}.local.vars`);
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
  if (validation.missing.length === 0 && validation.placeholders.length === 0) {
    return;
  }

  const lines = [
    `Runtime-Profil ${runtimeProfile} ist nicht vollstaendig konfiguriert.`,
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

const stripAnsiArtifacts = (value: string) => value.replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/gu, '');

const sanitizeProcessOutput = (value: string) => stripAnsiArtifacts(stripControlArtifacts(value));

const summarizeProcessOutput = (value: string, maxLines = 40) => {
  const lines = sanitizeProcessOutput(value)
    .split(/\r?\n/u)
    .map((entry) => entry.trimEnd())
    .filter((entry) => entry.trim().length > 0);

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
  const endIndex = cleaned.lastIndexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(`Markierte Ausgabe ${marker} nicht gefunden.`);
  }

  return cleaned
    .slice(startIndex + startMarker.length, endIndex)
    .trim();
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

  if (result.status !== 0) {
    throw new Error(summarizeProcessOutput(combined) || options?.failureMessage || 'quantum-cli exec fehlgeschlagen.');
  }

  if (options?.marker) {
    return parseMarkedOutput(combined, options.marker);
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
  let payload: unknown = null;

  try {
    payload = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  return { response, payload };
};

const createDbSqlRunner = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const postgresUser = env.POSTGRES_USER ?? 'sva';
  const postgresDb = env.POSTGRES_DB ?? 'sva_studio';

  const runLocalSql = (sql: string) => {
    const localContainerId = runCaptureDetailed(
      'docker',
      ['ps', '--filter', 'name=sva-studio-postgres', '--format', '{{.ID}}'],
      env
    ).stdout.trim();

    if (localContainerId.length === 0) {
      throw new Error('Lokaler Postgres-Container nicht gefunden.');
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
      `printf '${marker}_START\\n'`,
      `psql -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(postgresDb)} -At -f /tmp/sva-runtime-query.sql`,
      `printf '\\n${marker}_END\\n'`,
      'rm -f /tmp/sva-runtime-query.sql',
      'sleep 1',
    ].join('\n');

    return runQuantumExec(
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
  };

  return (sql: string) => (runtimeProfile === 'acceptance-hb' ? runAcceptanceSql(sql) : runLocalSql(sql));
};

const runSchemaGuard = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): SchemaGuardReport => {
  const runSql = createDbSqlRunner(runtimeProfile, env);
  const output = runSql(`${CRITICAL_IAM_SCHEMA_GUARD_SQL}`);
  const [line] = output.split(/\r?\n/u).filter((entry) => entry.trim().length > 0).slice(-1);
  const row = Object.fromEntries(
    line.split('|').map((value, index) => {
      const keys = [
        'groups_exists',
        'group_roles_exists',
        'account_groups_exists',
        'accounts_instance_id_column_exists',
        'accounts_username_ciphertext_column_exists',
        'idx_accounts_kc_subject_instance_exists',
        'accounts_isolation_policy_matches',
        'instance_memberships_isolation_policy_matches',
      ] as const;
      return [keys[index], value];
    })
  );
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

const precheckAcceptance = async (env: NodeJS.ProcessEnv): Promise<DoctorReport> => {
  const checks: DoctorCheck[] = [];
  const validation = validateRuntimeProfileEnv('acceptance-hb', env);

  if (validation.missing.length > 0 || validation.placeholders.length > 0) {
    checks.push(
      toDoctorCheck(
        'runtime-env',
        'error',
        'runtime_env_invalid',
        'Acceptance-Profil ist nicht vollstaendig konfiguriert.',
        {
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

  return finalizeDoctorReport('acceptance-hb', checks);
};

const doctorRuntime = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): Promise<DoctorReport> => {
  const checks: DoctorCheck[] = [];
  const validation = validateRuntimeProfileEnv(runtimeProfile, env);

  if (validation.missing.length > 0 || validation.placeholders.length > 0) {
    checks.push(
      toDoctorCheck(
        'runtime-env',
        'error',
        'runtime_env_invalid',
        'Runtime-Profil ist nicht vollstaendig konfiguriert.',
        {
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

  const collectorHealth = await fetch('http://127.0.0.1:13133/healthz', { signal: AbortSignal.timeout(5_000) });
  if (!collectorHealth.ok) {
    throw new Error(`OTEL Collector Healthcheck fehlgeschlagen: ${collectorHealth.status}`);
  }
};

const assertAcceptanceContainerHealth = (env: NodeJS.ProcessEnv) => {
  const stackName = env.SVA_STACK_NAME ?? 'sva-studio';
  const services = ['app', 'redis', 'postgres', 'otel-collector'];

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
      `psql -q -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(postgresDb)} -f /tmp/sva-runtime-migration.sql >/tmp/sva-runtime-migration.log 2>&1`,
      'rm -f /tmp/sva-runtime-migration.sql',
    ].join('\n');

    const marker = '__SVA_MIGRATION_STATUS__';
    const markedRemoteScript = [
      remoteScript,
      `printf '${marker}_START\\n'`,
      `printf 'applied:${migrationFile}\\n'`,
      `printf '${marker}_END\\n'`,
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
    `psql -q -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(database)} -f /tmp/sva-runtime-reset.sql >/tmp/sva-runtime-reset.log 2>&1`,
    'rm -f /tmp/sva-runtime-reset.sql /tmp/sva-runtime-reset.log',
    `printf '${marker}_START\\n'`,
    "printf 'ok\\n'",
    `printf '${marker}_END\\n'`,
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
    `printf '${redisMarker}_START\\n'`,
    "printf 'ok\\n'",
    `printf '${redisMarker}_END\\n'`,
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
  writeFileSync(report.artifacts.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(report.artifacts.markdownPath, `${formatAcceptanceDeployReportMarkdown(report)}\n`, 'utf8');
};

const createBaseAcceptanceDeployReport = (
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions,
  migrationFiles: readonly string[]
): AcceptanceDeployReport => {
  const generatedAt = new Date().toISOString();
  const reportPaths = buildAcceptanceReportPaths(deployReportDir, options.reportSlug, generatedAt);

  return {
    profile: 'acceptance-hb',
    status: 'ok',
    generatedAt,
    reportId: reportPaths.reportId,
    releaseMode: options.releaseMode,
    actor: options.actor,
    workflow: options.workflow,
    imageTag: options.imageTag,
    imageDigest: options.imageDigest,
    maintenanceWindow: options.maintenanceWindow,
    rollbackHint: options.rollbackHint,
    migrationFiles,
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
    },
  };
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
    const precheckReport = await precheckAcceptance(env);
    if (precheckReport.status === 'error') {
      steps.push(
        createStepResult('precheck', precheckStartedAt, 'error', 'Acceptance-Precheck ist fehlgeschlagen.', {
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
      createStepResult('precheck', precheckStartedAt, 'ok', 'Acceptance-Precheck erfolgreich abgeschlossen.', {
        report: precheckReport,
      })
    );

    const maintenanceStartedAt = Date.now();
    if (options.releaseMode === 'schema-and-app') {
      steps.push(
        createStepResult(
          'maintenance-window',
          maintenanceStartedAt,
          'ok',
          `Wartungsfenster dokumentiert: ${options.maintenanceWindow}.`,
          {
            maintenanceWindow: options.maintenanceWindow,
          }
        )
      );
    } else {
      steps.push(
        createStepResult('maintenance-window', maintenanceStartedAt, 'skipped', 'Kein Wartungsfenster fuer app-only erforderlich.')
      );
    }

    if (options.releaseMode === 'schema-and-app') {
      const migrateStartedAt = Date.now();
      try {
        migrateAcceptance(env);
        steps.push(
          createStepResult('migrate', migrateStartedAt, 'ok', 'Acceptance-Migration erfolgreich abgeschlossen.', {
            migrationFiles,
          })
        );
      } catch (error) {
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
      throw { category: 'stack_rollout' as const, report };
    }

    const doctorStartedAt = Date.now();
    const doctorReport = await doctorRuntime('acceptance-hb', env);
    if (doctorReport.status === 'error') {
      steps.push(
        createStepResult('doctor', doctorStartedAt, 'error', 'Acceptance-Doctor meldet Fehler.', {
          report: doctorReport,
        })
      );
      report = {
        ...report,
        steps,
      };
      throw { category: 'health' as const, report };
    }

    steps.push(
      createStepResult('doctor', doctorStartedAt, 'ok', 'Acceptance-Doctor erfolgreich abgeschlossen.', {
        report: doctorReport,
      })
    );

    const smokeStartedAt = Date.now();
    try {
      await smokeRuntime('acceptance-hb', env);
      steps.push(createStepResult('smoke', smokeStartedAt, 'ok', 'Acceptance-Smoke-Checks erfolgreich abgeschlossen.'));
    } catch (error) {
      steps.push(
        createStepResult('smoke', smokeStartedAt, 'error', error instanceof Error ? error.message : String(error))
      );
      report = {
        ...report,
        steps,
      };
      throw { category: 'smoke' as const, report };
    }

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
        : 'external_dependency';
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
      stackStatus: captureAcceptanceStackStatus(env),
    };
    writeAcceptanceDeployReport(failedReport);
    printJsonIfRequested(failedReport);
    throw new Error(`Acceptance-Deploy fehlgeschlagen (${category}). Bericht: ${failedReport.artifacts.markdownPath}`);
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
      return;
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
