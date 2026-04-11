import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import {
  collectQuantumTaskSnapshots,
  extractQuantumJsonPayload,
  getMigrationJobTerminalState,
  selectLatestMigrationTask,
  type MigrationJobTaskSnapshot,
} from './migration-job.ts';
import { filterRemoteOutputLines, spawnBackground, summarizeProcessOutput, wait, withoutDebugEnv } from './process.ts';

type RunCapture = (rootDir: string, commandName: string, args: readonly string[], env?: NodeJS.ProcessEnv) => string;
type RunCaptureDetailed = (
  rootDir: string,
  commandName: string,
  args: readonly string[],
  env?: NodeJS.ProcessEnv,
) => {
  error?: Error;
  output: readonly (string | Buffer | null)[];
  pid: number;
  signal: NodeJS.Signals | null;
  status: number | null;
  stderr: string;
  stdout: string;
};
type Run = (rootDir: string, commandName: string, args: readonly string[], env?: NodeJS.ProcessEnv) => void;
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

export type RunBootstrapJobInput = {
  internalNetworkName: string;
  quantumEndpoint: string;
  remoteComposeFile: string;
  reportId: string;
  runtimeProfile: string;
  sourceStackName: string;
};

const normalizeRenderedComposeForQuantum = (value: string) =>
  value
    .replace(/^name:\s.*\n/imu, '')
    .replace(/^(\s*cpus:\s*)([0-9.]+)$/gmu, '$1"$2"');

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

const toTemporaryJobStackName = (sourceStackName: string, serviceName: string, reportId: string) => {
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
  },
): ComposeDocument => {
  const { name: _stackName, ...composeWithoutName } = renderedCompose;
  const bootstrapService = renderedCompose.services?.bootstrap;
  if (!bootstrapService || typeof bootstrapService !== 'object' || Array.isArray(bootstrapService)) {
    throw new Error('Render-Compose enthaelt keinen dedizierten bootstrap-Service.');
  }

  return normalizeQuantumComposeValue({
    version: composeWithoutName.version ?? '3.8',
    services: {
      bootstrap: {
        ...(bootstrapService as Record<string, JsonValue>),
        networks: ['internal'],
        deploy: {
          ...(((bootstrapService as Record<string, JsonValue>).deploy as Record<string, JsonValue> | undefined) ?? {}),
          replicas: input.targetReplicas,
          restart_policy: {
            condition: 'none',
          },
        },
        environment: {
          ...((((bootstrapService as Record<string, JsonValue>).environment as Record<string, JsonValue> | undefined) ?? {})),
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
  input: RunBootstrapJobInput,
) => {
  const jobStackName = toTemporaryJobStackName(input.sourceStackName, 'bootstrap', input.reportId);
  const renderedComposeDocument = JSON.parse(
    deps.runCapture(
      deps.rootDir,
      'docker',
      ['compose', '-f', resolve(deps.rootDir, input.remoteComposeFile), 'config', '--format', 'json'],
      {
        ...env,
        SVA_BOOTSTRAP_REPLICAS: '1',
        SVA_BOOTSTRAP_JOB_STACK: jobStackName,
        SVA_BOOTSTRAP_TARGET_STACK: input.sourceStackName,
        SVA_STACK_NAME: input.sourceStackName,
      },
    ),
  ) as ComposeDocument;
  const jobCompose = buildBootstrapJobComposeDocument(renderedComposeDocument, {
    internalNetworkName: input.internalNetworkName,
    jobStackName,
    sourceStackName: input.sourceStackName,
    targetReplicas: 1,
  });
  const renderedComposeJson = JSON.stringify(jobCompose, null, 2);
  const projectDir = mkdtempSync(resolve(tmpdir(), `sva-studio-${input.runtimeProfile}-bootstrap-`));
  const renderedComposePath = resolve(projectDir, 'docker-compose.rendered.json');
  const quantumProjectPath = resolve(projectDir, '.quantum');

  writeFileSync(renderedComposePath, `${renderedComposeJson}\n`, 'utf8');
  writeFileSync(
    quantumProjectPath,
    [
      '---',
      'version: "1.0"',
      'compose: docker-compose.rendered.json',
      'environments:',
      `  - name: ${input.runtimeProfile}`,
      '    compose: docker-compose.rendered.json',
      '',
    ].join('\n'),
    'utf8',
  );

  return {
    jobStackName,
    projectDir,
    cleanup: () => {
      rmSync(projectDir, { force: true, recursive: true });
    },
  };
};

const buildQuantumCreateArgs = (endpoint: string, stackName: string, projectDir: string, env: NodeJS.ProcessEnv) => [
  'stacks',
  'update',
  '--create',
  ...(env.QUANTUM_ENVIRONMENT?.trim() ? ['--environment', env.QUANTUM_ENVIRONMENT.trim()] : []),
  '--endpoint',
  endpoint,
  '--stack',
  stackName,
  '--wait',
  '--no-pre-pull',
  '--project',
  projectDir,
];

const buildQuantumRemoveArgs = (endpoint: string, stackName: string) => [
  'stacks',
  'remove',
  '--force',
  '--endpoint',
  endpoint,
  '--stack',
  stackName,
];

const readQuantumTaskSnapshot = (
  deps: Pick<BootstrapJobDeps, 'rootDir' | 'runCaptureDetailed'>,
  env: NodeJS.ProcessEnv,
  endpoint: string,
  stackName: string,
  serviceName: string,
): {
  logTail: string;
  task: MigrationJobTaskSnapshot | null;
} => {
  const result = deps.runCaptureDetailed(
    deps.rootDir,
    'quantum-cli',
    ['ps', '--endpoint', endpoint, '--stack', stackName, '--service', serviceName, '--all', '-o', 'json'],
    withoutDebugEnv(env),
  );

  const combined = filterRemoteOutputLines(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  const jsonPayload = extractQuantumJsonPayload(combined);
  if (!jsonPayload) {
    return {
      logTail: summarizeProcessOutput(`${result.stdout ?? ''}\n${result.stderr ?? ''}`),
      task: null,
    };
  }

  const parsed = JSON.parse(jsonPayload) as unknown;
  return {
    logTail: summarizeProcessOutput(`${result.stdout ?? ''}\n${result.stderr ?? ''}`),
    task: selectLatestMigrationTask(collectQuantumTaskSnapshots(parsed)),
  };
};

const removeQuantumStack = (
  deps: Pick<BootstrapJobDeps, 'rootDir' | 'run'>,
  env: NodeJS.ProcessEnv,
  endpoint: string,
  stackName: string,
) => {
  deps.run(
    deps.rootDir,
    'quantum-cli',
    buildQuantumRemoveArgs(endpoint, stackName),
    withoutDebugEnv(env),
  );
};

export const runBootstrapJobAgainstAcceptance = async (
  deps: BootstrapJobDeps,
  env: NodeJS.ProcessEnv,
  input: RunBootstrapJobInput,
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
      buildQuantumCreateArgs(input.quantumEndpoint, quantumProject.jobStackName, quantumProject.projectDir, env),
      withoutDebugEnv(env),
    );

    for (;;) {
      const { logTail, task } = readQuantumTaskSnapshot(
        deps,
        env,
        input.quantumEndpoint,
        quantumProject.jobStackName,
        jobServiceName,
      );
      const terminalState = getMigrationJobTerminalState(task);

      if (terminalState === 'succeeded') {
        return {
          cleanup: async () => {
            try {
              removeQuantumStack(deps, env, input.quantumEndpoint, quantumProject.jobStackName);
            } catch {
              // Cleanup is best-effort; the temporary stack can still be removed manually if needed.
            } finally {
              quantumProject.cleanup();
            }
          },
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          exitCode: task?.exitCode,
          jobServiceName,
          jobStackName: quantumProject.jobStackName,
          logTail,
          startedAt,
          state: task?.state ?? 'complete',
          taskId: task?.taskId,
          taskMessage: task?.message,
        };
      }

      if (terminalState === 'failed') {
        throw new Error(
          [
            `Swarm-Bootstrap-Job ${quantumProject.jobStackName}/${jobServiceName} ist fehlgeschlagen.`,
            task?.state ? `state=${task.state}` : null,
            typeof task?.exitCode === 'number' ? `exitCode=${String(task.exitCode)}` : null,
            task?.message ? `message=${task.message}` : null,
            logTail ? `details:\n${logTail}` : null,
          ]
            .filter((entry): entry is string => Boolean(entry))
            .join('\n'),
        );
      }

      if (Date.now() - startTime > timeoutMs) {
        throw new Error(
          [
            `Swarm-Bootstrap-Job ${quantumProject.jobStackName}/${jobServiceName} hat das Timeout von ${timeoutMs} ms erreicht.`,
            task?.state ? `state=${task.state}` : null,
            task?.message ? `message=${task.message}` : null,
            logTail ? `details:\n${logTail}` : null,
          ]
            .filter((entry): entry is string => Boolean(entry))
            .join('\n'),
        );
      }

      await deps.wait(pollIntervalMs);
    }
  } catch (error) {
    try {
      removeQuantumStack(deps, env, input.quantumEndpoint, quantumProject.jobStackName);
    } catch {
      // Best-effort cleanup; primary error should remain visible.
    }
    quantumProject.cleanup();
    throw error;
  }
};
