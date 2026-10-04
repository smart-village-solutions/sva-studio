import { filterRemoteOutputLines, summarizeProcessOutput, withoutDebugEnv } from './process.ts';
import { fetchPortainerDockerText } from './remote-portainer.ts';
import {
  extractQuantumJsonPayload,
  collectQuantumTaskSnapshots,
  selectLatestMigrationTask,
} from './migration-job-task.ts';
import type { MigrationJobDeps } from './migration-job.ts';

const buildQuantumRemoveArgs = (endpoint: string, stackName: string) => [
  'stacks',
  'remove',
  '--force',
  '--endpoint',
  endpoint,
  '--stack',
  stackName,
];

export const readQuantumTaskSnapshot = (
  deps: Pick<MigrationJobDeps, 'rootDir' | 'runCaptureDetailed'>,
  env: NodeJS.ProcessEnv,
  endpoint: string,
  stackName: string,
  serviceName: string
) => {
  const result = deps.runCaptureDetailed(
    deps.rootDir,
    'quantum-cli',
    [
      'ps',
      '--endpoint',
      endpoint,
      '--stack',
      stackName,
      '--service',
      serviceName,
      '--all',
      '-o',
      'json',
    ],
    withoutDebugEnv(env)
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

export const removeQuantumStack = (
  deps: Pick<MigrationJobDeps, 'rootDir' | 'run'>,
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

export const isTruthyEnvValue = (value: string | undefined) =>
  ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');

export const readRemoteJobLogTail = async (
  deps: Pick<MigrationJobDeps, 'commandExists' | 'rootDir' | 'runCapture'>,
  env: NodeJS.ProcessEnv,
  input: {
    containerId: string | undefined;
    quantumEndpoint: string;
    serviceId: string | undefined;
  }
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

  return errors.length > 0
    ? `Remote-Logs konnten nicht über Portainer gelesen werden: ${errors.join('; ')}`
    : '';
};
