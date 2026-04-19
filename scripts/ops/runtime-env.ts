import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getRuntimeProfileDerivedEnvKeys,
  getRuntimeProfileDefinition,
  parseRuntimeProfile,
  getRuntimeProfileRequiredEnvKeys,
  type RuntimeProfile,
  validateRuntimeProfileEnv,
} from '../../packages/sdk/src/runtime-profile.ts';
import {
  CRITICAL_IAM_SCHEMA_GUARD_SQL,
  CRITICAL_IAM_SCHEMA_GUARD_FIELDS,
  evaluateCriticalIamSchemaGuard,
  summarizeSchemaGuardFailures,
  type SchemaGuardReport,
} from '../../packages/auth/src/iam-account-management/schema-guard.ts';
import {
  assertDeterministicRemoteMutationContext,
  buildAcceptanceReportPaths,
  parseJsonFromCommandOutput,
  buildProdParityProbePlan,
  buildTrustedForwardedHeaders,
  formatAcceptanceDeployReportMarkdown,
  getRuntimeStatusExecutionMode,
  hasLocalEmergencyRemoteMutationOverride,
  parseRuntimeCliOptions,
  resolveAcceptanceDeployOptions,
  type AcceptanceDeployOptions,
  type AcceptanceDeployReport,
  type AcceptanceDeployStep,
  type AcceptanceFailureCategory,
  type AcceptanceProbeResult,
  type AcceptanceReleaseManifest,
  type RemoteRuntimeProfile,
} from './runtime-env.shared.ts';
import {
  commandExists as commandExistsForRoot,
  filterRemoteOutputLines,
  run as runForRoot,
  runCapture as runCaptureForRoot,
  runCaptureDetailed as runCaptureDetailedForRoot,
  runQuantumExec as runQuantumExecForRoot,
  spawnBackground as spawnBackgroundForRoot,
  summarizeProcessOutput,
  wait,
  withoutDebugEnv,
} from './runtime/process.ts';
import {
  assertRequiredImagePlatform,
  formatImagePlatforms,
  inspectImagePlatforms,
} from './runtime/image-platform.ts';
import {
  assertComposeServiceIngressLabels,
  assertComposeServiceNetworks,
  buildQuantumDeployComposeDocument,
  extractComposeServiceContract,
  type ComposeDocument,
} from './runtime/deploy-project.ts';
import {
  getGooseConfiguredVersion as getGooseConfiguredVersionFromConfig,
  listGooseMigrationFiles as listGooseMigrationFilesFromDir,
  runLocalGooseStatus as runLocalGooseStatusWithDeps,
} from './runtime/goose.ts';
import { runBootstrapJobAgainstAcceptance as runBootstrapJobAgainstAcceptanceWithDeps } from './runtime/bootstrap-job.ts';
import {
  buildLocalInstanceRegistryReconciliationInput,
  buildLocalInstanceRegistryReconciliationSql,
} from './runtime/local-instance-registry.ts';
import {
  collectQuantumTaskSnapshots,
  extractQuantumJsonPayload,
  runMigrationJobAgainstAcceptance as runMigrationJobAgainstAcceptanceWithDeps,
  selectLatestMigrationTask,
} from './runtime/migration-job.ts';
import { inspectRemoteServiceContract } from './runtime/remote-service-spec.ts';
import { formatRemoteStackSnapshot, inspectRemoteStack, type RemoteStackSnapshot } from './runtime/remote-stack-state.ts';

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
  command?: string;
  launcher?: 'local-dev-server-runner';
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
const gooseConfigPath = resolve(rootDir, 'packages/data/goose.config.json');
const gooseMigrationsDir = resolve(rootDir, 'packages/data/migrations');
const gooseConfig = JSON.parse(readFileSync(gooseConfigPath, 'utf8')) as { repo: string; version: string };
const run = (commandName: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env) =>
  runForRoot(rootDir, commandName, args, env);
const runCapture = (commandName: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env) =>
  runCaptureForRoot(rootDir, commandName, args, env);
const runCaptureDetailed = (commandName: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env) =>
  runCaptureDetailedForRoot(rootDir, commandName, args, env);
const commandExists = (commandName: string) => commandExistsForRoot(rootDir, commandName);
const runQuantumExec = (
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  options?: {
    marker?: string;
    failureMessage: string;
  }
) => runQuantumExecForRoot(rootDir, args, env, options);

const composeBaseArgs = ['compose', '-f', 'docker-compose.yml'];
const composeWithMonitoringArgs = ['compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.monitoring.yml'];
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

  return value;
};

const ensureKnownProfile = (value: RuntimeProfile | undefined): RuntimeProfile => {
  const parsed = parseRuntimeProfile(value);
  if (!parsed) {
    usage();
    throw new Error('Unreachable');
  }

  return parsed;
};

const isRemoteRuntimeProfile = (runtimeProfile: RuntimeProfile): runtimeProfile is RemoteRuntimeProfile =>
  !getRuntimeProfileDefinition(runtimeProfile).isLocal;

const requireRemoteRuntimeProfile = (runtimeProfile: RuntimeProfile): RemoteRuntimeProfile => {
  if (!isRemoteRuntimeProfile(runtimeProfile)) {
    throw new Error(`Remote-Runtime-Profil erwartet, erhalten: ${runtimeProfile}`);
  }

  return runtimeProfile;
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

const resolveEffectiveImageRefForRemoteChecks = (
  env: NodeJS.ProcessEnv,
  options?: AcceptanceDeployOptions
) => {
  const optionImageRef = options?.imageRef?.trim();
  if (optionImageRef) {
    return optionImageRef;
  }

  const configuredImageRef = env.SVA_IMAGE_REF?.trim();
  if (configuredImageRef) {
    return configuredImageRef;
  }

  const imageDigest = env.SVA_IMAGE_DIGEST?.trim();
  if (!imageDigest) {
    return undefined;
  }

  const registry = env.SVA_REGISTRY?.trim() || 'ghcr.io/smart-village-solutions';
  const repository = env.SVA_IMAGE_REPOSITORY?.trim() || 'sva-studio';
  return `${registry}/${repository}@${imageDigest}`;
};

const buildImagePlatformDoctorCheck = (
  env: NodeJS.ProcessEnv,
  options?: AcceptanceDeployOptions
): DoctorCheck => {
  const imageRef = resolveEffectiveImageRefForRemoteChecks(env, options);

  if (!imageRef) {
    return toDoctorCheck(
      'image-platform',
      'error',
      'image_ref_missing',
      'Keine Image-Referenz fuer die Plattform-Pruefung vorhanden.'
    );
  }

  try {
    const platforms = inspectImagePlatforms(imageRef, withoutDebugEnv(env), {
      commandExists,
      runCaptureDetailed,
    });
    assertRequiredImagePlatform(imageRef, platforms);
    return toDoctorCheck(
      'image-platform',
      'ok',
      'image_platform_supported',
      'Image-Plattform ist fuer den Linux-Swarm geeignet.',
      {
        imageRef,
        platforms: formatImagePlatforms(platforms),
        requiredPlatform: 'linux/amd64',
      }
    );
  } catch (error) {
    return toDoctorCheck(
      'image-platform',
      'error',
      'image_platform_unsupported',
      error instanceof Error ? error.message : String(error),
      {
        imageRef,
        requiredPlatform: 'linux/amd64',
      }
    );
  }
};

const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sqlIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const listGooseMigrationFiles = () => listGooseMigrationFilesFromDir(gooseMigrationsDir);

const getGooseConfiguredVersion = () => getGooseConfiguredVersionFromConfig(gooseConfig);

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
  const baseEnv = parseVarsFile(baseEnvPath);
  const profileEnv = parseVarsFile(profileEnvPath);
  const localOverrideEnv = existsSync(localOverridePath) ? parseVarsFile(localOverridePath) : {};
  const userQuantumEnvPath = process.env.HOME ? resolve(process.env.HOME, '.config/quantum/env') : '';
  const userQuantumEnv = userQuantumEnvPath && existsSync(userQuantumEnvPath) ? parseVarsFile(userQuantumEnvPath) : {};
  const env = {
    ...baseEnv,
    ...profileEnv,
    ...localOverrideEnv,
    ...userQuantumEnv,
    ...process.env,
  };

  if (!getRuntimeProfileDefinition(runtimeProfile).isLocal) {
    const remoteOnlyKeys = [
      'SVA_STACK_NAME',
      'OTEL_EXPORTER_OTLP_ENDPOINT',
      'REDIS_URL',
      'POSTGRES_PASSWORD',
      'IAM_DATABASE_URL',
      'IAM_PII_KEYRING_JSON',
    ] as const;

    for (const key of remoteOnlyKeys) {
      if (!(key in profileEnv) && !(key in localOverrideEnv) && !(key in process.env)) {
        delete env[key];
      }
    }
  }

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

const getConfiguredStackName = (env: NodeJS.ProcessEnv) => {
  const stackName = env.SVA_STACK_NAME?.trim();
  if (!stackName) {
    throw new Error('runtime_profile_invalid: SVA_STACK_NAME fehlt fuer den Remote-Betrieb.');
  }

  return stackName;
};

const getConfiguredQuantumEndpoint = (env: NodeJS.ProcessEnv) => {
  const endpoint = env.QUANTUM_ENDPOINT?.trim() || env.PORTAINER_ENDPOINT?.trim();
  if (!endpoint) {
    throw new Error('runtime_profile_invalid: QUANTUM_ENDPOINT fehlt fuer den Remote-Betrieb.');
  }

  return endpoint;
};

const getRuntimeContractSummary = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => ({
  enableOtel: (env.ENABLE_OTEL?.trim() || 'true').toLowerCase() !== 'false',
  mainserverRequired: isMainserverCheckRequired(runtimeProfile, env),
  parentDomain: env.SVA_PARENT_DOMAIN?.trim() || null,
  publicBaseUrl: env.SVA_PUBLIC_BASE_URL?.trim() || null,
  quantumEndpoint: getRuntimeProfileDefinition(runtimeProfile).isLocal ? null : (env.QUANTUM_ENDPOINT?.trim() || null),
  runtimeProfile,
  stackName: getRuntimeProfileDefinition(runtimeProfile).isLocal ? null : (env.SVA_STACK_NAME?.trim() || null),
  supportedTenantHosts: (env.SVA_ALLOWED_INSTANCE_IDS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((instanceId) => `${instanceId}.${env.SVA_PARENT_DOMAIN?.trim() || '<missing-parent-domain>'}`),
});

const isMainserverCheckRequired = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const explicit = env.SVA_MAINSERVER_REQUIRED?.trim().toLowerCase();
  if (explicit === 'true') {
    return true;
  }
  if (explicit === 'false') {
    return false;
  }

  return runtimeProfile !== 'studio';
};

const isMigrationStatusCheckRequired = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const explicit = env.SVA_MIGRATION_STATUS_REQUIRED?.trim().toLowerCase();
  if (explicit === 'true') {
    return true;
  }
  if (explicit === 'false') {
    return false;
  }

  return runtimeProfile !== 'studio';
};


const isTruthyFlag = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
};

const resolveObservabilityMode = (env: NodeJS.ProcessEnv): 'console_to_loki' | 'otel_to_loki' | 'degraded' => {
  const otelEnabled = !['false', '0'].includes((env.ENABLE_OTEL?.trim() || '').toLowerCase());
  const consoleEnabled = isTruthyFlag(env.SVA_ENABLE_SERVER_CONSOLE_LOGS);

  if (otelEnabled) {
    return 'otel_to_loki';
  }
  if (consoleEnabled) {
    return 'console_to_loki';
  }
  return 'degraded';
};

const getObservabilitySummary = (env: NodeJS.ProcessEnv) => ({
  consoleEnabled: isTruthyFlag(env.SVA_ENABLE_SERVER_CONSOLE_LOGS),
  loggerMode: resolveObservabilityMode(env),
  lokiConfigured: Boolean(env.SVA_LOKI_URL?.trim() && env.SVA_GRAFANA_TOKEN?.trim()),
  otelEnabled: !['false', '0'].includes((env.ENABLE_OTEL?.trim() || '').toLowerCase()),
  otelEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || null,
});

type LiveRuntimeFlags = {
  ENABLE_OTEL: string;
  SVA_ENABLE_SERVER_CONSOLE_LOGS: string;
  SVA_RUNTIME_PROFILE: string;
};

const parseLiveRuntimeFlags = (raw: string): LiveRuntimeFlags => {
  const entries = new Map<string, string>();
  for (const line of raw.split(/\r?\n/u)) {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key.length > 0) {
      entries.set(key, value);
    }
  }

  return {
    ENABLE_OTEL: entries.get('ENABLE_OTEL') ?? '',
    SVA_ENABLE_SERVER_CONSOLE_LOGS: entries.get('SVA_ENABLE_SERVER_CONSOLE_LOGS') ?? '',
    SVA_RUNTIME_PROFILE: entries.get('SVA_RUNTIME_PROFILE') ?? '',
  };
};

const readLiveRuntimeFlags = async (env: NodeJS.ProcessEnv): Promise<LiveRuntimeFlags> => {
  const liveContract = await inspectRemoteServiceContract(
    {
      commandExists,
      runCapture,
    },
    env,
    {
      quantumEndpoint: getConfiguredQuantumEndpoint(env),
      serviceName: getRemoteAppServiceName(env),
      stackName: getConfiguredStackName(env),
    },
  );

  if (!liveContract) {
    throw new Error('Live-Service-Spec fuer den App-Container konnte nicht gelesen werden.');
  }

  const serializedEnv = Object.entries(liveContract.env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  return parseLiveRuntimeFlags(serializedEnv);
};

const buildLiveRuntimeEnvCheck = async (
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv
): Promise<DoctorCheck> => {
  try {
    const liveFlags = await readLiveRuntimeFlags(env);
    const expectedFlags = {
      ENABLE_OTEL: env.ENABLE_OTEL?.trim() || '',
      SVA_ENABLE_SERVER_CONSOLE_LOGS: env.SVA_ENABLE_SERVER_CONSOLE_LOGS?.trim() || '',
      SVA_RUNTIME_PROFILE: runtimeProfile,
    };

    const mismatches = Object.entries(expectedFlags)
      .filter(([key, expectedValue]) => liveFlags[key as keyof LiveRuntimeFlags] !== expectedValue)
      .map(([key, expectedValue]) => ({
        actual: liveFlags[key as keyof LiveRuntimeFlags],
        expected: expectedValue,
        key,
      }));

    if (mismatches.length > 0) {
      return toDoctorCheck(
        'runtime-env-live',
        'error',
        'runtime_env_live_mismatch',
        'Die effektive Container-Umgebung weicht von den erwarteten Runtime-Flags ab.',
        {
          expectedFlags,
          liveFlags,
          mismatches,
        }
      );
    }

    return toDoctorCheck(
      'runtime-env-live',
      'ok',
      'runtime_env_live_match',
      'Die effektive Container-Umgebung entspricht den erwarteten Runtime-Flags.',
      {
        channel: 'portainer-api',
        expectedFlags,
        liveFlags,
      }
    );
  } catch (error) {
    return toDoctorCheck(
      'runtime-env-live',
      'warn',
      'runtime_env_live_unavailable',
      error instanceof Error ? error.message : String(error)
    );
  }
};

type RemoteStackEvidence = {
  channel: 'docker' | 'portainer-api' | 'quantum-cli';
  hasRunningService: (serviceName: string) => boolean;
  services?: string;
  snapshot?: RemoteStackSnapshot;
  summary: string;
  tasks?: string;
};

const hasRunningQuantumService = (summary: string, serviceName: string) =>
  summary.includes(`service ${serviceName}`) &&
  new RegExp(`service ${serviceName}[\\s\\S]*?replicated\\s+1/1`, 'u').test(summary);

const readRemoteStackEvidence = async (env: NodeJS.ProcessEnv): Promise<RemoteStackEvidence> => {
  const stackName = getConfiguredStackName(env);

  try {
    const snapshot = await inspectRemoteStack(
      {
        commandExists,
        runCapture,
      },
      env,
      {
        quantumEndpoint: getConfiguredQuantumEndpoint(env),
        stackName,
      },
    );
    const summary = formatRemoteStackSnapshot(snapshot);
    return {
      channel: 'portainer-api',
      hasRunningService: (serviceName) => {
        const service = snapshot.services.find((entry) => entry.shortName === serviceName);
        return (service?.runningReplicas ?? 0) > 0;
      },
      services: summary,
      snapshot,
      summary,
      tasks: summary,
    };
  } catch (portainerError) {
    if (commandExists('quantum-cli')) {
      const quantumSummary = runCapture(
        'quantum-cli',
        ['ps', '--endpoint', getConfiguredQuantumEndpoint(env), '--stack', stackName, '--all'],
        withoutDebugEnv(env),
      );
      return {
        channel: 'quantum-cli',
        hasRunningService: (serviceName) => hasRunningQuantumService(quantumSummary, serviceName),
        services: quantumSummary,
        summary: quantumSummary,
        tasks: quantumSummary,
      };
    }

    throw portainerError;
  }
};

const queryRecentLokiLines = async (env: NodeJS.ProcessEnv, query: string, limit = 20): Promise<readonly string[]> => {
  const lokiUrl = env.SVA_LOKI_URL?.trim();
  const grafanaToken = env.SVA_GRAFANA_TOKEN?.trim();
  if (!lokiUrl || !grafanaToken) {
    throw new Error('loki_probe_unconfigured');
  }

  const url = new URL(`${lokiUrl.replace(/\/+$/u, '')}/query_range`);
  url.searchParams.set('query', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('start', String((Date.now() - 15 * 60 * 1000) * 1_000_000));
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${grafanaToken}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`loki_probe_failed:${response.status}`);
  }
  const payload = (await response.json()) as {
    data?: { result?: Array<{ values?: string[][] }> };
  };
  return (payload.data?.result ?? []).flatMap((entry) => (entry.values ?? []).map((value) => value[1] ?? '')).filter((line) => line.length > 0);
};

const queryRecentLokiLinesWithRetry = async (
  env: NodeJS.ProcessEnv,
  query: string,
  options: { attempts?: number; delayMs?: number; limit?: number } = {},
): Promise<readonly string[]> => {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 2_000;
  const limit = options.limit ?? 20;

  let lastLines: readonly string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastLines = await queryRecentLokiLines(env, query, limit);
    if (lastLines.length > 0 || attempt >= attempts) {
      return lastLines;
    }
    await wait(delayMs);
  }

  return lastLines;
};

const buildObservabilityDoctorCheck = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): Promise<DoctorCheck> => {
  const summary = getObservabilitySummary(env);
  if (summary.loggerMode === 'degraded') {
    return toDoctorCheck(
      'observability-readiness',
      'error',
      'observability_transport_missing',
      'Weder OTEL noch produktives Console-Logging sind aktiv; der Logger waere im degradierten Modus.',
      summary
    );
  }

  if (runtimeProfile === 'local-builder' || runtimeProfile === 'local-keycloak') {
    return toDoctorCheck(
      'observability-readiness',
      'ok',
      'observability_local_ready',
      'Lokales Laufzeitprofil verwendet einen gueltigen Logger-Modus.',
      summary
    );
  }

  try {
    const stackName = getConfiguredStackName(env);
    const lines = await queryRecentLokiLinesWithRetry(
      env,
      `{swarm_stack="${stackName}",swarm_service="${stackName}_app"} |= "observability_"`,
      { attempts: 3, delayMs: 2_000, limit: 50 }
    );
    const readyLine = [...lines].reverse().find((line) => line.includes('observability_ready'));
    const degradedLine = [...lines].reverse().find((line) => line.includes('observability_degraded'));
    if (readyLine) {
      return toDoctorCheck(
        'observability-readiness',
        'ok',
        'observability_ready',
        'Ein frisches Observability-Ready-Event ist in Loki sichtbar.',
        {
          ...summary,
          sample: readyLine,
        }
      );
    }
    if (degradedLine) {
      return toDoctorCheck(
        'observability-readiness',
        'warn',
        'observability_degraded',
        'Die App meldet einen degradierten Observability-Zustand in Loki.',
        {
          ...summary,
          sample: degradedLine,
        }
      );
    }

    return toDoctorCheck(
      'observability-readiness',
      'warn',
      'observability_probe_empty',
      'Es wurden keine frischen Observability-Ereignisse in Loki gefunden.',
      summary
    );
  } catch (error) {
    return toDoctorCheck(
      'observability-readiness',
      'warn',
      error instanceof Error && error.message === 'loki_probe_unconfigured' ? 'loki_probe_unconfigured' : 'loki_probe_failed',
      error instanceof Error ? error.message : String(error),
      summary
    );
  }
};

const buildTenantAuthProofCheck = async (env: NodeJS.ProcessEnv): Promise<DoctorCheck> => {
  const parentDomain = env.SVA_PARENT_DOMAIN?.trim();
  const tenantInstanceIds = (env.SVA_ALLOWED_INSTANCE_IDS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (!parentDomain || tenantInstanceIds.length === 0) {
    return toDoctorCheck('tenant-auth-proof', 'skipped', 'tenant_auth_optional', 'Kein Tenant-Auth-Proof konfiguriert.', {
      parentDomain,
      tenantInstanceIds,
    });
  }

  const baseProtocol = new URL(env.SVA_PUBLIC_BASE_URL ?? 'https://studio.smart-village.app').protocol;
  const probeResults: Array<{ instanceId: string; location: string }> = [];
  for (const instanceId of tenantInstanceIds.slice(0, 2)) {
    const target = `${baseProtocol}//${instanceId}.${parentDomain}/auth/login`;
    const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    const location = response.headers.get('location') ?? '';
    if (response.status !== 302 || !location.includes(`/realms/${instanceId}/`)) {
      return toDoctorCheck(
        'tenant-auth-proof',
        'error',
        'tenant_auth_redirect_failed',
        `Tenant-Login fuer ${instanceId} liefert keinen korrekten Realm-Redirect.`,
        { instanceId, location, status: response.status }
      );
    }
    probeResults.push({ instanceId, location });
  }

  try {
    const stackName = getConfiguredStackName(env);
    const missingEvidence: string[] = [];
    for (const probe of probeResults) {
      const lines = await queryRecentLokiLinesWithRetry(
        env,
        `{swarm_stack="${stackName}",swarm_service="${stackName}_app"} |= "tenant_auth_resolution_summary" |= "${probe.instanceId}"`,
        { attempts: 3, delayMs: 2_000, limit: 20 }
      );
      if (lines.length === 0) {
        missingEvidence.push(probe.instanceId);
      }
    }

    if (missingEvidence.length > 0) {
      return toDoctorCheck(
        'tenant-auth-proof',
        'warn',
        'tenant_auth_log_missing',
        'Tenant-Redirects sind korrekt, aber Loki enthaelt noch nicht fuer alle Tenant-Probes die passenden Resolution-Logs.',
        { missingEvidence, probeResults }
      );
    }

    return toDoctorCheck(
      'tenant-auth-proof',
      'ok',
      'tenant_auth_resolution_logged',
      'Tenant-Redirects und zugehoerige Resolution-Logs sind vorhanden.',
      { probeResults }
    );
  } catch (error) {
    return toDoctorCheck(
      'tenant-auth-proof',
      'warn',
      'tenant_auth_log_probe_failed',
      error instanceof Error ? error.message : String(error),
      { probeResults }
    );
  }
};

const shouldSkipQuantumPrePull = (env: NodeJS.ProcessEnv) => env.SVA_QUANTUM_NO_PRE_PULL?.trim().toLowerCase() === 'true';

const RUNTIME_CONTRACT_COMPARISON_KEYS = [
  'SVA_RUNTIME_PROFILE',
  'SVA_PUBLIC_BASE_URL',
  'SVA_PARENT_DOMAIN',
  'SVA_ALLOWED_INSTANCE_IDS',
  'APP_DB_USER',
  'POSTGRES_DB',
  'KEYCLOAK_ADMIN_BASE_URL',
  'KEYCLOAK_ADMIN_REALM',
  'KEYCLOAK_ADMIN_CLIENT_ID',
  'IAM_UI_ENABLED',
  'IAM_ADMIN_ENABLED',
  'IAM_BULK_ENABLED',
  'VITE_IAM_UI_ENABLED',
  'VITE_IAM_ADMIN_ENABLED',
  'VITE_IAM_BULK_ENABLED',
] as const;

const RUNTIME_CONTRACT_SECRET_PRESENCE_KEYS = [
  'SVA_AUTH_CLIENT_SECRET',
  'SVA_AUTH_STATE_SECRET',
  'KEYCLOAK_ADMIN_CLIENT_SECRET',
  'ENCRYPTION_KEY',
  'IAM_PII_KEYRING_JSON',
  'APP_DB_PASSWORD',
  'POSTGRES_PASSWORD',
  'REDIS_PASSWORD',
] as const;

const parseContainerEnv = (serialized: string) => {
  const normalized = serialized.trim();
  if (!normalized) {
    return {} as Record<string, string>;
  }

  const parsed = JSON.parse(normalized) as string[];
  return Object.fromEntries(
    parsed
      .filter((entry) => entry.includes('='))
      .map((entry) => {
        const separatorIndex = entry.indexOf('=');
        return [entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)] as const;
      })
  );
};

const getRemoteComposeFile = (env: NodeJS.ProcessEnv) => {
  const runtimeProfile = env.SVA_RUNTIME_PROFILE?.trim();
  if (runtimeProfile === 'studio') {
    return 'deploy/portainer/docker-compose.studio.yml';
  }

  return 'deploy/portainer/docker-compose.yml';
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
    'scripts/ops/runtime/local-dev-server-runner.ts',
    'sva-studio-react:serve',
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
  writeFileSync(logFile, '', 'utf8');
  const child = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      'scripts/ops/runtime/local-dev-server-runner.ts',
      `--profile=${runtimeProfile}`,
      `--log-file=${logFile}`,
      `--state-file=${localStateFile}`,
    ],
    {
    cwd: rootDir,
    env,
    detached: true,
      stdio: 'ignore',
    }
  );

  if (child.pid === undefined) {
    throw new Error(`Dev-Server fuer ${runtimeProfile} konnte nicht gestartet werden.`);
  }

  child.unref();

  writeFileSync(
    localStateFile,
    `${JSON.stringify(
      {
        command: 'pnpm nx run sva-studio-react:serve',
        launcher: 'local-dev-server-runner',
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

const reconcileLocalInstanceRegistry = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const input = buildLocalInstanceRegistryReconciliationInput(env);
  if (!input) {
    return;
  }

  const sql = buildLocalInstanceRegistryReconciliationSql(input);
  createDbSqlRunner(runtimeProfile, env)(sql);
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

    const stackName = getConfiguredStackName(env);
    const quantumEndpoint = getConfiguredQuantumEndpoint(env);
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

  return (sql: string) => (isRemoteRuntimeProfile(runtimeProfile) ? runAcceptanceSql(sql) : runLocalSql(sql));
};

const shouldUseJobBasedRemoteDbAssertions = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
  isRemoteRuntimeProfile(runtimeProfile) &&
  (env.SVA_REMOTE_DB_ASSERTIONS_MODE?.trim().toLowerCase() ?? 'job') === 'job';

const runSchemaGuard = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): SchemaGuardReport => {
  if (shouldUseJobBasedRemoteDbAssertions(runtimeProfile, env)) {
    return {
      ok: true,
      checks: [],
    };
  }
  const runSql = createDbSqlRunner(runtimeProfile, env);
  const output = runSql(`${CRITICAL_IAM_SCHEMA_GUARD_SQL}`);
  const fieldCount = CRITICAL_IAM_SCHEMA_GUARD_FIELDS.length;
  const boolMatrixPattern = new RegExp(`(?:t|f)(?:\\|(?:t|f)){${fieldCount - 1}}`, 'gu');
  const matches = Array.from(output.matchAll(boolMatrixPattern)).map((match) => match[0]);
  const line = matches.at(-1);
  if (!line) {
    throw new Error(`Schema-Guard-Ausgabe konnte nicht als Bool-Matrix gelesen werden: ${output}`);
  }
  const row = Object.fromEntries(
    line.split('|').map((value, index) => [CRITICAL_IAM_SCHEMA_GUARD_FIELDS[index], value])
  );
  return evaluateCriticalIamSchemaGuard(row);
};

const recoverSchemaGuardReportFromOutput = (value: string): SchemaGuardReport | null => {
  const fieldCount = CRITICAL_IAM_SCHEMA_GUARD_FIELDS.length;
  const boolMatrixPattern = new RegExp(`(?:t|f)(?:\\|(?:t|f)){${fieldCount - 1}}`, 'gu');
  const matches = Array.from(value.matchAll(boolMatrixPattern)).map((match) => match[0]);
  const line = matches.at(-1);
  if (!line) {
    return null;
  }

  const row = Object.fromEntries(
    line.split('|').map((entry, index) => [CRITICAL_IAM_SCHEMA_GUARD_FIELDS[index], entry])
  );
  return evaluateCriticalIamSchemaGuard(row);
};

const buildSchemaGuardCheck = (
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv
): DoctorCheck => {
  if (shouldUseJobBasedRemoteDbAssertions(runtimeProfile, env)) {
    return toDoctorCheck(
      'schema-guard',
      'ok',
      'schema_guard_verified_by_job',
      'Kritische IAM-Schema-Pruefungen werden fuer Remote-Profile im dedizierten Bootstrap-Job ausgefuehrt.',
    );
  }

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

const buildInstanceAuthConfigCheck = (
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv
): DoctorCheck => {
  if (shouldUseJobBasedRemoteDbAssertions(runtimeProfile, env)) {
    return toDoctorCheck(
      'instance-auth-config',
      'ok',
      'instance_auth_config_verified_by_job',
      'Aktive Instanz-Auth-Konfiguration wird fuer Remote-Profile ueber den dedizierten Bootstrap-Job sichergestellt.',
      {
        requiredFields: ['authRealm', 'authClientId'],
      }
    );
  }

  const appDbUser = env.APP_DB_USER?.trim() || 'sva_app';
  const evaluateInstanceAuthPayload = (payload: {
    checked_active_instance_count?: number;
    invalid_instance_ids?: string[];
  }): DoctorCheck => {
    const invalidInstanceIds = Array.isArray(payload.invalid_instance_ids) ? payload.invalid_instance_ids : [];
    const checkedActiveInstanceCount =
      typeof payload.checked_active_instance_count === 'number' ? payload.checked_active_instance_count : 0;

    if (invalidInstanceIds.length > 0) {
      return toDoctorCheck(
        'instance-auth-config',
        'error',
        'instance_auth_config_missing',
        'Mindestens eine aktive Instanz hat keine vollstaendige Auth-Konfiguration.',
        {
          checkedActiveInstanceCount,
          invalidInstanceIds,
          requiredFields: ['authRealm', 'authClientId'],
        }
      );
    }

    return toDoctorCheck(
      'instance-auth-config',
      'ok',
      'instance_auth_config_complete',
      'Alle aktiven Instanzen besitzen authRealm und authClientId.',
      {
        checkedActiveInstanceCount,
        requiredFields: ['authRealm', 'authClientId'],
      }
    );
  };

  const sql = `
SET ROLE ${sqlIdentifier(appDbUser)};

SELECT json_build_object(
  'invalid_instance_ids',
  COALESCE(
    (
      SELECT json_agg(instance_id ORDER BY instance_id)
      FROM (
        SELECT id AS instance_id
        FROM iam.instances
        WHERE status = 'active'
          AND (
            NULLIF(BTRIM(auth_realm), '') IS NULL
            OR NULLIF(BTRIM(auth_client_id), '') IS NULL
          )
      ) invalid_instances
    ),
    '[]'::json
  ),
  'checked_active_instance_count',
  (
    SELECT COUNT(*)
    FROM iam.instances
    WHERE status = 'active'
  )
)::text;
`;

  try {
    const payload = parseJsonFromCommandOutput<{
      checked_active_instance_count?: number;
      invalid_instance_ids?: string[];
    }>(createDbSqlRunner(runtimeProfile, env)(sql));
    return evaluateInstanceAuthPayload(payload);
  } catch (error) {
    return toDoctorCheck(
      'instance-auth-config',
      'error',
      'instance_auth_config_check_failed',
      error instanceof Error ? error.message : String(error)
    );
  }
};

const buildTenantAdminClientContractCheck = (
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv
): DoctorCheck => {
  if (shouldUseJobBasedRemoteDbAssertions(runtimeProfile, env)) {
    return toDoctorCheck(
      'instance-tenant-admin-contract',
      'ok',
      'instance_tenant_admin_contract_verified_by_job',
      'Tenant-Admin-Client-Vertraege werden fuer Remote-Profile ueber den dedizierten Bootstrap-Job abgesichert.',
      {
        requiredFields: ['tenantAdminClient.clientId'],
        cutoverRequired: (env.SVA_REQUIRE_TENANT_ADMIN_CLIENT_CUTOVER ?? 'false').trim().toLowerCase() === 'true',
      }
    );
  }

  const appDbUser = env.APP_DB_USER?.trim() || 'sva_app';
  const cutoverRequired = (env.SVA_REQUIRE_TENANT_ADMIN_CLIENT_CUTOVER ?? 'false').trim().toLowerCase() === 'true';
  const evaluateTenantAdminPayload = (payload: {
    checked_active_instance_count?: number;
    invalid_instance_ids?: string[];
  }): DoctorCheck => {
    const invalidInstanceIds = Array.isArray(payload.invalid_instance_ids) ? payload.invalid_instance_ids : [];
    const checkedActiveInstanceCount =
      typeof payload.checked_active_instance_count === 'number' ? payload.checked_active_instance_count : 0;

    if (invalidInstanceIds.length === 0) {
      return toDoctorCheck(
        'instance-tenant-admin-contract',
        'ok',
        'instance_tenant_admin_contract_complete',
        'Alle aktiven Instanzen besitzen einen Tenant-Admin-Client-Vertrag.',
        {
          checkedActiveInstanceCount,
          cutoverRequired,
          requiredFields: ['tenantAdminClient.clientId'],
        }
      );
    }

    return toDoctorCheck(
      'instance-tenant-admin-contract',
      cutoverRequired ? 'error' : 'warn',
      cutoverRequired
        ? 'instance_tenant_admin_cutover_blocked'
        : 'instance_tenant_admin_contract_incomplete',
      cutoverRequired
        ? 'Runtime-Cutover ist blockiert: Mindestens eine aktive Instanz hat noch keinen Tenant-Admin-Client.'
        : 'Mindestens eine aktive Instanz hat noch keinen Tenant-Admin-Client; Login bleibt moeglich, Tenant-Admin-Cutover aber noch nicht.',
      {
        checkedActiveInstanceCount,
        invalidInstanceIds,
        cutoverRequired,
        requiredFields: ['tenantAdminClient.clientId'],
      }
    );
  };

  const sql = `
SET ROLE ${sqlIdentifier(appDbUser)};

SELECT json_build_object(
  'invalid_instance_ids',
  COALESCE(
    (
      SELECT json_agg(instance_id ORDER BY instance_id)
      FROM (
        SELECT id AS instance_id
        FROM iam.instances
        WHERE status = 'active'
          AND NULLIF(BTRIM(tenant_admin_client_id), '') IS NULL
      ) invalid_instances
    ),
    '[]'::json
  ),
  'checked_active_instance_count',
  (
    SELECT COUNT(*)
    FROM iam.instances
    WHERE status = 'active'
  )
)::text;
`;

  try {
    const payload = parseJsonFromCommandOutput<{
      checked_active_instance_count?: number;
      invalid_instance_ids?: string[];
    }>(createDbSqlRunner(runtimeProfile, env)(sql));
    return evaluateTenantAdminPayload(payload);
  } catch (error) {
    return toDoctorCheck(
      'instance-tenant-admin-contract',
      'error',
      'instance_tenant_admin_contract_check_failed',
      error instanceof Error ? error.message : String(error),
      {
        cutoverRequired,
      }
    );
  }
};

const buildInstanceHostnameMappingCheck = (
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv
): DoctorCheck => {
  if (shouldUseJobBasedRemoteDbAssertions(runtimeProfile, env)) {
    return toDoctorCheck(
      'instance-hostnames',
      'ok',
      'instance_hostnames_verified_by_job',
      'Tenant-Hostname-Mappings werden fuer Remote-Profile im dedizierten Bootstrap-Job validiert.',
    );
  }

  const parentDomain = env.SVA_PARENT_DOMAIN?.trim();
  const instanceIds = (env.SVA_ALLOWED_INSTANCE_IDS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (!parentDomain || instanceIds.length === 0) {
    return toDoctorCheck(
      'instance-hostnames',
      'skipped',
      'instance_hostname_scope_missing',
      'Keine Tenant-Host-Pruefung konfiguriert; Parent-Domain oder erlaubte Instanz-IDs fehlen.'
    );
  }

  const expectedHostnames = instanceIds.map((instanceId) => ({
    hostname: `${instanceId}.${parentDomain}`,
    instanceId,
  }));
  const appDbUser = env.APP_DB_USER?.trim() || 'sva_app';

  const sql = `
SET ROLE ${sqlIdentifier(appDbUser)};

SELECT json_build_object(
  'missing_hostnames',
  COALESCE(
    (
      SELECT json_agg(expected.hostname ORDER BY expected.hostname)
      FROM (
        VALUES ${expectedHostnames
          .map(({ hostname, instanceId }) => `(${sqlLiteral(hostname)}, ${sqlLiteral(instanceId)})`)
          .join(',\n        ')}
      ) AS expected(hostname, instance_id)
      LEFT JOIN (
        SELECT hostname.hostname, instance.id AS instance_id
        FROM iam.instance_hostnames hostname
        JOIN iam.instances instance
          ON instance.id = hostname.instance_id
        WHERE hostname.is_primary = true
      ) actual
        ON actual.hostname = expected.hostname
       AND actual.instance_id = expected.instance_id
      WHERE actual.instance_id IS NULL
    ),
    '[]'::json
  ),
  'checked_hostnames',
  ${sqlLiteral(expectedHostnames.map(({ hostname }) => hostname).join(','))}
)::text;
`;

  try {
    const payload = parseJsonFromCommandOutput<{
      checked_hostnames?: string;
      missing_hostnames?: string[];
    }>(createDbSqlRunner(runtimeProfile, env)(sql));

    const missingHostnames = Array.isArray(payload.missing_hostnames) ? payload.missing_hostnames : [];
    if (missingHostnames.length > 0) {
      return toDoctorCheck(
        'instance-hostnames',
        'error',
        'tenant_instance_not_found',
        'Mindestens ein erwartetes Tenant-Hostname-Mapping fehlt oder ist nicht primaer.',
        {
          missingHostnames,
          parentDomain,
        }
      );
    }

    return toDoctorCheck(
      'instance-hostnames',
      'ok',
      'tenant_hostnames_ready',
      'Alle erwarteten Tenant-Hostname-Mappings sind vorhanden.',
      {
        hostnames: expectedHostnames.map(({ hostname }) => hostname),
        parentDomain,
      }
    );
  } catch (error) {
    return toDoctorCheck('instance-hostnames', 'error', 'tenant_host_resolution_failed', error instanceof Error ? error.message : String(error), {
      hostnames: expectedHostnames.map(({ hostname }) => hostname),
      parentDomain,
    });
  }
};

const buildAcceptanceServiceCheck = async (env: NodeJS.ProcessEnv): Promise<DoctorCheck> => {
  try {
    const output = await readRemoteStackEvidence(env);
    return toDoctorCheck('acceptance-services', 'ok', 'remote_services_visible', 'Remote-Service-Status konnte abgefragt werden.', {
      channel: output.channel,
      summary: output.summary,
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

const buildAcceptanceIngressConsistencyCheck = async (env: NodeJS.ProcessEnv): Promise<DoctorCheck> => {
  try {
    const evidence = await readRemoteStackEvidence(env);
    const stackName = getConfiguredStackName(env);
    const baseUrl = env.SVA_PUBLIC_BASE_URL ?? 'https://studio.smart-village.app';
    const hasRunningAppTask = evidence.hasRunningService(getRemoteAppServiceName(env));
    const live = await checkHttpHealth(new URL('/health/live', baseUrl).toString());

    if (hasRunningAppTask && !live.response.ok) {
      return toDoctorCheck(
        'acceptance-ingress-consistency',
        'error',
        'remote_app_ingress_inconsistent',
        'Swarm meldet einen laufenden App-Task, aber der externe Live-Endpoint ist nicht gesund.',
        {
          baseUrl,
          channel: evidence.channel,
          liveStatus: live.response.status,
          stackName,
        }
      );
    }

    return toDoctorCheck(
      'acceptance-ingress-consistency',
      'ok',
      'remote_app_ingress_consistent',
      'Swarm-Task-Status und externer Live-Endpoint sind konsistent.',
      {
        baseUrl,
        channel: evidence.channel,
        liveStatus: live.response.status,
        stackName,
      }
    );
  } catch (error) {
    return toDoctorCheck(
      'acceptance-ingress-consistency',
      'warn',
      'remote_app_ingress_probe_failed',
      error instanceof Error ? error.message : String(error)
    );
  }
};

const isExpectedOidcRedirect = (location: string, env: NodeJS.ProcessEnv) => {
  if (location.length === 0) {
    return false;
  }

  const authIssuer = env.SVA_AUTH_ISSUER?.trim();
  if (authIssuer && location.startsWith(authIssuer)) {
    return true;
  }

  const keycloakAdminBaseUrl = env.KEYCLOAK_ADMIN_BASE_URL?.trim();
  if (keycloakAdminBaseUrl && location.startsWith(`${keycloakAdminBaseUrl.replace(/\/+$/u, '')}/realms/`)) {
    return true;
  }

  return location.includes('/realms/') && location.includes('/protocol/openid-connect/auth');
};

const buildAcceptancePostgresCheck = (env: NodeJS.ProcessEnv) => {
  const postgresUser = env.POSTGRES_USER ?? 'sva';
  const postgresDb = env.POSTGRES_DB ?? 'sva_studio';

  return toDoctorCheck(
    'postgres-health',
    'skipped',
    'postgres_health_deferred',
    `Remote-Postgres wird im Standardpfad nicht mehr ueber quantum-cli exec geprueft; massgeblich sind Swarm-Service-Sicht, /health/ready und Bootstrap-/Schema-Evidenz (${postgresUser}@${postgresDb}).`,
  );
};

const runLocalGooseStatus = (env: NodeJS.ProcessEnv) =>
  runLocalGooseStatusWithDeps({ rootDir, runCapture: runCaptureForRoot }, gooseConfig, env);

const resolveRemoteInternalNetworkName = async (env: NodeJS.ProcessEnv) => {
  const stackName = getConfiguredStackName(env);
  const liveContract = await inspectRemoteServiceContract(
    {
      commandExists,
      runCapture,
    },
    env,
    {
      quantumEndpoint: getConfiguredQuantumEndpoint(env),
      serviceName: getRemoteAppServiceName(env),
      stackName,
    },
  );

  const internalCandidates = (liveContract?.networkNames ?? []).filter((networkName) => networkName !== 'public');
  const internalNetworkName = internalCandidates[0]?.trim();
  if (internalNetworkName) {
    return internalNetworkName;
  }

  throw new Error(
    `Internes Overlay-Netz fuer ${stackName}_app konnte nicht aus der Live-Service-Spec abgeleitet werden.`,
  );
};

const runMigrationJobAgainstAcceptance = async (
  env: NodeJS.ProcessEnv,
  runtimeProfile: RemoteRuntimeProfile,
  reportId: string,
) =>
  runMigrationJobAgainstAcceptanceWithDeps(
    {
      commandExists: commandExistsForRoot,
      rootDir,
      run: runForRoot,
      runCapture: runCaptureForRoot,
      runCaptureDetailed: runCaptureDetailedForRoot,
      spawnBackground: spawnBackgroundForRoot,
      wait,
    },
    env,
    {
      internalNetworkName: await resolveRemoteInternalNetworkName(env),
      quantumEndpoint: getConfiguredQuantumEndpoint(env),
      remoteComposeFile: getRemoteComposeFile(env),
      reportId,
      runtimeProfile,
      sourceStackName: getConfiguredStackName(env),
    },
  );

const runBootstrapJobAgainstAcceptance = async (
  env: NodeJS.ProcessEnv,
  runtimeProfile: RemoteRuntimeProfile,
  reportId: string,
) =>
  runBootstrapJobAgainstAcceptanceWithDeps(
    {
      commandExists: commandExistsForRoot,
      rootDir,
      run: runForRoot,
      runCapture: runCaptureForRoot,
      runCaptureDetailed: runCaptureDetailedForRoot,
      spawnBackground: spawnBackgroundForRoot,
      wait,
    },
    env,
    {
      internalNetworkName: await resolveRemoteInternalNetworkName(env),
      quantumEndpoint: getConfiguredQuantumEndpoint(env),
      remoteComposeFile: getRemoteComposeFile(env),
      reportId,
      runtimeProfile,
      sourceStackName: getConfiguredStackName(env),
    },
  );

const buildMigrationStatusCheck = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): DoctorCheck => {
  const migrationStatusRequired = isMigrationStatusCheckRequired(runtimeProfile, env);

  try {
    if (isRemoteRuntimeProfile(runtimeProfile)) {
      return toDoctorCheck(
        'migration-status',
        migrationStatusRequired ? 'warn' : 'skipped',
        'remote_goose_status_disabled',
        'Remote-Goose-Status wird nicht mehr ueber quantum-cli exec abgefragt; Schema-Guard und Job-Exit-Codes sind autoritativ.',
      );
    }

    const result = runLocalGooseStatus(env);
    return toDoctorCheck(
      'migration-status',
      'ok',
      'goose_status_ok',
      'Goose-Migrationsstatus konnte abgefragt werden.',
      {
        gooseVersion: result.version,
        summary: result.summary,
      }
    );
  } catch (error) {
    if (!migrationStatusRequired) {
      return toDoctorCheck(
        'migration-status',
        'skipped',
        'migration_status_optional',
        'Remote-Goose-Status ist fuer dieses Runtime-Profil optional und blockiert die fruehe Studio-Testphase nicht.',
        {
          gooseVersion: getGooseConfiguredVersion(),
          reason: error instanceof Error ? error.message : String(error),
        }
      );
    }

    return toDoctorCheck(
      'migration-status',
      isRemoteRuntimeProfile(runtimeProfile) ? 'warn' : 'error',
      isRemoteRuntimeProfile(runtimeProfile) ? 'goose_status_unavailable' : 'goose_status_failed',
      error instanceof Error ? error.message : String(error),
      {
        gooseVersion: getGooseConfiguredVersion(),
      }
    );
  }
};

const precheckAcceptance = async (
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
  options?: AcceptanceDeployOptions
): Promise<DoctorReport> => {
  const checks: DoctorCheck[] = [];
  const validation = validateRuntimeProfileEnv(runtimeProfile, env);
  const runtimeContract = getRuntimeContractSummary(runtimeProfile, env);

  if (validation.missing.length > 0 || validation.placeholders.length > 0 || validation.invalid.length > 0) {
    checks.push(
      toDoctorCheck(
        'runtime-env',
        'error',
        'runtime_env_invalid',
        'Remote-Profil ist nicht vollstaendig konfiguriert.',
        {
          derived: validation.derived,
          effectiveSummary: runtimeContract,
          invalid: validation.invalid,
          missing: validation.missing,
          placeholders: validation.placeholders,
          derivedKeys: getRuntimeProfileDerivedEnvKeys(runtimeProfile),
          requiredKeys: getRuntimeProfileRequiredEnvKeys(runtimeProfile),
        }
      )
    );
  } else {
    checks.push(
      toDoctorCheck('runtime-env', 'ok', 'runtime_env_valid', 'Remote-Profil ist vollstaendig konfiguriert.', {
        derived: validation.derived,
        effectiveSummary: runtimeContract,
        derivedKeys: getRuntimeProfileDerivedEnvKeys(runtimeProfile),
        requiredKeys: getRuntimeProfileRequiredEnvKeys(runtimeProfile),
      })
    );
  }

  checks.push(buildImagePlatformDoctorCheck(env, options));
  checks.push(await buildAcceptanceServiceCheck(env));
  checks.push(await buildAcceptanceIngressConsistencyCheck(env));
  checks.push(await buildLiveRuntimeEnvCheck(runtimeProfile, env));
  checks.push(await buildAppPrincipalReadinessCheck(env));
  checks.push(await buildObservabilityDoctorCheck(runtimeProfile, env));
  checks.push(await buildTenantAuthProofCheck(env));
  checks.push(buildAcceptancePostgresCheck(env));
  checks.push(buildMigrationStatusCheck(runtimeProfile, env));
  checks.push(buildSchemaGuardCheck(runtimeProfile, env));
  checks.push(buildInstanceAuthConfigCheck(runtimeProfile, env));
  checks.push(buildTenantAdminClientContractCheck(runtimeProfile, env));
  checks.push(buildInstanceHostnameMappingCheck(runtimeProfile, env));
  if (options) {
    checks.push(await buildAcceptanceLiveSpecCheck(runtimeProfile, env, options));
  }

  return finalizeDoctorReport(runtimeProfile, checks);
};

const doctorRuntime = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): Promise<DoctorReport> => {
  const checks: DoctorCheck[] = [];
  const validation = validateRuntimeProfileEnv(runtimeProfile, env);
  const runtimeContract = getRuntimeContractSummary(runtimeProfile, env);

  if (validation.missing.length > 0 || validation.placeholders.length > 0 || validation.invalid.length > 0) {
    checks.push(
      toDoctorCheck(
        'runtime-env',
        'error',
        'runtime_env_invalid',
        'Runtime-Profil ist nicht vollstaendig konfiguriert.',
        {
          derived: validation.derived,
          effectiveSummary: runtimeContract,
          invalid: validation.invalid,
          missing: validation.missing,
          placeholders: validation.placeholders,
          derivedKeys: getRuntimeProfileDerivedEnvKeys(runtimeProfile),
          requiredKeys: getRuntimeProfileRequiredEnvKeys(runtimeProfile),
        }
      )
    );
  } else {
    checks.push(
      toDoctorCheck('runtime-env', 'ok', 'runtime_env_valid', 'Runtime-Profil ist vollstaendig konfiguriert.', {
        derived: validation.derived,
        effectiveSummary: runtimeContract,
        derivedKeys: getRuntimeProfileDerivedEnvKeys(runtimeProfile),
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

  if (isMainserverCheckRequired(runtimeProfile, env)) {
    try {
      await assertMainserverSmoke(env);
      checks.push(toDoctorCheck('mainserver', 'ok', 'mainserver_ok', 'Mainserver-OAuth und GraphQL sind erreichbar.'));
    } catch (error) {
      checks.push(toDoctorCheck('mainserver', 'error', 'mainserver_failed', error instanceof Error ? error.message : String(error)));
    }
  } else {
    checks.push(
      toDoctorCheck(
        'mainserver',
        'skipped',
        'mainserver_optional',
        'Mainserver-Smoke ist fuer dieses Runtime-Profil optional und blockiert die Studio-Einrichtung nicht.'
      )
    );
  }

  if (getRuntimeProfileDefinition(runtimeProfile).isLocal) {
    try {
      await assertOtelLocal(env);
      checks.push(toDoctorCheck('otel', 'ok', 'otel_ok', 'Lokaler OTEL-Collector ist erreichbar.'));
    } catch (error) {
      checks.push(toDoctorCheck('otel', 'error', 'otel_failed', error instanceof Error ? error.message : String(error)));
    }
  } else {
    checks.push(await buildAcceptanceServiceCheck(env));
  }
  if (isRemoteRuntimeProfile(runtimeProfile)) {
    checks.push(await buildAppPrincipalReadinessCheck(env));
  }
  checks.push(await buildObservabilityDoctorCheck(runtimeProfile, env));
  if (isRemoteRuntimeProfile(runtimeProfile)) {
    checks.push(await buildTenantAuthProofCheck(env));
  }

  checks.push(buildFeatureFlagCheck(env));
  checks.push(buildMigrationStatusCheck(runtimeProfile, env));
  checks.push(buildSchemaGuardCheck(runtimeProfile, env));
  if (runtimeProfile !== 'local-builder') {
    checks.push(buildInstanceAuthConfigCheck(runtimeProfile, env));
    checks.push(buildTenantAdminClientContractCheck(runtimeProfile, env));
    checks.push(buildInstanceHostnameMappingCheck(runtimeProfile, env));
  }
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

  if (response.status !== 302 || !isExpectedOidcRedirect(location, env)) {
    throw new Error(`OIDC-Login redirect stimmt nicht. Erhalten ${location}`);
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

const assertAcceptanceContainerHealth = async (env: NodeJS.ProcessEnv) => {
  const stackName = getConfiguredStackName(env);
  const services =
    (env.ENABLE_OTEL?.trim() || 'true').toLowerCase() === 'false'
      ? ['app', 'redis', 'postgres']
      : ['app', 'redis', 'postgres', 'otel-collector'];

  try {
    const evidence = await readRemoteStackEvidence(env);
    for (const service of services) {
      if (!evidence.hasRunningService(service)) {
        throw new Error(`Remote-Service fuer ${service} nicht gefunden.`);
      }
    }
    return;
  } catch {
    // Fallback below.
  }

  if (commandExists('quantum-cli')) {
    const quantumEndpoint = getConfiguredQuantumEndpoint(env);
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
  if (isMainserverCheckRequired(runtimeProfile, env)) {
    await assertMainserverSmoke(env);
  }

  if (getRuntimeProfileDefinition(runtimeProfile).isLocal) {
    await assertOtelLocal(env);
  } else {
    await assertAcceptanceContainerHealth(env);
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
      reconcileLocalInstanceRegistry(runtimeProfile, env);
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
      reconcileLocalInstanceRegistry(runtimeProfile, env);
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

const migrateAcceptance = async (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => {
  const migrationFiles = listGooseMigrationFiles();

  if (migrationFiles.length === 0) {
    throw new Error('Keine Goose-Migrationen unter packages/data/migrations gefunden.');
  }

  const migrationResult = await runMigrationJobAgainstAcceptance(env, runtimeProfile, `manual-${Date.now()}`);
  try {
    console.log(`Swarm-Migrationsjob fuer ${runtimeProfile}: ${migrationResult.jobStackName}/${migrationResult.jobServiceName}`);
    if (migrationResult.logTail) {
      console.log(migrationResult.logTail);
    }
  } finally {
    await migrationResult.cleanup();
  }

  const bootstrapResult = await runBootstrapJobAgainstAcceptance(env, runtimeProfile, `manual-${Date.now()}`);
  try {
    console.log(`Swarm-Bootstrap-Job fuer ${runtimeProfile}: ${bootstrapResult.jobStackName}/${bootstrapResult.jobServiceName}`);
    if (bootstrapResult.logTail) {
      console.log(bootstrapResult.logTail);
    }
  } finally {
    await bootstrapResult.cleanup();
  }

  const hostnameCheck = buildInstanceHostnameMappingCheck(runtimeProfile, env);
  if (hostnameCheck.status !== 'ok') {
    throw new Error(hostnameCheck.message);
  }

  const schemaGuard = runSchemaGuard(runtimeProfile, env);
  if (!schemaGuard.ok) {
    throw new Error(`Kritische IAM-Schema-Drift nach Migration fuer ${runtimeProfile}: ${summarizeSchemaGuardFailures(schemaGuard)}`);
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
    throw new Error('quantum-cli ist fuer Remote-Operationen nicht verfuegbar.');
  }

  const stackName = getConfiguredStackName(env);
  const quantumEndpoint = getConfiguredQuantumEndpoint(env);

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
    'status=0',
    `psql -X -P pager=off -q -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(database)} -f /tmp/sva-runtime-reset.sql >/tmp/sva-runtime-reset.log 2>&1 || status=$?`,
    `printf '%s\\n' '${marker}_START'`,
    "if [ -f /tmp/sva-runtime-reset.log ]; then cat /tmp/sva-runtime-reset.log; fi",
    "printf 'sql_exit:%s\\n' \"$status\"",
    `printf '%s\\n' '${marker}_END'`,
    'rm -f /tmp/sva-runtime-reset.sql /tmp/sva-runtime-reset.log',
    'if [ "$status" -ne 0 ]; then exit "$status"; fi',
    'sleep 1',
  ].join('\n');

  return runAcceptanceServiceScript(env, env.SVA_ACCEPTANCE_POSTGRES_SERVICE ?? 'postgres', remoteScript, {
    marker,
    slot: env.SVA_ACCEPTANCE_POSTGRES_SLOT ?? '1',
    failureMessage,
  });
};

const resetAcceptance = async (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => {
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

  await migrateAcceptance(runtimeProfile, env);

  const schemaGuard = runSchemaGuard(runtimeProfile, env);
  if (!schemaGuard.ok) {
    throw new Error(`Kritische IAM-Schema-Drift nach Reset fuer ${runtimeProfile}: ${summarizeSchemaGuardFailures(schemaGuard)}`);
  }
};

const captureAcceptanceStackStatus = async (env: NodeJS.ProcessEnv) => {
  const stackName = getConfiguredStackName(env);

  try {
    try {
      const evidence = await readRemoteStackEvidence(env);
      return {
        services: evidence.services ?? evidence.summary,
        tasks: evidence.tasks ?? evidence.summary,
      };
    } catch {
      // Fallbacks below.
    }

    if (commandExists('quantum-cli')) {
      try {
        const quantumEndpoint = getConfiguredQuantumEndpoint(env);
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
  runtimeProfile: RemoteRuntimeProfile,
  options: AcceptanceDeployOptions
): AcceptanceReleaseManifest => ({
  actor: options.actor,
  commitSha: getGitCommitSha(),
  imageDigest: options.imageDigest,
  imageRef: options.imageRef,
  imageRepository: options.imageRepository,
  imageTag: options.imageTag,
  monitoringConfigImageTag: options.monitoringConfigImageTag,
  profile: runtimeProfile,
  releaseMode: options.releaseMode,
  workflow: options.workflow,
});

const writeJsonArtifact = (filePath: string, payload: unknown) => {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const renderRemoteComposeDocument = (env: NodeJS.ProcessEnv): ComposeDocument =>
  JSON.parse(runCapture('docker', ['compose', '-f', resolve(rootDir, getRemoteComposeFile(env)), 'config', '--format', 'json'], env)) as ComposeDocument;

const renderQuantumDeployProject = (env: NodeJS.ProcessEnv) => {
  const runtimeProfile = env.SVA_RUNTIME_PROFILE?.trim() || 'studio';
  const renderedComposeDocument = renderRemoteComposeDocument(env);
  assertComposeServiceNetworks(renderedComposeDocument, 'app', ['internal', 'public']);
  assertComposeServiceIngressLabels(renderedComposeDocument, 'app');
  const renderedCompose = JSON.stringify(buildQuantumDeployComposeDocument(renderedComposeDocument), null, 2);
  const projectDir = mkdtempSync(resolve(tmpdir(), `sva-studio-${runtimeProfile}-deploy-`));
  const renderedComposePath = resolve(projectDir, 'docker-compose.rendered.json');
  const quantumProjectPath = resolve(projectDir, '.quantum');

  writeFileSync(renderedComposePath, `${renderedCompose}\n`, 'utf8');
  writeFileSync(
    quantumProjectPath,
    [
      '---',
      'version: "1.0"',
      'compose: docker-compose.rendered.json',
      'environments:',
      `  - name: ${runtimeProfile}`,
      '    compose: docker-compose.rendered.json',
      '',
    ].join('\n'),
    'utf8'
  );

  return {
    projectDir,
    cleanup: () => rmSync(projectDir, { force: true, recursive: true }),
  };
};

const getRemoteAppServiceName = (env: NodeJS.ProcessEnv) =>
  env.SVA_REMOTE_APP_SERVICE?.trim() || env.SVA_ACCEPTANCE_APP_SERVICE?.trim() || 'app';

const deployAcceptanceStack = (env: NodeJS.ProcessEnv) => {
  const stackName = getConfiguredStackName(env);

  if (commandExists('quantum-cli')) {
    const renderedProject = renderQuantumDeployProject(env);
    const commandArgs = [
      'stacks',
      'update',
      ...(env.QUANTUM_ENVIRONMENT?.trim() ? ['--environment', env.QUANTUM_ENVIRONMENT.trim()] : []),
      '--endpoint',
      getConfiguredQuantumEndpoint(env),
      '--stack',
      stackName,
      '--wait',
      ...(shouldSkipQuantumPrePull(env) ? ['--no-pre-pull'] : []),
      '--project',
      renderedProject.projectDir,
    ];
    try {
      run('quantum-cli', commandArgs, withoutDebugEnv(env));
      return;
    } finally {
      renderedProject.cleanup();
    }
  }

  run('docker', ['stack', 'deploy', '-c', getRemoteComposeFile(env), stackName], env);
};

const writeAcceptanceDeployReport = (report: AcceptanceDeployReport) => {
  writeJsonArtifact(report.artifacts.jsonPath, report);
  writeFileSync(report.artifacts.markdownPath, `${formatAcceptanceDeployReportMarkdown(report)}\n`, 'utf8');
  writeJsonArtifact(report.artifacts.releaseManifestPath, report.releaseManifest);
  writeJsonArtifact(report.artifacts.phaseReportPath, {
    bootstrapReport: report.bootstrapReport ?? { status: 'skipped' },
    failureCategory: report.failureCategory ?? null,
    generatedAt: report.generatedAt,
    migrationReport: report.migrationReport ?? { status: 'skipped' },
    releaseDecision: report.releaseDecision,
    steps: report.steps,
  });
  writeJsonArtifact(report.artifacts.bootstrapJobPath, report.bootstrapReport?.job ?? null);
  writeJsonArtifact(report.artifacts.bootstrapReportPath, report.bootstrapReport ?? { status: 'skipped' });
  writeJsonArtifact(report.artifacts.migrationJobPath, report.migrationReport?.job ?? null);
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
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions,
  migrationFiles: readonly string[]
): AcceptanceDeployReport => {
  const generatedAt = new Date().toISOString();
  const reportPaths = buildAcceptanceReportPaths(deployReportDir, options.reportSlug, generatedAt);
  const releaseManifest = buildAcceptanceReleaseManifest(runtimeProfile, options);

  return {
    profile: runtimeProfile,
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
    stackName: getConfiguredStackName(env),
    observability: {
      grafanaUrl: options.grafanaUrl,
      lokiUrl: options.lokiUrl,
      notes: [
        'Logs und Metriken bleiben intern; die Referenzen sind fuer Incident- und Release-Evidenz gedacht.',
      ],
    },
    runtimeContract: {
      derivedKeys: getRuntimeProfileDerivedEnvKeys(runtimeProfile),
      effectiveSummary: getRuntimeContractSummary(runtimeProfile, env),
      requiredKeys: getRuntimeProfileRequiredEnvKeys(runtimeProfile),
    },
    steps: [],
    artifacts: {
      bootstrapJobPath: reportPaths.bootstrapJobPath,
      bootstrapReportPath: reportPaths.bootstrapReportPath,
      jsonPath: reportPaths.jsonPath,
      markdownPath: reportPaths.markdownPath,
      releaseManifestPath: reportPaths.releaseManifestPath,
      phaseReportPath: reportPaths.phaseReportPath,
      migrationJobPath: reportPaths.migrationJobPath,
      migrationReportPath: reportPaths.migrationReportPath,
      internalVerifyPath: reportPaths.internalVerifyPath,
      externalSmokePath: reportPaths.externalSmokePath,
    },
  };
};

const buildAcceptanceLiveSpecCheck = async (
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions
): Promise<DoctorCheck> => {
  const renderedCompose = renderRemoteComposeDocument(env);
  const expectedAppContract = assertComposeServiceNetworks(renderedCompose, 'app', ['internal', 'public']);
  assertComposeServiceIngressLabels(renderedCompose, 'app');
  const expected = {
    derivedKeys: getRuntimeProfileDerivedEnvKeys(runtimeProfile),
    effectiveSummary: getRuntimeContractSummary(runtimeProfile, env),
    imageRef: options.imageRef,
    expectedAppNetworks: expectedAppContract.networks,
    expectedIngressLabels: Object.fromEntries(
      Object.entries(expectedAppContract.labels).filter(([key]) => key.startsWith('traefik.')),
    ),
    requiredKeys: getRuntimeProfileRequiredEnvKeys(runtimeProfile),
  };

  try {
    const stackName = getConfiguredStackName(env);
    const quantumEndpoint = getConfiguredQuantumEndpoint(env);
    const liveContractPromise = inspectRemoteServiceContract(
      {
        commandExists,
        runCapture,
      },
      env,
      {
        quantumEndpoint,
        serviceName: 'app',
        stackName,
      },
    );
    const liveContractResult = runCaptureDetailed('docker', ['service', 'inspect', `${stackName}_app`, '--format', '{{.Spec.TaskTemplate.ContainerSpec.Image}}'], env);
    const fallbackLiveImage = liveContractResult.status === 0 ? liveContractResult.stdout.trim() : '';
    const liveContract = await liveContractPromise;
    const liveImage = liveContract?.image ?? fallbackLiveImage;
    const liveEnv = liveContract?.env ?? ({} as Record<string, string>);
    const configDrift = RUNTIME_CONTRACT_COMPARISON_KEYS.filter((key) => (env[key]?.trim() || '') !== (liveEnv[key]?.trim() || ''));
    const missingSecretKeys = RUNTIME_CONTRACT_SECRET_PRESENCE_KEYS.filter((key) => (liveEnv[key]?.trim() || '').length === 0);
    const liveNetworks = [...(liveContract?.networkNames ?? [])].sort();
    const expectedNetworks = [...expectedAppContract.networks].sort();
    const missingNetworks = expectedNetworks.filter((networkName) => !liveNetworks.includes(networkName));
    const missingIngressLabels = Object.entries(expected.expectedIngressLabels).filter(
      ([key, value]) => liveContract?.labels[key] !== value,
    );

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
      liveImage === options.imageRef &&
        configDrift.length === 0 &&
        missingSecretKeys.length === 0 &&
        missingNetworks.length === 0 &&
        missingIngressLabels.length === 0
        ? 'ok'
        : 'warn',
      liveImage === options.imageRef &&
        configDrift.length === 0 &&
        missingSecretKeys.length === 0 &&
        missingNetworks.length === 0 &&
        missingIngressLabels.length === 0
        ? 'live_spec_matches'
        : 'live_spec_differs',
      liveImage === options.imageRef &&
        configDrift.length === 0 &&
        missingSecretKeys.length === 0 &&
        missingNetworks.length === 0 &&
        missingIngressLabels.length === 0
        ? 'Live-Service-Spec entspricht dem Zielartefakt und dem Studio-Runtime-Contract.'
        : 'Live-Service-Spec weicht beim Image, Runtime-Contract oder bei ingress-relevanten Service-Feldern ab.',
      {
        ...expected,
        configDrift,
        liveImage,
        liveNetworks,
        missingIngressLabels: missingIngressLabels.map(([key]) => key),
        missingNetworks,
        missingSecretKeys,
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
  headers?: HeadersInit;
  name: string;
  scope: AcceptanceProbeResult['scope'];
  target: string;
}) => {
  const startedAt = Date.now();

  try {
    const response = await fetch(input.target, {
      headers: input.headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
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

const buildAppPrincipalReadinessCheck = async (env: NodeJS.ProcessEnv): Promise<DoctorCheck> => {
  const baseUrl = env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const appDbUser = env.APP_DB_USER?.trim() || 'sva_app';

  try {
    const ready = await checkHttpHealth(new URL('/health/ready', baseUrl).toString());
    const payload = (ready.payload ?? {}) as {
      checks?: {
        auth?: { realm?: string };
        db?: boolean;
        errors?: Record<string, unknown>;
        keycloak?: boolean;
        redis?: boolean;
      };
    };
    const checks = payload.checks ?? {};

    if (ready.response.ok && checks.db === true && checks.redis === true && checks.keycloak === true) {
      return toDoctorCheck(
        'app-db-principal',
        'ok',
        'app_db_principal_ready',
        'Die laufende App bestaetigt Registry-/Auth-Readiness aus Sicht des Runtime-DB-Users.',
        {
          appDbUser,
          authRealm: checks.auth?.realm,
          status: ready.response.status,
        },
      );
    }

    return toDoctorCheck(
      'app-db-principal',
      'error',
      'app_db_principal_not_ready',
      'Die laufende App meldet Registry-/Auth- oder Datenbank-Readiness nicht stabil.',
      {
        appDbUser,
        payload,
        status: ready.response.status,
      },
    );
  } catch (error) {
    return toDoctorCheck(
      'app-db-principal',
      'error',
      'app_db_principal_check_failed',
      error instanceof Error ? error.message : String(error),
      {
        appDbUser,
      },
    );
  }
};

const tryReuseLiveParityEvidence = async (
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions,
): Promise<readonly AcceptanceProbeResult[] | null> => {
  const liveContract = await inspectRemoteServiceContract(
    {
      commandExists,
      runCapture,
    },
    env,
    {
      quantumEndpoint: getConfiguredQuantumEndpoint(env),
      serviceName: getRemoteAppServiceName(env),
      stackName: getConfiguredStackName(env),
    },
  );

  if (liveContract?.image !== options.imageRef) {
    return null;
  }

  const reusedChecks = await collectRemoteParityChecks(runtimeProfile, env);
  return buildRemoteParityReuseProbe(reusedChecks, liveContract.image, options.imageRef);
};

const collectRemoteParityChecks = async (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => {
  const startedAt = Date.now();
  const reusedChecks = await Promise.all([
    buildAcceptanceIngressConsistencyCheck(env),
    buildAppPrincipalReadinessCheck(env),
    buildTenantAuthProofCheck(env),
    buildLiveRuntimeEnvCheck(runtimeProfile, env),
  ]);
  const failingChecks = reusedChecks.filter((check) => check.status === 'error');
  if (failingChecks.length > 0) {
    throw new Error(
      `Live-Paritaet fuer bereits laufenden Ziel-Digest ist nicht gesund: ${failingChecks.map((check) => `${check.name}: ${check.message}`).join('; ')}`,
    );
  }

  return {
    durationMs: Date.now() - startedAt,
    checks: reusedChecks,
  };
};

const buildRemoteParityReuseProbe = (
  reusedChecks: Awaited<ReturnType<typeof collectRemoteParityChecks>>,
  liveImage: string,
  targetImage: string,
  messagePrefix = 'Ziel-Digest laeuft bereits live; prod-nahe Root-/Tenant-/APP-Principal-Paritaet wird ueber den laufenden Stack wiederverwendet.',
) => {
  return [
    createProbeResult({
      details: {
        liveImage,
        reusedChecks: reusedChecks.checks.map((check) => ({
          code: check.code,
          name: check.name,
          status: check.status,
        })),
      },
      durationMs: reusedChecks.durationMs,
      message: messagePrefix,
      name: 'image-live-parity-reuse',
      scope: 'image-smoke',
      status: 'ok',
      target: targetImage,
    }),
  ];
};

const buildImageSmokeRuntimeEnvEntries = async (env: NodeJS.ProcessEnv) => {
  const mergedEnv = { ...env } as Record<string, string | undefined>;
  delete mergedEnv.IAM_DATABASE_URL;
  delete mergedEnv.REDIS_URL;

  try {
    const liveContract = await inspectRemoteServiceContract(
      {
        commandExists,
        runCapture,
      },
      env,
      {
        quantumEndpoint: getConfiguredQuantumEndpoint(env),
        serviceName: getRemoteAppServiceName(env),
        stackName: getConfiguredStackName(env),
      },
    );
    if (liveContract) {
      for (const [key, value] of Object.entries(liveContract.env)) {
        if ((mergedEnv[key]?.trim() || '').length === 0 && value.trim().length > 0) {
          mergedEnv[key] = value;
        }
      }
    }
  } catch {
    // keep local env-only fallback if the live contract is unavailable
  }

  return Object.entries(mergedEnv)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => `${key}=${value}`);
};

const runLocalEmergencyHybridImageSmoke = async (
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions,
  reportId: string,
) => {
  ensureDirs();
  const smokePort = Number(env.SVA_IMAGE_SMOKE_PORT ?? '39080');
  const smokeBaseUrl = `http://host.docker.internal:${smokePort}`;
  const containerName = `${reportId}-image-smoke`.replace(/[^a-z0-9-]/giu, '-').toLowerCase();
  const envFilePath = resolve(runtimeArtifactsDir, `${containerName}.env`);
  const runtimeEnvEntries = await buildImageSmokeRuntimeEnvEntries(env);
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
        '--add-host',
        'host.docker.internal:host-gateway',
        '--env-file',
        envFilePath,
        '-e',
        `SVA_PUBLIC_BASE_URL=${smokeBaseUrl}`,
        '-p',
        `127.0.0.1:${smokePort}:3000`,
        options.imageRef,
      ],
      env
    );

    if (runResult.status !== 0) {
      throw new Error(runResult.stderr?.trim() || runResult.stdout.trim() || 'Image-Smoke-Container konnte nicht gestartet werden.');
    }

    await waitForContainerHttpOk(containerName, '/health/live', 60_000, env);
    const artifactProbe = await runContainerHttpProbe(containerName, '/health/live', env, {
      name: 'image-live',
      scope: 'image-smoke',
      target: `docker://${containerName}/health/live`,
      expect: (response) => (response.status === 200 ? null : `Erwartet HTTP 200, erhalten ${response.status}.`),
    });
    if (artifactProbe.status === 'error') {
      const logResult = runCaptureDetailed('docker', ['logs', containerName], env);
      const inspectResult = runCaptureDetailed('docker', ['inspect', containerName, '--format', '{{json .State}}'], env);
      throw new Error(
        `${artifactProbe.message}\nState: ${inspectResult.stdout.trim()}\n${logResult.stdout.trim() || logResult.stderr?.trim() || ''}`.trim(),
      );
    }

    const reusedChecks = await collectRemoteParityChecks(runtimeProfile, env);
    const hybridParityProbe = createProbeResult({
      details: {
        localEmergency: true,
        reusedChecks: reusedChecks.checks.map((check) => ({
          code: check.code,
          name: check.name,
          status: check.status,
        })),
      },
      durationMs: reusedChecks.durationMs,
      message:
        'Lokaler Notfallpfad: Artefakt-Startup wurde lokal bestaetigt; DB-/Redis-/Tenant-Paritaet wird fuer das noch nicht live laufende Ziel-Digest ueber den gesunden Studio-Stack wiederverwendet.',
      name: 'image-local-emergency-hybrid-parity',
      scope: 'image-smoke',
      status: 'ok',
      target: options.imageRef,
    });

    return [artifactProbe, hybridParityProbe] as const;
  } finally {
    try {
      runCaptureDetailed('docker', ['rm', '-f', containerName], env);
    } catch {
      // ignore cleanup failures
    }

    try {
      unlinkSync(envFilePath);
    } catch {
      // ignore cleanup failures
    }
  }
};

const waitForContainerHttpOk = async (
  containerName: string,
  path: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv,
) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = runCaptureDetailed(
      'docker',
      [
        'exec',
        containerName,
        'node',
        '-e',
        `fetch('http://127.0.0.1:3000${path}').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))`,
      ],
      env,
    );
    if (result.status === 0) {
      return;
    }
    await wait(1_000);
  }

  throw new Error(`Timeout waiting for container ${containerName} ${path}`);
};

const runContainerHttpProbe = async (
  containerName: string,
  path: string,
  env: NodeJS.ProcessEnv,
  input: {
    expect: (response: { ok: boolean; status: number }, payload: unknown) => string | null;
    name: string;
    scope: AcceptanceProbeResult['scope'];
    target: string;
  },
): Promise<AcceptanceProbeResult> => {
  const startedAt = Date.now();

  try {
    const script = [
      "const url = process.argv[1];",
      "fetch(url)",
      "  .then(async (response) => {",
      "    const text = await response.text();",
      '    process.stdout.write(JSON.stringify({ ok: response.ok, status: response.status, text }));',
      '  })',
      "  .catch((error) => {",
      "    console.error(error instanceof Error ? error.message : String(error));",
      '    process.exit(1);',
      '  });',
    ].join('');
    const result = runCaptureDetailed(
      'docker',
      ['exec', containerName, 'node', '-e', script, `http://127.0.0.1:3000${path}`],
      env,
    );

    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || result.stdout.trim() || 'Container-HTTP-Probe fehlgeschlagen.');
    }

    const rawPayload = result.stdout.trim();
    const parsed = JSON.parse(rawPayload) as { ok: boolean; status: number; text: string };
    let payload: unknown;

    try {
      payload = parsed.text.length > 0 ? JSON.parse(parsed.text) : null;
    } catch {
      payload = parsed.text;
    }

    const expectationError = input.expect({ ok: parsed.ok, status: parsed.status }, payload);
    return createProbeResult({
      durationMs: Date.now() - startedAt,
      httpStatus: parsed.status,
      message: expectationError ?? `Probe erfolgreich mit HTTP ${parsed.status}.`,
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
  const parsedRuntimeProfile = parseRuntimeProfile(env.SVA_RUNTIME_PROFILE ?? 'studio');
  if (!parsedRuntimeProfile || !isRemoteRuntimeProfile(parsedRuntimeProfile)) {
    throw new Error('image-smoke ist nur fuer Remote-Profile verfuegbar.');
  }
  const runtimeProfile = parsedRuntimeProfile;

  const reusedLiveEvidence = await tryReuseLiveParityEvidence(runtimeProfile, env, options);
  if (reusedLiveEvidence) {
    return reusedLiveEvidence;
  }

  if (!commandExists('docker')) {
    throw new Error('docker ist fuer image-smoke nicht verfuegbar.');
  }

  if (hasLocalEmergencyRemoteMutationOverride(env)) {
    return runLocalEmergencyHybridImageSmoke(runtimeProfile, env, options, reportId);
  }

  ensureDirs();
  const smokePort = Number(env.SVA_IMAGE_SMOKE_PORT ?? '39080');
  const smokeBaseUrl = `http://host.docker.internal:${smokePort}`;
  const containerName = `${reportId}-image-smoke`.replace(/[^a-z0-9-]/giu, '-').toLowerCase();
  const envFilePath = resolve(runtimeArtifactsDir, `${containerName}.env`);
  const runtimeEnvEntries = await buildImageSmokeRuntimeEnvEntries(env);
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
        '--add-host',
        'host.docker.internal:host-gateway',
        '--env-file',
        envFilePath,
        '-e',
        `SVA_PUBLIC_BASE_URL=${smokeBaseUrl}`,
        '-p',
        `127.0.0.1:${smokePort}:3000`,
        options.imageRef,
      ],
      env
    );

    if (runResult.status !== 0) {
      throw new Error(runResult.stderr?.trim() || runResult.stdout.trim() || 'Image-Smoke-Container konnte nicht gestartet werden.');
    }

    await waitForContainerHttpOk(containerName, '/health/live', 60_000, env);
    const parityPlan = buildProdParityProbePlan(env);
    const rootForwardedHeaders = buildTrustedForwardedHeaders(parityPlan.rootHost);

    const probes = await Promise.all([
      runContainerHttpProbe(containerName, '/health/live', env, {
        name: 'image-live',
        scope: 'image-smoke',
        target: `docker://${containerName}/health/live`,
        expect: (response) => (response.status === 200 ? null : `Erwartet HTTP 200, erhalten ${response.status}.`),
      }),
      runContainerHttpProbe(containerName, '/health/ready', env, {
        name: 'image-ready',
        scope: 'image-smoke',
        target: `docker://${containerName}/health/ready`,
        expect: (response, payload) =>
          response.status === 200
            ? null
            : `Prod-naher Kandidat ist nicht ready (${response.status}): ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
      }),
      runHttpProbe({
        headers: rootForwardedHeaders,
        name: 'image-root-auth-login',
        scope: 'image-smoke',
        target: `http://127.0.0.1:${smokePort}/auth/login`,
        expect: (response) => {
          const location = response.headers.get('location') ?? '';
          if (response.status !== 302) {
            return `Erwartet Redirect fuer Root-Auth, erhalten ${response.status}.`;
          }
          if (!isExpectedOidcRedirect(location, env)) {
            return `OIDC-Redirect stimmt nicht: ${location}`;
          }
          const configuredRedirectUri = env.SVA_AUTH_REDIRECT_URI?.trim();
          if (configuredRedirectUri && !location.includes(`redirect_uri=${encodeURIComponent(configuredRedirectUri)}`)) {
            return `Root-Redirect-URI stimmt nicht: ${location}`;
          }
          return null;
        },
      }),
      runHttpProbe({
        headers: rootForwardedHeaders,
        name: 'image-root-iam-context',
        scope: 'image-smoke',
        target: `http://127.0.0.1:${smokePort}/api/v1/iam/me/context`,
        expect: (response, payload) => {
          if (![200, 401, 403].includes(response.status)) {
            return `Unerwarteter IAM-Kontext-Status ${response.status}.`;
          }
          if (typeof payload === 'string' && payload.toLowerCase().includes('<html')) {
            return 'IAM-Kontext lieferte HTML statt API-Vertrag.';
          }
          return null;
        },
      }),
      ...parityPlan.tenantHosts.map(({ host, instanceId }) =>
        runHttpProbe({
          headers: buildTrustedForwardedHeaders(host),
          name: `image-tenant-auth-login-${instanceId}`,
          scope: 'image-smoke',
          target: `http://127.0.0.1:${smokePort}/auth/login`,
          expect: (response) => {
            const location = response.headers.get('location') ?? '';
            if (response.status !== 302) {
              return `Erwartet Redirect fuer Tenant ${instanceId}, erhalten ${response.status}.`;
            }
            if (!location.includes(`/realms/${instanceId}/`)) {
              return `Tenant-Realm stimmt nicht fuer ${instanceId}: ${location}`;
            }
            const expectedRedirectUri = `${new URL(env.SVA_PUBLIC_BASE_URL ?? 'https://studio.smart-village.app').protocol}//${host}/auth/callback`;
            if (!location.includes(`redirect_uri=${encodeURIComponent(expectedRedirectUri)}`)) {
              return `Tenant-Redirect-URI stimmt nicht fuer ${instanceId}: ${location}`;
            }
            return null;
          },
        }),
      ),
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

const buildSwarmAppTaskProbe = (env: NodeJS.ProcessEnv): AcceptanceProbeResult => {
  const startedAt = Date.now();
  const stackName = getConfiguredStackName(env);
  const appService = getRemoteAppServiceName(env);

  try {
    if (commandExists('quantum-cli')) {
      const quantumEndpoint = getConfiguredQuantumEndpoint(env);
      const result = runCaptureDetailed(
        'quantum-cli',
        ['ps', '--endpoint', quantumEndpoint, '--stack', stackName, '--service', appService, '--all', '-o', 'json'],
        withoutDebugEnv(env),
      );
      const combined = filterRemoteOutputLines(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
      const jsonPayload = extractQuantumJsonPayload(combined);
      const latestTask = jsonPayload
        ? selectLatestMigrationTask(collectQuantumTaskSnapshots(JSON.parse(jsonPayload) as unknown))
        : null;
      const normalizedState = latestTask?.state?.trim().toLowerCase();
      const isOk =
        normalizedState === 'running' &&
        (latestTask?.desiredState?.trim().toLowerCase() === 'running' || !latestTask?.desiredState);

      return createProbeResult({
        details: latestTask ?? undefined,
        durationMs: Date.now() - startedAt,
        message: isOk
          ? `Swarm-App-Task ist running (${latestTask?.taskId ?? 'n/a'}).`
          : `Swarm-App-Task ist nicht stabil running (${normalizedState ?? 'unbekannt'}).`,
        name: 'swarm-app-task',
        scope: 'internal',
        status: isOk ? 'ok' : 'error',
        target: `${stackName}/${appService}`,
      });
    }

    const serviceOutput = runCapture('docker', ['service', 'ps', `${stackName}_${appService}`, '--format', '{{.CurrentState}}']);
    const firstState = serviceOutput
      .split('\n')
      .map((entry) => entry.trim())
      .find((entry) => entry.length > 0);
    const isOk = typeof firstState === 'string' && firstState.toLowerCase().startsWith('running');

    return createProbeResult({
      details: firstState ? { currentState: firstState } : undefined,
      durationMs: Date.now() - startedAt,
      message: isOk ? `Docker-Service ${stackName}_${appService} ist running.` : `Docker-Service-State: ${firstState ?? 'unbekannt'}.`,
      name: 'swarm-app-task',
      scope: 'internal',
      status: isOk ? 'ok' : 'error',
      target: `${stackName}/${appService}`,
    });
  } catch (error) {
    return createProbeResult({
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
      name: 'swarm-app-task',
      scope: 'internal',
      status: 'error',
      target: `${stackName}/${appService}`,
    });
  }
};

const buildSwarmServicePresenceProbe = (env: NodeJS.ProcessEnv): AcceptanceProbeResult => {
  const startedAt = Date.now();
  const requiredServices =
    (env.ENABLE_OTEL?.trim() || 'true').toLowerCase() === 'false'
      ? ['app', 'redis', 'postgres']
      : ['app', 'redis', 'postgres', 'otel-collector'];

  return createProbeResult({
    durationMs: Date.now() - startedAt,
    message: 'Swarm-Service-Praesenz wird im Acceptance-Deploy-Report separat erfasst.',
    name: 'swarm-services',
    scope: 'internal',
    status: 'ok',
    target: getConfiguredStackName(env),
    details: {
      requiredServices,
    },
  });
};

const runInternalVerify = async (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv): Promise<{
  doctorReport: DoctorReport;
  probes: readonly AcceptanceProbeResult[];
}> => {
  const maxAttempts = Number(env.SVA_INTERNAL_VERIFY_MAX_ATTEMPTS ?? '6');
  const retryDelayMs = Number(env.SVA_INTERNAL_VERIFY_RETRY_DELAY_MS ?? '5000');
  const retryableWarmupChecks = new Set([
    'health-live',
    'health-ready',
    'auth-login',
    'auth-me',
    'tenant-auth-proof',
    'app-db-principal',
  ]);
  const retryableWarmupSignals = ['404', '502', '503', '504', 'timeout', 'timed out', 'gateway'];
  let lastDoctorReport: DoctorReport | null = null;
  let lastProbes: AcceptanceProbeResult[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const doctorReport = await doctorRuntime(runtimeProfile, env);
    const probes = [buildSwarmServicePresenceProbe(env), buildSwarmAppTaskProbe(env)];

    lastDoctorReport = doctorReport;
    lastProbes = probes;

    const hasRetryableWarmupOnlyErrors = shouldRetryInternalVerify(
      doctorReport,
      retryableWarmupChecks,
      retryableWarmupSignals,
    );
    const probesFailed = probes.some((probe) => probe.status === 'error');
    const doctorFailed = doctorReport.status === 'error';

    if (!doctorFailed && !probesFailed) {
      return {
        doctorReport,
        probes,
      };
    }

    if (attempt < maxAttempts && (hasRetryableWarmupOnlyErrors || probesFailed)) {
      await wait(retryDelayMs);
      continue;
    }

    return {
      doctorReport,
      probes,
    };
  }

  return {
    doctorReport: lastDoctorReport ?? (await doctorRuntime(runtimeProfile, env)),
    probes: lastProbes,
  };
};

const checkContainsRetryableWarmupSignal = (check: DoctorCheck, retryableWarmupSignals: readonly string[]) => {
  const message = typeof check.message === 'string' ? check.message.toLowerCase() : '';
  if (retryableWarmupSignals.some((signal) => message.includes(signal))) {
    return true;
  }

  const details = check.details;
  if (!details) {
    return false;
  }

  const status = details.status;
  if (typeof status === 'number' && [404, 502, 503, 504].includes(status)) {
    return true;
  }

  const payload = details.payload;
  return typeof payload === 'string' && retryableWarmupSignals.some((signal) => payload.toLowerCase().includes(signal));
};

export const shouldRetryInternalVerify = (
  doctorReport: DoctorReport,
  retryableWarmupChecks: ReadonlySet<string> = new Set([
    'health-live',
    'health-ready',
    'auth-login',
    'auth-me',
    'tenant-auth-proof',
    'app-db-principal',
  ]),
  retryableWarmupSignals: readonly string[] = ['404', '502', '503', '504', 'timeout', 'timed out', 'gateway'],
) => {
  const failingChecks = doctorReport.checks.filter((check) => check.status === 'error');
  if (failingChecks.length === 0) {
    return false;
  }

  return failingChecks.every((check) => {
    if (!retryableWarmupChecks.has(check.name)) {
      return false;
    }

    return checkContainsRetryableWarmupSignal(check, retryableWarmupSignals);
  });
};

const runExternalSmoke = async (env: NodeJS.ProcessEnv): Promise<readonly AcceptanceProbeResult[]> => {
  const baseUrl = env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const base = new URL(baseUrl);
  const parentDomain = env.SVA_PARENT_DOMAIN?.trim();
  const tenantInstanceIds = (env.SVA_ALLOWED_INSTANCE_IDS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const tenantProbes = parentDomain
    ? tenantInstanceIds.map((instanceId) =>
        runHttpProbe({
          name: `public-auth-login-${instanceId}`,
          scope: 'external',
          target: new URL('/auth/login', `${base.protocol}//${instanceId}.${parentDomain}`).toString(),
          expect: (response) => {
            const location = response.headers.get('location') ?? '';
            if (response.status !== 302) {
              return `Erwartet Redirect fuer Tenant ${instanceId}, erhalten ${response.status}.`;
            }
            if (!location.includes(`/realms/${instanceId}/`)) {
              return `Tenant-Realm stimmt nicht fuer ${instanceId}: ${location}`;
            }
            const encodedRedirect = encodeURIComponent(`${base.protocol}//${instanceId}.${parentDomain}/auth/callback`);
            if (!location.includes(`redirect_uri=${encodedRedirect}`)) {
              return `Tenant-Redirect-URI stimmt nicht fuer ${instanceId}: ${location}`;
            }
            return null;
          },
        })
      )
    : [];

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
        if (!isExpectedOidcRedirect(location, env)) {
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
          if (typeof payload === 'string' && payload.toLowerCase().includes('<html')) {
            return 'IAM-Kontext lieferte HTML statt eines API-Vertrags.';
          }
          return null;
        }
        return `Unerwarteter IAM-Kontext-Status ${response.status}.`;
      },
    }),
    runHttpProbe({
      name: 'public-iam-instances',
      scope: 'external',
      target: new URL('/api/v1/iam/instances', baseUrl).toString(),
      expect: (response, payload) => {
        if ([200, 401, 403].includes(response.status)) {
          if (typeof payload === 'string' && payload.toLowerCase().includes('<html')) {
            return 'IAM-Instanzliste lieferte HTML statt JSON/API-Vertrag.';
          }
          return null;
        }
        return `Unerwarteter IAM-Instanzlisten-Status ${response.status}.`;
      },
    }),
    ...tenantProbes,
  ]);
};

const retryableExternalWarmupProbeNames = new Set([
  'public-home',
  'public-live',
  'public-ready',
  'public-auth-login',
  'public-auth-login-bb-guben',
  'public-auth-login-de-musterhausen',
]);

const retryableExternalWarmupSignals = ['404', '502', '503', '504', 'timeout', 'timed out', 'gateway'];

export const shouldRetryExternalSmoke = (probes: readonly AcceptanceProbeResult[]) => {
  const failingProbes = probes.filter((probe) => probe.status === 'error');
  if (failingProbes.length === 0) {
    return false;
  }

  return failingProbes.every((probe) => {
    if (!retryableExternalWarmupProbeNames.has(probe.name)) {
      return false;
    }

    const message = probe.message.toLowerCase();
    return retryableExternalWarmupSignals.some((signal) => message.includes(signal));
  });
};

export const runExternalSmokeWithWarmup = async (
  env: NodeJS.ProcessEnv,
  options?: {
    readonly maxAttempts?: number;
    readonly retryDelayMs?: number;
    readonly runner?: (env: NodeJS.ProcessEnv) => Promise<readonly AcceptanceProbeResult[]>;
  }
): Promise<readonly AcceptanceProbeResult[]> => {
  const retryDelayMs = options?.retryDelayMs ?? Number(env.SVA_EXTERNAL_SMOKE_RETRY_DELAY_MS ?? '15000');
  const warmupWindowMs = Number(env.SVA_EXTERNAL_SMOKE_WARMUP_WINDOW_MS ?? '300000');
  const derivedMaxAttempts = Math.max(1, Math.floor(warmupWindowMs / Math.max(retryDelayMs, 1)) + 1);
  const maxAttempts = options?.maxAttempts ?? Number(env.SVA_EXTERNAL_SMOKE_MAX_ATTEMPTS ?? String(derivedMaxAttempts));
  const runner = options?.runner ?? runExternalSmoke;
  let lastProbes: readonly AcceptanceProbeResult[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const probes = await runner(env);
    lastProbes = probes;

    if (!shouldRetryExternalSmoke(probes) || attempt >= maxAttempts) {
      return probes;
    }

    await wait(retryDelayMs);
  }

  return lastProbes;
};

const runAcceptanceDeploy = async (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => {
  const options = resolveAcceptanceDeployOptions(env, cliOptions, runtimeProfile);
  const mutationContext = assertDeterministicRemoteMutationContext(env, runtimeProfile, 'deploy');
  const migrationFiles = options.releaseMode === 'schema-and-app' ? listGooseMigrationFiles() : [];

  let report = createBaseAcceptanceDeployReport(runtimeProfile, env, options, migrationFiles);
  const steps: AcceptanceDeployStep[] = [];

  try {
    const precheckStartedAt = Date.now();
    const precheckReport = await precheckAcceptance(runtimeProfile, env, options);
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

    if (mutationContext.mode === 'local-operator') {
      steps.push(
        createStepResult(
          'image-smoke',
          Date.now(),
          'skipped',
          'Lokaler Operator-Pfad verwendet den bereits in GitHub verifizierten Digest und ueberspringt den lokalen image-smoke.'
        )
      );
    } else {
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
    }

    if (options.releaseMode === 'schema-and-app') {
      const migrateStartedAt = Date.now();
      try {
        const migrationResult = await runMigrationJobAgainstAcceptance(env, runtimeProfile, report.reportId);
        try {
          report = {
            ...report,
            migrationReport: {
              status: 'ok',
              startedAt: new Date(migrateStartedAt).toISOString(),
              completedAt: new Date().toISOString(),
              job: {
                durationMs: migrationResult.durationMs,
                exitCode: migrationResult.exitCode,
                jobServiceName: migrationResult.jobServiceName,
                jobStackName: migrationResult.jobStackName,
                logTail: migrationResult.logTail,
                state: migrationResult.state,
                taskId: migrationResult.taskId,
                taskMessage: migrationResult.taskMessage,
              },
              details: {
                gooseVersion: getGooseConfiguredVersion(),
                jobState: migrationResult.state,
              },
            },
          };
          steps.push(
            createStepResult('migrate', migrateStartedAt, 'ok', 'Acceptance-Migration erfolgreich abgeschlossen.', {
              jobServiceName: migrationResult.jobServiceName,
              jobStackName: migrationResult.jobStackName,
              maintenanceWindow: options.maintenanceWindow,
              migrationFiles,
            })
          );
        } finally {
          await migrationResult.cleanup();
        }
      } catch (error) {
        report = {
          ...report,
          migrationReport: {
            status: 'error',
            startedAt: new Date(migrateStartedAt).toISOString(),
            completedAt: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : String(error),
            details: {
              gooseVersion: getGooseConfiguredVersion(),
            },
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
          details: {
            gooseVersion: getGooseConfiguredVersion(),
          },
        },
      };
      steps.push(createStepResult('migrate', migrateStartedAt, 'skipped', 'Migrationen fuer app-only ausgelassen.'));
      const bootstrapStartedAt = Date.now();
      report = {
        ...report,
        bootstrapReport: {
          status: 'skipped',
        },
      };
      steps.push(createStepResult('bootstrap', bootstrapStartedAt, 'skipped', 'Bootstrap fuer app-only ausgelassen.'));
    }

    if (options.releaseMode === 'schema-and-app') {
      const bootstrapStartedAt = Date.now();
      try {
        const bootstrapResult = await runBootstrapJobAgainstAcceptance(env, runtimeProfile, report.reportId);
        try {
          const hostnameCheck = buildInstanceHostnameMappingCheck(runtimeProfile, env);
          if (hostnameCheck.status !== 'ok') {
            throw new Error(hostnameCheck.message);
          }
          const schemaGuard = runSchemaGuard(runtimeProfile, env);
          if (!schemaGuard.ok) {
            throw new Error(`Kritische IAM-Schema-Drift nach Bootstrap fuer ${runtimeProfile}: ${summarizeSchemaGuardFailures(schemaGuard)}`);
          }
          report = {
            ...report,
            bootstrapReport: {
              status: 'ok',
              startedAt: new Date(bootstrapStartedAt).toISOString(),
              completedAt: new Date().toISOString(),
              job: {
                durationMs: bootstrapResult.durationMs,
                exitCode: bootstrapResult.exitCode,
                jobServiceName: bootstrapResult.jobServiceName,
                jobStackName: bootstrapResult.jobStackName,
                logTail: bootstrapResult.logTail,
                state: bootstrapResult.state,
                taskId: bootstrapResult.taskId,
                taskMessage: bootstrapResult.taskMessage,
              },
              details: {
                hostnameMapping: hostnameCheck.message,
                jobState: bootstrapResult.state,
              },
            },
          };
          steps.push(
            createStepResult('bootstrap', bootstrapStartedAt, 'ok', 'Acceptance-Bootstrap erfolgreich abgeschlossen.', {
              jobServiceName: bootstrapResult.jobServiceName,
              jobStackName: bootstrapResult.jobStackName,
            }),
          );
        } finally {
          await bootstrapResult.cleanup();
        }
      } catch (error) {
        report = {
          ...report,
          bootstrapReport: {
            status: 'error',
            startedAt: new Date(bootstrapStartedAt).toISOString(),
            completedAt: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        };
        steps.push(
          createStepResult('bootstrap', bootstrapStartedAt, 'error', error instanceof Error ? error.message : String(error)),
        );
        report = {
          ...report,
          steps,
        };
        throw { category: 'bootstrap' as const, report };
      }
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
    const internalVerify = await runInternalVerify(runtimeProfile, env);
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
      const externalProbes = await runExternalSmokeWithWarmup(env);
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
      stackStatus: await captureAcceptanceStackStatus(env),
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
      stackStatus: await captureAcceptanceStackStatus(env),
    };
    writeAcceptanceDeployReport(failedReport);
    printJsonIfRequested(failedReport);
    throw new Error(`Acceptance-Deploy fehlgeschlagen (${category}). Bericht: ${failedReport.artifacts.markdownPath}`, {
      cause: error,
    });
  }
};

const runAcceptanceCommand = async (runtimeProfile: RemoteRuntimeProfile, runtimeCommand: RuntimeCommand) => {
  const env = applyCliOptionEnvOverrides(buildProfileEnv(runtimeProfile));
  const stackName = getConfiguredStackName(env);

  switch (runtimeCommand) {
    case 'up':
    case 'update':
      throw new Error(
        `Direkte Remote-Deploys ueber ${runtimeCommand} sind gesperrt. Nutze den kanonischen Pfad pnpm env:deploy:${runtimeProfile}.`
      );
    case 'down':
      assertDeterministicRemoteMutationContext(env, runtimeProfile, 'down');
      run('docker', ['stack', 'rm', stackName], env);
      console.log(`Stack ${stackName} entfernt.`);
      return;
    case 'status':
      assertRuntimeEnv(runtimeProfile, env);
      if (getRuntimeStatusExecutionMode(runtimeProfile) === 'remote') {
        const evidence = await readRemoteStackEvidence(env);
        console.log(evidence.summary);
        return;
      }

      run('docker', ['stack', 'services', stackName], env);
      run('docker', ['stack', 'ps', stackName], env);
      return;
    case 'precheck': {
      const report = await precheckAcceptance(runtimeProfile, env);
      printDoctorReport(report);
      if (report.status === 'error') {
        process.exitCode = 1;
      }
      return;
    }
    case 'deploy':
      assertRuntimeEnv(runtimeProfile, env);
      assertDeterministicRemoteMutationContext(env, runtimeProfile, 'deploy');
      env.QUANTUM_ENVIRONMENT = env.QUANTUM_ENVIRONMENT?.trim() || runtimeProfile;
      await runAcceptanceDeploy(runtimeProfile, env);
      return;
    case 'smoke':
      assertRuntimeEnv(runtimeProfile, env);
      await smokeRuntime(runtimeProfile, env);
      console.log(`Smoke-Checks fuer ${runtimeProfile} erfolgreich.`);
      return;
    case 'migrate':
      assertDeterministicRemoteMutationContext(env, runtimeProfile, 'migrate');
      await migrateAcceptance(runtimeProfile, env);
      console.log(`Migrationen fuer ${runtimeProfile} abgeschlossen.`);
      return;
    case 'reset':
      assertRuntimeEnv(runtimeProfile, env);
      assertDeterministicRemoteMutationContext(env, runtimeProfile, 'reset');
      await resetAcceptance(runtimeProfile, env);
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

  await runAcceptanceCommand(requireRemoteRuntimeProfile(runtimeProfile), runtimeCommand);
};

const entryScriptPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentScriptPath = fileURLToPath(import.meta.url);

if (entryScriptPath === currentScriptPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[runtime-env] ${message}`);
    process.exit(1);
  });
}
