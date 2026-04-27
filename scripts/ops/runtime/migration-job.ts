import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { filterRemoteOutputLines, spawnBackground, summarizeProcessOutput, wait, withoutDebugEnv } from './process.ts';
import { fetchPortainerDockerText } from './remote-portainer.ts';

export { fetchPortainerDockerText } from './remote-portainer.ts';

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

type MigrationJobDeps = {
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

type MigrationTaskTerminalState = 'failed' | 'succeeded';

export type MigrationJobTaskSnapshot = {
  containerId?: string;
  createdAt?: string;
  desiredState?: string;
  exitCode?: number;
  message?: string;
  nodeId?: string;
  serviceId?: string;
  state?: string;
  taskId?: string;
  updatedAt?: string;
};

export type MigrationJobResult = {
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

export type RunMigrationJobInput = {
  internalNetworkName: string;
  quantumEndpoint: string;
  remoteComposeFile: string;
  reportId: string;
  runtimeProfile: string;
  sourceStackName: string;
};

const normalizeTaskState = (value: string | undefined) => value?.trim().toLowerCase() ?? '';

const coerceTaskSnapshot = (value: unknown): MigrationJobTaskSnapshot | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const status = (candidate.Status ?? {}) as Record<string, unknown>;
  const containerStatus = (status.ContainerStatus ?? {}) as Record<string, unknown>;

  const snapshot = {
    containerId: typeof containerStatus.ContainerID === 'string' ? containerStatus.ContainerID : undefined,
    createdAt: typeof candidate.CreatedAt === 'string' ? candidate.CreatedAt : undefined,
    desiredState: typeof candidate.DesiredState === 'string' ? candidate.DesiredState : undefined,
    exitCode:
      typeof containerStatus.ExitCode === 'number'
        ? containerStatus.ExitCode
        : typeof status.Err === 'number'
          ? status.Err
          : undefined,
    message: typeof status.Message === 'string' ? status.Message : undefined,
    nodeId: typeof candidate.NodeID === 'string' ? candidate.NodeID : undefined,
    serviceId: typeof candidate.ServiceID === 'string' ? candidate.ServiceID : undefined,
    state: typeof status.State === 'string' ? status.State : undefined,
    taskId: typeof candidate.ID === 'string' ? candidate.ID : undefined,
    updatedAt: typeof status.Timestamp === 'string' ? status.Timestamp : undefined,
  };

  if (
    snapshot.taskId === undefined &&
    snapshot.state === undefined &&
    snapshot.createdAt === undefined &&
    snapshot.updatedAt === undefined &&
    snapshot.exitCode === undefined &&
    snapshot.message === undefined
  ) {
    return null;
  }

  return snapshot;
};

export const selectLatestMigrationTask = (value: unknown): MigrationJobTaskSnapshot | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const snapshots = value
    .map((entry) => {
      const normalized = coerceTaskSnapshot(entry);
      if (normalized) {
        return normalized;
      }

      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const candidate = entry as Partial<MigrationJobTaskSnapshot>;
      if (
        typeof candidate.taskId === 'string' ||
        typeof candidate.state === 'string' ||
        typeof candidate.createdAt === 'string' ||
        typeof candidate.updatedAt === 'string'
      ) {
        return {
          containerId: typeof candidate.containerId === 'string' ? candidate.containerId : undefined,
          createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined,
          desiredState: typeof candidate.desiredState === 'string' ? candidate.desiredState : undefined,
          exitCode: typeof candidate.exitCode === 'number' ? candidate.exitCode : undefined,
          message: typeof candidate.message === 'string' ? candidate.message : undefined,
          nodeId: typeof candidate.nodeId === 'string' ? candidate.nodeId : undefined,
          serviceId: typeof candidate.serviceId === 'string' ? candidate.serviceId : undefined,
          state: typeof candidate.state === 'string' ? candidate.state : undefined,
          taskId: typeof candidate.taskId === 'string' ? candidate.taskId : undefined,
          updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined,
        } satisfies MigrationJobTaskSnapshot;
      }

      return null;
    })
    .filter((entry): entry is MigrationJobTaskSnapshot => entry !== null);
  if (snapshots.length === 0) {
    return null;
  }

  return snapshots.sort((left, right) => {
    const leftTs = Date.parse(left.updatedAt ?? left.createdAt ?? '') || 0;
    const rightTs = Date.parse(right.updatedAt ?? right.createdAt ?? '') || 0;
    return rightTs - leftTs;
  })[0] ?? null;
};

export const getMigrationJobTerminalState = (
  task: MigrationJobTaskSnapshot | null,
): MigrationTaskTerminalState | null => {
  if (!task) {
    return null;
  }

  const state = normalizeTaskState(task.state);
  const exitCode = task.exitCode;

  if (state === 'complete' || state === 'shutdown') {
    return exitCode === 0 ? 'succeeded' : 'failed';
  }

  if (['failed', 'rejected', 'orphaned', 'remove'].includes(state)) {
    return 'failed';
  }

  if (typeof exitCode === 'number' && exitCode !== 0 && ['new', 'allocated', 'pending', 'assigned', 'accepted', 'preparing', 'ready', 'starting', 'running'].includes(state)) {
    return 'failed';
  }

  return null;
};

const normalizeRenderedComposeForQuantum = (value: string) =>
  value
    .replace(/^name:\s.*\n/imu, '')
    .replace(/^(\s*cpus:\s*)([0-9.]+)$/gmu, '$1"$2"');

export const extractQuantumJsonPayload = (lines: readonly string[]) => {
  const startIndex = lines.findIndex((entry) => entry.startsWith('[') || entry.startsWith('{'));
  if (startIndex === -1) {
    return null;
  }

  const jsonPayload = lines.slice(startIndex).join('\n').trim();
  return jsonPayload.length > 0 ? jsonPayload : null;
};

export const collectQuantumTaskSnapshots = (value: unknown): MigrationJobTaskSnapshot[] => {
  if (Array.isArray(value)) {
    return value.map(coerceTaskSnapshot).filter((entry): entry is MigrationJobTaskSnapshot => entry !== null);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const candidate = value as Record<string, unknown>;
  if (Array.isArray(candidate.tasks)) {
    return candidate.tasks.map(coerceTaskSnapshot).filter((entry): entry is MigrationJobTaskSnapshot => entry !== null);
  }

  const stacks = candidate.stacks;
  if (!stacks || typeof stacks !== 'object') {
    return [];
  }

  return Object.values(stacks as Record<string, unknown>)
    .flatMap((stackEntries) => (Array.isArray(stackEntries) ? stackEntries : []))
    .flatMap((stackEntry) => {
      if (!stackEntry || typeof stackEntry !== 'object') {
        return [];
      }
      const tasks = (stackEntry as Record<string, unknown>).tasks;
      return Array.isArray(tasks) ? tasks : [];
    })
    .map(coerceTaskSnapshot)
    .filter((entry): entry is MigrationJobTaskSnapshot => entry !== null);
};

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

export const buildMigrationJobComposeDocument = (
  renderedCompose: ComposeDocument,
  input: {
    internalNetworkName: string;
    jobStackName: string;
    sourceStackName: string;
    targetReplicas: number;
  },
): ComposeDocument => {
  const { name: _stackName, ...composeWithoutName } = renderedCompose;
  const migrateService = renderedCompose.services?.migrate;
  if (!migrateService || typeof migrateService !== 'object' || Array.isArray(migrateService)) {
    throw new Error('Render-Compose enthaelt keinen dedizierten migrate-Service.');
  }

  return normalizeQuantumComposeValue({
    version: composeWithoutName.version ?? '3.8',
    services: {
      migrate: {
        ...(migrateService as Record<string, JsonValue>),
        networks: ['internal'],
        deploy: {
          ...(((migrateService as Record<string, JsonValue>).deploy as Record<string, JsonValue> | undefined) ?? {}),
          replicas: input.targetReplicas,
          restart_policy: {
            condition: 'none',
          },
        },
        environment: {
          ...((((migrateService as Record<string, JsonValue>).environment as Record<string, JsonValue> | undefined) ?? {})),
          POSTGRES_HOST: `${input.sourceStackName}_postgres`,
          SVA_MIGRATION_JOB_STACK: input.jobStackName,
          SVA_MIGRATION_TARGET_STACK: input.sourceStackName,
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
  deps: Pick<MigrationJobDeps, 'rootDir' | 'runCapture' | 'runCaptureDetailed'>,
  env: NodeJS.ProcessEnv,
  input: RunMigrationJobInput,
) => {
  const jobStackName = toTemporaryJobStackName(input.sourceStackName, 'migrate', input.reportId);
  const renderedComposeDocument = JSON.parse(
    deps.runCapture(
      deps.rootDir,
      'docker',
      ['compose', '-f', resolve(deps.rootDir, input.remoteComposeFile), 'config', '--format', 'json'],
      {
        ...env,
        SVA_MIGRATE_REPLICAS: '1',
        SVA_MIGRATION_JOB_STACK: jobStackName,
        SVA_MIGRATION_TARGET_STACK: input.sourceStackName,
        SVA_STACK_NAME: input.sourceStackName,
      },
    ),
  ) as ComposeDocument;
  const jobCompose = buildMigrationJobComposeDocument(renderedComposeDocument, {
    internalNetworkName: input.internalNetworkName,
    jobStackName,
    sourceStackName: input.sourceStackName,
    targetReplicas: 1,
  });
  const renderedComposeJson = JSON.stringify(jobCompose, null, 2);
  const projectDir = mkdtempSync(resolve(tmpdir(), `sva-studio-${input.runtimeProfile}-migrate-`));
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
  deps: Pick<MigrationJobDeps, 'rootDir' | 'runCaptureDetailed'>,
  env: NodeJS.ProcessEnv,
  endpoint: string,
  stackName: string,
  serviceName: string,
) => {
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
  deps: Pick<MigrationJobDeps, 'rootDir' | 'run'>,
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

const isTruthyEnvValue = (value: string | undefined) => ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');

export const readRemoteJobLogTail = async (
  deps: Pick<MigrationJobDeps, 'commandExists' | 'rootDir' | 'runCapture'>,
  env: NodeJS.ProcessEnv,
  input: {
    containerId: string | undefined;
    quantumEndpoint: string;
    serviceId: string | undefined;
  },
) => {
  const portainerDeps = {
    commandExists: (commandName: string) => deps.commandExists(deps.rootDir, commandName),
    runCapture: (commandName: string, args: readonly string[], requestEnv?: NodeJS.ProcessEnv) =>
      deps.runCapture(deps.rootDir, commandName, args, requestEnv),
  };
  const errors: string[] = [];

  if (input.containerId) {
    try {
      const output = await fetchPortainerDockerText(portainerDeps, env, {
        quantumEndpoint: input.quantumEndpoint,
        resourcePath: `containers/${input.containerId}/logs?stdout=1&stderr=1&tail=200`,
      });
      const summary = summarizeProcessOutput(output, 80);
      if (summary) {
        return summary;
      }
    } catch (error) {
      errors.push(`Container-Logs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (input.serviceId) {
    try {
      const output = await fetchPortainerDockerText(portainerDeps, env, {
        quantumEndpoint: input.quantumEndpoint,
        resourcePath: `services/${input.serviceId}/logs?stdout=1&stderr=1&tail=200`,
      });
      const summary = summarizeProcessOutput(output, 80);
      if (summary) {
        return summary;
      }
    } catch (error) {
      errors.push(`Service-Logs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return errors.length > 0 ? `Remote-Logs konnten nicht ueber Portainer gelesen werden: ${errors.join('; ')}` : '';
};

export const runMigrationJobAgainstAcceptance = async (
  deps: MigrationJobDeps,
  env: NodeJS.ProcessEnv,
  input: RunMigrationJobInput,
): Promise<MigrationJobResult> => {
  const quantumProject = createQuantumProject(deps, env, input);
  const startedAt = new Date().toISOString();
  const jobServiceName = 'migrate';
  const timeoutMs = Number(env.SVA_MIGRATION_JOB_TIMEOUT_MS ?? '300000');
  const pollIntervalMs = Number(env.SVA_MIGRATION_JOB_POLL_INTERVAL_MS ?? '2000');
  const startTime = Date.now();

  if (!deps.commandExists(deps.rootDir, 'quantum-cli')) {
    quantumProject.cleanup();
    throw new Error('quantum-cli ist fuer den Swarm-Migrationsjob nicht verfuegbar.');
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
        const containerLogTail = await readRemoteJobLogTail(deps, env, {
          containerId: task?.containerId,
          quantumEndpoint: input.quantumEndpoint,
          serviceId: task?.serviceId,
        });
        throw new Error(
          [
            `Swarm-Migrationsjob ${quantumProject.jobStackName}/${jobServiceName} ist fehlgeschlagen.`,
            task?.state ? `state=${task.state}` : null,
            typeof task?.exitCode === 'number' ? `exitCode=${String(task.exitCode)}` : null,
            task?.message ? `message=${task.message}` : null,
            containerLogTail ? `containerLogs:\n${containerLogTail}` : null,
            logTail ? `taskSnapshot:\n${logTail}` : null,
          ]
            .filter((entry): entry is string => Boolean(entry))
            .join('\n'),
        );
      }

      if (Date.now() - startTime > timeoutMs) {
        throw new Error(
          [
            `Swarm-Migrationsjob ${quantumProject.jobStackName}/${jobServiceName} hat das Timeout von ${timeoutMs} ms erreicht.`,
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
    if (!isTruthyEnvValue(env.SVA_MIGRATION_JOB_KEEP_FAILED_STACK)) {
      try {
        removeQuantumStack(deps, env, input.quantumEndpoint, quantumProject.jobStackName);
      } catch {
        // Best-effort cleanup; primary error should remain visible.
      }
    }
    quantumProject.cleanup();
    throw error;
  }
};
