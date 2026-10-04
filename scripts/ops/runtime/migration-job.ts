import { spawnBackground, wait, withoutDebugEnv } from './process.ts';
import {
  buildSuccessfulOneShotResult,
  createOneShotJobError,
  selectOneShotDiagnostic,
  withOneShotCleanupFailure,
} from './one-shot-job-lifecycle.ts';
import {
  createQuantumProject,
  buildQuantumDeployArgs,
  type RunMigrationJobInput,
} from './migration-job-compose.ts';
import {
  readQuantumTaskSnapshot,
  removeQuantumStack,
  readRemoteJobLogTail,
  isTruthyEnvValue,
} from './migration-job-remote.ts';
import { getMigrationJobTerminalState } from './migration-job-task.ts';

export { fetchPortainerDockerText } from './remote-portainer.ts';
export {
  selectLatestMigrationTask,
  getMigrationJobTerminalState,
  extractQuantumJsonPayload,
  collectQuantumTaskSnapshots,
} from './migration-job-task.ts';
export {
  buildMigrationJobComposeDocument,
  buildQuantumDeployArgs,
} from './migration-job-compose.ts';
export type { RunMigrationJobInput } from './migration-job-compose.ts';
export type { MigrationJobTaskSnapshot } from './migration-job-task.ts';
export { readQuantumTaskSnapshot, readRemoteJobLogTail } from './migration-job-remote.ts';

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

export type MigrationJobDeps = {
  commandExists: CommandExists;
  rootDir: string;
  run: Run;
  runCapture: RunCapture;
  runCaptureDetailed: RunCaptureDetailed;
  spawnBackground: typeof spawnBackground;
  wait: typeof wait;
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

export const runMigrationJobAgainstAcceptance = async (
  deps: MigrationJobDeps,
  env: NodeJS.ProcessEnv,
  input: RunMigrationJobInput
): Promise<MigrationJobResult> => {
  const quantumProject = createQuantumProject(deps, env, input);
  const startedAt = new Date().toISOString();
  const jobServiceName = input.jobServiceName ?? 'migrate';
  const jobLabel = jobServiceName === 'candidate' ? 'Candidate-Preflight' : 'Migrationsjob';
  const timeoutMs = Number(
    jobServiceName === 'candidate'
      ? (env.SVA_CANDIDATE_JOB_TIMEOUT_MS ?? '180000')
      : (env.SVA_MIGRATION_JOB_TIMEOUT_MS ?? '300000')
  );
  const pollIntervalMs = Number(
    jobServiceName === 'candidate'
      ? (env.SVA_CANDIDATE_JOB_POLL_INTERVAL_MS ?? '2000')
      : (env.SVA_MIGRATION_JOB_POLL_INTERVAL_MS ?? '2000')
  );
  const startTime = Date.now();

  if (!deps.commandExists(deps.rootDir, 'quantum-cli')) {
    quantumProject.cleanup();
    throw new Error(`quantum-cli ist fuer den Swarm-${jobLabel} nicht verfuegbar.`);
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
          diagnostic: selectOneShotDiagnostic(containerLogTail, logTail, `${jobLabel} failed`),
          failureKind: 'task-failed',
          jobServiceName,
          jobStackName: quantumProject.jobStackName,
          task,
        });
      }

      if (Date.now() - startTime > timeoutMs) {
        throw createOneShotJobError({
          diagnostic: logTail || `${jobLabel} timeout`,
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
    if (!isTruthyEnvValue(env.SVA_MIGRATION_JOB_KEEP_FAILED_STACK)) {
      try {
        removeQuantumStack(deps, env, input.quantumEndpoint, quantumProject.jobStackName);
      } catch (cleanupFailure) {
        cleanupError = cleanupFailure;
      }
    }
    quantumProject.cleanup();
    if (cleanupError) {
      throw withOneShotCleanupFailure(error);
    }
    throw error;
  }
};
