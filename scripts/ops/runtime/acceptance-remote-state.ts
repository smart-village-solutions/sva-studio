import type { ChildProcess } from 'node:child_process';
import type { AcceptanceProbeResult, RemoteRuntimeProfile } from '../runtime-env.shared.ts';
import { createAcceptanceProbeResult } from './acceptance-probe.ts';
import {
  collectQuantumTaskSnapshots,
  extractQuantumJsonPayload,
  runMigrationJobAgainstAcceptance as runMigrationJobAgainstAcceptanceWithDeps,
  selectLatestMigrationTask,
} from './migration-job.ts';
import { runBootstrapJobAgainstAcceptance as runBootstrapJobAgainstAcceptanceWithDeps } from './bootstrap-job.ts';
import { filterRemoteOutputLines, wait, withoutDebugEnv } from './process.ts';
import { formatRemoteStackSnapshot, inspectRemoteStack, type RemoteStackSnapshot } from './remote-stack-state.ts';
import { inspectRemoteServiceContract } from './remote-service-spec.ts';

export type RemoteStackEvidence = {
  channel: 'docker' | 'portainer-api' | 'quantum-cli';
  hasRunningService: (serviceName: string) => boolean;
  services?: string;
  snapshot?: RemoteStackSnapshot;
  summary: string;
  tasks?: string;
};

type AcceptanceRemoteStateDeps = {
  commandExists: (command: string) => boolean;
  getConfiguredQuantumEndpoint: (env: NodeJS.ProcessEnv) => string;
  getConfiguredStackName: (env: NodeJS.ProcessEnv) => string;
  getRemoteAppServiceName: (env: NodeJS.ProcessEnv) => string;
  getRemoteComposeFile: (env: NodeJS.ProcessEnv) => string;
  jobCommands: {
    commandExists: (rootDir: string, command: string) => boolean;
    run: (rootDir: string, command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => void;
    runCapture: (rootDir: string, command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => string;
    runCaptureDetailed: (rootDir: string, command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => {
      error?: Error;
      output: readonly (string | Buffer | null)[];
      pid: number;
      signal: NodeJS.Signals | null;
      status: number | null;
      stderr: string;
      stdout: string;
    };
    spawnBackground: (rootDir: string, command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => ChildProcess;
  };
  rootDir: string;
  runCapture: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => string;
  runCaptureDetailed: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => { status: number | null; stdout: string; stderr: string };
};

const hasRunningQuantumService = (summary: string, serviceName: string) =>
  summary.includes(`service ${serviceName}`) &&
  new RegExp(`service ${serviceName}[\\s\\S]*?replicated\\s+1/1`, 'u').test(summary);

const readPortainerStackEvidence = async (deps: AcceptanceRemoteStateDeps, env: NodeJS.ProcessEnv, stackName: string) => {
  const snapshot = await inspectRemoteStack(
    { commandExists: deps.commandExists, runCapture: deps.runCapture },
    env,
    { quantumEndpoint: deps.getConfiguredQuantumEndpoint(env), stackName },
  );
  const summary = formatRemoteStackSnapshot(snapshot);
  return {
    channel: 'portainer-api',
    hasRunningService: (serviceName: string) => {
      const service = snapshot.services.find((entry) => entry.shortName === serviceName);
      return (service?.runningReplicas ?? 0) > 0;
    },
    services: summary,
    snapshot,
    summary,
    tasks: summary,
  } satisfies RemoteStackEvidence;
};

const readQuantumStackEvidence = (deps: AcceptanceRemoteStateDeps, env: NodeJS.ProcessEnv, stackName: string): RemoteStackEvidence => {
  const quantumSummary = deps.runCapture(
    'quantum-cli',
    ['ps', '--endpoint', deps.getConfiguredQuantumEndpoint(env), '--stack', stackName, '--all'],
    withoutDebugEnv(env),
  );
  return {
    channel: 'quantum-cli',
    hasRunningService: (serviceName) => hasRunningQuantumService(quantumSummary, serviceName),
    services: quantumSummary,
    summary: quantumSummary,
    tasks: quantumSummary,
  };
};

const readRemoteStackEvidence = async (deps: AcceptanceRemoteStateDeps, env: NodeJS.ProcessEnv): Promise<RemoteStackEvidence> => {
  const stackName = deps.getConfiguredStackName(env);
  try {
    return await readPortainerStackEvidence(deps, env, stackName);
  } catch (portainerError) {
    if (deps.commandExists('quantum-cli')) return readQuantumStackEvidence(deps, env, stackName);
    throw portainerError;
  }
};

const resolveRemoteInternalNetworkName = async (deps: AcceptanceRemoteStateDeps, env: NodeJS.ProcessEnv) => {
  const stackName = deps.getConfiguredStackName(env);
  const liveContract = await inspectRemoteServiceContract(
    { commandExists: deps.commandExists, runCapture: deps.runCapture },
    env,
    { quantumEndpoint: deps.getConfiguredQuantumEndpoint(env), serviceName: deps.getRemoteAppServiceName(env), stackName },
  );
  const internalNetworkName = (liveContract?.networkNames ?? [])
    .filter((networkName) => networkName !== 'public')[0]
    ?.trim();
  if (internalNetworkName) return internalNetworkName;
  throw new Error(`Internes Overlay-Netz fuer ${stackName}_app konnte nicht aus der Live-Service-Spec abgeleitet werden.`);
};

const remoteJobDeps = (deps: AcceptanceRemoteStateDeps) => ({
  commandExists: deps.jobCommands.commandExists,
  rootDir: deps.rootDir,
  run: deps.jobCommands.run,
  runCapture: deps.jobCommands.runCapture,
  runCaptureDetailed: deps.jobCommands.runCaptureDetailed,
  spawnBackground: deps.jobCommands.spawnBackground,
  wait,
});

const remoteJobOptions = async (
  deps: AcceptanceRemoteStateDeps,
  env: NodeJS.ProcessEnv,
  runtimeProfile: RemoteRuntimeProfile,
  reportId: string,
) => ({
  internalNetworkName: await resolveRemoteInternalNetworkName(deps, env),
  quantumEndpoint: deps.getConfiguredQuantumEndpoint(env),
  remoteComposeFile: deps.getRemoteComposeFile(env),
  reportId,
  runtimeProfile,
  sourceStackName: deps.getConfiguredStackName(env),
});

const runMigrationJobAgainstAcceptance = async (
  deps: AcceptanceRemoteStateDeps,
  env: NodeJS.ProcessEnv,
  runtimeProfile: RemoteRuntimeProfile,
  reportId: string,
) => runMigrationJobAgainstAcceptanceWithDeps(remoteJobDeps(deps), env, await remoteJobOptions(deps, env, runtimeProfile, reportId));

const runBootstrapJobAgainstAcceptance = async (
  deps: AcceptanceRemoteStateDeps,
  env: NodeJS.ProcessEnv,
  runtimeProfile: RemoteRuntimeProfile,
  reportId: string,
) => runBootstrapJobAgainstAcceptanceWithDeps(remoteJobDeps(deps), env, await remoteJobOptions(deps, env, runtimeProfile, reportId));

const quantumAppTaskProbe = (deps: AcceptanceRemoteStateDeps, env: NodeJS.ProcessEnv, startedAt: number, stackName: string, appService: string) => {
  const quantumEndpoint = deps.getConfiguredQuantumEndpoint(env);
  const result = deps.runCaptureDetailed(
    'quantum-cli',
    ['ps', '--endpoint', quantumEndpoint, '--stack', stackName, '--service', appService, '--all', '-o', 'json'],
    withoutDebugEnv(env),
  );
  const combined = filterRemoteOutputLines(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  const jsonPayload = extractQuantumJsonPayload(combined);
  const latestTask = jsonPayload ? selectLatestMigrationTask(collectQuantumTaskSnapshots(JSON.parse(jsonPayload) as unknown)) : null;
  const normalizedState = latestTask?.state?.trim().toLowerCase();
  const desiredState = latestTask?.desiredState?.trim().toLowerCase();
  const isOk = normalizedState === 'running' && (desiredState === 'running' || !desiredState);

  return createAcceptanceProbeResult({
    details: latestTask ?? undefined,
    durationMs: Date.now() - startedAt,
    message: isOk ? `Swarm-App-Task ist running (${latestTask?.taskId ?? 'n/a'}).` : `Swarm-App-Task ist nicht stabil running (${normalizedState ?? 'unbekannt'}).`,
    name: 'swarm-app-task',
    scope: 'internal',
    status: isOk ? 'ok' : 'error',
    target: `${stackName}/${appService}`,
  });
};

const dockerAppTaskProbe = (deps: AcceptanceRemoteStateDeps, startedAt: number, stackName: string, appService: string) => {
  const serviceOutput = deps.runCapture('docker', ['service', 'ps', `${stackName}_${appService}`, '--format', '{{.CurrentState}}']);
  const firstState = serviceOutput.split('\n').map((entry) => entry.trim()).find((entry) => entry.length > 0);
  const isOk = typeof firstState === 'string' && firstState.toLowerCase().startsWith('running');

  return createAcceptanceProbeResult({
    details: firstState ? { currentState: firstState } : undefined,
    durationMs: Date.now() - startedAt,
    message: isOk ? `Docker-Service ${stackName}_${appService} ist running.` : `Docker-Service-State: ${firstState ?? 'unbekannt'}.`,
    name: 'swarm-app-task',
    scope: 'internal',
    status: isOk ? 'ok' : 'error',
    target: `${stackName}/${appService}`,
  });
};

const failedAppTaskProbe = (error: unknown, startedAt: number, stackName: string, appService: string): AcceptanceProbeResult =>
  createAcceptanceProbeResult({
    durationMs: Date.now() - startedAt,
    message: error instanceof Error ? error.message : String(error),
    name: 'swarm-app-task',
    scope: 'internal',
    status: 'error',
    target: `${stackName}/${appService}`,
  });

const buildSwarmAppTaskProbe = (deps: AcceptanceRemoteStateDeps, env: NodeJS.ProcessEnv): AcceptanceProbeResult => {
  const startedAt = Date.now();
  const stackName = deps.getConfiguredStackName(env);
  const appService = deps.getRemoteAppServiceName(env);
  try {
    return deps.commandExists('quantum-cli')
      ? quantumAppTaskProbe(deps, env, startedAt, stackName, appService)
      : dockerAppTaskProbe(deps, startedAt, stackName, appService);
  } catch (error) {
    return failedAppTaskProbe(error, startedAt, stackName, appService);
  }
};

export const createAcceptanceRemoteStateOps = (deps: AcceptanceRemoteStateDeps) => ({
  buildSwarmAppTaskProbe: (env: NodeJS.ProcessEnv) => buildSwarmAppTaskProbe(deps, env),
  readRemoteStackEvidence: (env: NodeJS.ProcessEnv) => readRemoteStackEvidence(deps, env),
  runBootstrapJobAgainstAcceptance: (env: NodeJS.ProcessEnv, runtimeProfile: RemoteRuntimeProfile, reportId: string) =>
    runBootstrapJobAgainstAcceptance(deps, env, runtimeProfile, reportId),
  runMigrationJobAgainstAcceptance: (env: NodeJS.ProcessEnv, runtimeProfile: RemoteRuntimeProfile, reportId: string) =>
    runMigrationJobAgainstAcceptance(deps, env, runtimeProfile, reportId),
});
