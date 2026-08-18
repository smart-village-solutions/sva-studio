import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import {
  getMigrationJobTerminalState,
  readQuantumTaskSnapshot,
  readRemoteJobLogTail,
} from './migration-job.ts';
import { spawnBackground, wait, withoutDebugEnv } from './process.ts';
import {
  buildSuccessfulOneShotResult,
  createOneShotJobError,
  selectOneShotDiagnostic,
  withOneShotCleanupFailure,
} from './one-shot-job-lifecycle.ts';

type RunCapture = (
  rootDir: string,
  commandName: string,
  args: readonly string[],
  env?: NodeJS.ProcessEnv
) => string;
type RunCaptureDetailed = (
  rootDir: string,
  commandName: string,
  args: readonly string[],
  env?: NodeJS.ProcessEnv
) => {
  error?: Error;
  output: readonly (string | Buffer | null)[];
  pid: number;
  signal: NodeJS.Signals | null;
  status: number | null;
  stderr: string;
  stdout: string;
};
type Run = (
  rootDir: string,
  commandName: string,
  args: readonly string[],
  env?: NodeJS.ProcessEnv
) => void;
type CommandExists = (rootDir: string, commandName: string) => boolean;

type BootstrapJobDeps = {
  commandExists: CommandExists;
  rootDir: string;
  run: Run;
  runCapture: RunCapture;
  runCaptureDetailed: RunCaptureDetailed;
  spawnBackground: typeof spawnBackground;
  wait: typeof wait;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type ComposeDocument = {
  name?: string;
  networks?: Record<string, JsonValue>;
  secrets?: Record<string, JsonValue>;
  services?: Record<string, JsonValue>;
  version?: string;
  volumes?: Record<string, JsonValue>;
};

export type BootstrapJobResult = {
  cleanup: () => Promise<void>;
  completedAt: string;
  durationMs: number;
  exitCode?: number;
  jobServiceName: string;
  jobStackName: string;
  logTail: string;
  startedAt: string;
  state: string;
  taskId?: string;
  taskMessage?: string;
};

type RemoteComposeInput =
  | { remoteComposeFile: string; remoteComposeFiles?: never }
  | { remoteComposeFile?: never; remoteComposeFiles: readonly [string, ...string[]] };

export type RunBootstrapJobInput = RemoteComposeInput & {
  internalNetworkName: string;
  quantumEndpoint: string;
  reportId: string;
  runtimeProfile: string;
  sourceStackName: string;
};

const normalizeRenderedComposeForQuantum = (value: string) =>
  value.replace(/^name:\s.*\n/imu, '').replace(/^(\s*cpus:\s*)([0-9.]+)$/gmu, '$1"$2"');

const normalizeQuantumComposeValue = (value: JsonValue, parentKey?: string): JsonValue => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeQuantumComposeValue(entry, parentKey))
      .filter((entry): entry is Exclude<JsonValue, null> => entry !== null);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, JsonValue>;
  const preserveNullEntries = parentKey === 'networks';
  const normalizedEntries = Object.entries(record)
    .filter(([, entry]) => preserveNullEntries || entry !== null)
    .map(([key, entry]) => {
      if (key === 'cpus' && typeof entry === 'number') {
        return [key, String(entry)] as const;
      }
      return [key, normalizeQuantumComposeValue(entry, key)] as const;
    })
    .filter(([, entry]) => preserveNullEntries || entry !== null);

  return Object.fromEntries(normalizedEntries) as JsonValue;
};

const toTemporaryJobStackName = (
  sourceStackName: string,
  serviceName: string,
  reportId: string
) => {
  const sanitizedReportId = reportId
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 32);
  return `${sourceStackName}-${serviceName}-${sanitizedReportId || 'job'}`;
};

export const buildBootstrapJobComposeDocument = (
  renderedCompose: ComposeDocument,
  input: {
    internalNetworkName: string;
    jobStackName: string;
    sourceStackName: string;
    targetReplicas: number;
  }
): ComposeDocument => {
  const { name: _stackName, ...composeWithoutName } = renderedCompose;
  const bootstrapService = renderedCompose.services?.bootstrap;
  if (
    !bootstrapService ||
    typeof bootstrapService !== 'object' ||
    Array.isArray(bootstrapService)
  ) {
    throw new Error('Render-Compose enthaelt keinen dedizierten bootstrap-Service.');
  }

  return normalizeQuantumComposeValue({
    version: composeWithoutName.version ?? '3.8',
    services: {
      bootstrap: {
        ...(bootstrapService as Record<string, JsonValue>),
        networks: ['internal'],
        deploy: {
          ...(((bootstrapService as Record<string, JsonValue>).deploy as
            Record<string, JsonValue> | undefined) ?? {}),
          replicas: input.targetReplicas,
          restart_policy: {
            condition: 'none',
          },
        },
        environment: {
          ...(((bootstrapService as Record<string, JsonValue>).environment as
            Record<string, JsonValue> | undefined) ?? {}),
          POSTGRES_HOST: `${input.sourceStackName}_postgres`,
          SVA_BOOTSTRAP_JOB_STACK: input.jobStackName,
          SVA_BOOTSTRAP_TARGET_STACK: input.sourceStackName,
        },
      },
    },
    networks: {
      internal: {
        external: true,
        name: input.internalNetworkName,
      },
    },
  }) as ComposeDocument;
};

const createQuantumProject = (
  deps: Pick<BootstrapJobDeps, 'rootDir' | 'runCapture' | 'runCaptureDetailed'>,
  env: NodeJS.ProcessEnv,
  input: RunBootstrapJobInput
) => {
  const jobStackName = toTemporaryJobStackName(input.sourceStackName, 'bootstrap', input.reportId);
  const remoteComposeFiles = input.remoteComposeFiles ?? [input.remoteComposeFile];
  const renderedComposeDocument = JSON.parse(
    deps.runCapture(
      deps.rootDir,
      'docker',
      [
        'compose',
        ...remoteComposeFiles.flatMap((filePath) => ['-f', resolve(deps.rootDir, filePath)]),
        'config',
        '--format',
        'json',
      ],
      {
        ...env,
        SVA_BOOTSTRAP_REPLICAS: '1',
        SVA_BOOTSTRAP_JOB_STACK: jobStackName,
        SVA_BOOTSTRAP_TARGET_STACK: input.sourceStackName,
        SVA_STACK_NAME: input.sourceStackName,
      }
    )
  ) as ComposeDocument;
  const jobCompose = buildBootstrapJobComposeDocument(renderedComposeDocument, {
    internalNetworkName: input.internalNetworkName,
    jobStackName,
    sourceStackName: input.sourceStackName,
    targetReplicas: 1,
  });
  const renderedComposeJson = JSON.stringify(jobCompose, null, 2);
  const projectDir = mkdtempSync(
    resolve(tmpdir(), `sva-studio-${input.runtimeProfile}-bootstrap-`)
  );
  const renderedComposePath = resolve(projectDir, 'docker-compose.rendered.json');

  writeFileSync(renderedComposePath, `${renderedComposeJson}\n`, 'utf8');

  return {
    jobStackName,
    projectDir,
    renderedComposePath,
    cleanup: () => {
      rmSync(projectDir, { force: true, recursive: true });
    },
  };
};

export const buildQuantumDeployArgs = (
  endpoint: string,
  stackName: string,
  composePath: string
) => ['stacks', 'deploy', '-f', composePath, '--stack', stackName, '--endpoint', endpoint];

const buildQuantumRemoveArgs = (endpoint: string, stackName: string) => [
  'stacks',
  'remove',
  '--force',
  '--endpoint',
  endpoint,
  '--stack',
  stackName,
];

const removeQuantumStack = (
  deps: Pick<BootstrapJobDeps, 'rootDir' | 'run'>,
  env: NodeJS.ProcessEnv,
  endpoint: string,
  stackName: string
) => {
  deps.run(
    deps.rootDir,
    'quantum-cli',
    buildQuantumRemoveArgs(endpoint, stackName),
    withoutDebugEnv(env)
  );
};

export const runBootstrapJobAgainstAcceptance = async (
  deps: BootstrapJobDeps,
  env: NodeJS.ProcessEnv,
  input: RunBootstrapJobInput
): Promise<BootstrapJobResult> => {
  const quantumProject = createQuantumProject(deps, env, input);
  const startedAt = new Date().toISOString();
  const jobServiceName = 'bootstrap';
  const timeoutMs = Number(env.SVA_BOOTSTRAP_JOB_TIMEOUT_MS ?? '300000');
  const pollIntervalMs = Number(env.SVA_BOOTSTRAP_JOB_POLL_INTERVAL_MS ?? '2000');
  const startTime = Date.now();

  if (!deps.commandExists(deps.rootDir, 'quantum-cli')) {
    quantumProject.cleanup();
    throw new Error('quantum-cli ist fuer den Swarm-Bootstrap-Job nicht verfuegbar.');
  }

  try {
    deps.run(
      deps.rootDir,
      'quantum-cli',
      buildQuantumDeployArgs(
        input.quantumEndpoint,
        quantumProject.jobStackName,
        quantumProject.renderedComposePath
      ),
      withoutDebugEnv(env)
    );

    for (;;) {
      const { logTail, task } = readQuantumTaskSnapshot(
        deps,
        env,
        input.quantumEndpoint,
        quantumProject.jobStackName,
        jobServiceName
      );
      const terminalState = getMigrationJobTerminalState(task);

      if (terminalState === 'succeeded') {
        return buildSuccessfulOneShotResult({
          cleanup: async () => {
            try {
              removeQuantumStack(deps, env, input.quantumEndpoint, quantumProject.jobStackName);
            } finally {
              quantumProject.cleanup();
            }
          },
          durationMs: Date.now() - startTime,
          jobServiceName,
          jobStackName: quantumProject.jobStackName,
          logTail,
          startedAt,
          task,
        });
      }

      if (terminalState === 'failed') {
        const containerLogTail = await readRemoteJobLogTail(deps, env, {
          containerId: task?.containerId,
          quantumEndpoint: input.quantumEndpoint,
          serviceId: task?.serviceId,
        });
        throw createOneShotJobError({
          diagnostic: selectOneShotDiagnostic(containerLogTail, logTail, 'Bootstrap failed'),
          failureKind: 'task-failed',
          jobServiceName,
          jobStackName: quantumProject.jobStackName,
          task,
        });
      }

      if (Date.now() - startTime > timeoutMs) {
        throw createOneShotJobError({
          diagnostic: logTail || 'Bootstrap timeout',
          failureKind: 'timeout',
          jobServiceName,
          jobStackName: quantumProject.jobStackName,
          task,
        });
      }

      await deps.wait(pollIntervalMs);
    }
  } catch (error) {
    let cleanupError: unknown;
    try {
      removeQuantumStack(deps, env, input.quantumEndpoint, quantumProject.jobStackName);
    } catch (cleanupFailure) {
      cleanupError = cleanupFailure;
    }
    quantumProject.cleanup();
    if (cleanupError) {
      throw withOneShotCleanupFailure(error);
    }
    throw error;
  }
};
