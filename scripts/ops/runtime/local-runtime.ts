import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getRuntimeProfileDefinition, isMockAuthRuntimeProfile, type RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';

import { wait } from './process.ts';

export type LocalState = {
  command?: string;
  launcher?: 'local-dev-server-runner' | 'local-provisioning-worker-runner';
  logFile: string;
  pid: number;
  profile: RuntimeProfile;
  startedAt: string;
};

type LocalRuntimeCommandForDriftCheck = 'migrate' | 'reconcile' | 'up' | 'update';

type LocalRuntimeFileDeps = Readonly<{
  localStateFile: string;
  localWorkerStateFile: string;
  rootDir: string;
}>;

type StartLocalProcessOptions = Readonly<{
  command: LocalState['command'];
  launcher: NonNullable<LocalState['launcher']>;
  logFileName: string;
  processArgs: readonly string[];
  runtimeProfile: RuntimeProfile;
  stateFile: string;
  appLogDir: string;
  env: NodeJS.ProcessEnv;
  rootDir: string;
}>;

type LocalInfraOptions = Readonly<{
  composeArgs: readonly string[];
  env: NodeJS.ProcessEnv;
  run: (command: string, args: readonly string[], env: NodeJS.ProcessEnv) => void;
}>;

const readStateFile = (stateFile: string): LocalState | null => {
  if (!existsSync(stateFile)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(stateFile, 'utf8')) as LocalState;
    return typeof parsed.pid === 'number' ? parsed : null;
  } catch {
    return null;
  }
};

const clearStateFile = (stateFile: string) => {
  if (existsSync(stateFile)) {
    unlinkSync(stateFile);
  }
};

const stopKnownProcesses = (rootDir: string, patterns: readonly string[]) => {
  for (const pattern of patterns) {
    spawnSync('pkill', ['-f', pattern], {
      cwd: rootDir,
      stdio: 'ignore',
    });
  }
};

const stopLocalProcess = (
  state: LocalState | null,
  options: Readonly<{
    fallbackPatterns: readonly string[];
    rootDir: string;
    stateFile: string;
  }>,
) => {
  if (!state) {
    stopKnownProcesses(options.rootDir, options.fallbackPatterns);
    return;
  }

  if (!isProcessAlive(state.pid)) {
    clearStateFile(options.stateFile);
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

  clearStateFile(options.stateFile);
  stopKnownProcesses(options.rootDir, options.fallbackPatterns);
};

const startLocalProcess = (options: StartLocalProcessOptions) => {
  const logFile = resolve(options.appLogDir, options.logFileName);
  writeFileSync(logFile, '', 'utf8');

  const child = spawn(process.execPath, options.processArgs, {
    cwd: options.rootDir,
    detached: true,
    env: options.env,
    stdio: 'ignore',
  });

  if (child.pid === undefined) {
    throw new Error(`${options.launcher} fuer ${options.runtimeProfile} konnte nicht gestartet werden.`);
  }

  child.unref();

  writeFileSync(
    options.stateFile,
    `${JSON.stringify(
      {
        command: options.command,
        launcher: options.launcher,
        logFile,
        pid: child.pid,
        profile: options.runtimeProfile,
        startedAt: new Date().toISOString(),
      } satisfies LocalState,
      null,
      2,
    )}\n`,
    'utf8',
  );
};

export const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const readLocalStateFile = (localStateFile: string) => readStateFile(localStateFile);

export const readLocalState = readLocalStateFile;

export const readLocalWorkerState = (localWorkerStateFile: string) => readStateFile(localWorkerStateFile);

export const stopLocalApp = ({
  localStateFile,
  rootDir,
}: Readonly<{ localStateFile: string; rootDir: string }>) => {
  stopLocalProcess(readLocalStateFile(localStateFile), {
    fallbackPatterns: [
      'scripts/ops/runtime/local-dev-server-runner.ts',
      'sva-studio-react:serve',
      'vite.js dev --port 3000',
    ],
    rootDir,
    stateFile: localStateFile,
  });
};

export const stopLocalProvisioningWorker = ({
  localWorkerStateFile,
  rootDir,
}: Readonly<{ localWorkerStateFile: string; rootDir: string }>) => {
  stopLocalProcess(readLocalWorkerState(localWorkerStateFile), {
    fallbackPatterns: [
      'scripts/ops/runtime/local-provisioning-worker-runner.ts',
      'packages/auth-runtime/src/iam-instance-registry/worker.ts',
    ],
    rootDir,
    stateFile: localWorkerStateFile,
  });
};

export const startLocalApp = async (options: Readonly<{
  appLogDir: string;
  env: NodeJS.ProcessEnv;
  healthUrl: string;
  localStateFile: string;
  rootDir: string;
  runtimeProfile: RuntimeProfile;
}>) => {
  const existing = readLocalStateFile(options.localStateFile);
  if (existing && isProcessAlive(existing.pid) && existing.profile !== options.runtimeProfile) {
    throw new Error(
      `Lokale App laeuft bereits mit Profil ${existing.profile}. Erst env:down:${existing.profile} ausfuehren.`,
    );
  }

  if (existing && isProcessAlive(existing.pid) && existing.profile === options.runtimeProfile) {
    console.log(`Lokale App fuer ${options.runtimeProfile} laeuft bereits (PID ${existing.pid}).`);
    return;
  }

  startLocalProcess({
    appLogDir: options.appLogDir,
    command: 'pnpm nx run sva-studio-react:serve',
    env: options.env,
    launcher: 'local-dev-server-runner',
    logFileName: `${options.runtimeProfile}.log`,
    processArgs: [
      '--import',
      'tsx',
      'scripts/ops/runtime/local-dev-server-runner.ts',
      `--profile=${options.runtimeProfile}`,
      `--log-file=${resolve(options.appLogDir, `${options.runtimeProfile}.log`)}`,
      `--state-file=${options.localStateFile}`,
    ],
    rootDir: options.rootDir,
    runtimeProfile: options.runtimeProfile,
    stateFile: options.localStateFile,
  });

  await waitForHttpOk(options.healthUrl, 60_000);
};

export const startLocalProvisioningWorker = (options: Readonly<{
  appLogDir: string;
  env: NodeJS.ProcessEnv;
  localWorkerStateFile: string;
  rootDir: string;
  runtimeProfile: RuntimeProfile;
}>) => {
  const existing = readLocalWorkerState(options.localWorkerStateFile);
  if (existing && isProcessAlive(existing.pid) && existing.profile !== options.runtimeProfile) {
    throw new Error(
      `Lokaler Provisioning-Worker laeuft bereits mit Profil ${existing.profile}. Erst env:down:${existing.profile} ausfuehren.`,
    );
  }

  if (existing && isProcessAlive(existing.pid) && existing.profile === options.runtimeProfile) {
    return;
  }

  startLocalProcess({
    appLogDir: options.appLogDir,
    command: 'tsx packages/auth-runtime/src/iam-instance-registry/worker.ts',
    env: options.env,
    launcher: 'local-provisioning-worker-runner',
    logFileName: `${options.runtimeProfile}.worker.log`,
    processArgs: [
      '--import',
      'tsx',
      'scripts/ops/runtime/local-provisioning-worker-runner.ts',
      `--profile=${options.runtimeProfile}`,
      `--log-file=${resolve(options.appLogDir, `${options.runtimeProfile}.worker.log`)}`,
      `--state-file=${options.localWorkerStateFile}`,
    ],
    rootDir: options.rootDir,
    runtimeProfile: options.runtimeProfile,
    stateFile: options.localWorkerStateFile,
  });
};

export const shouldRunLocalProvisioningWorker = (runtimeProfile: RuntimeProfile) =>
  getRuntimeProfileDefinition(runtimeProfile).isLocal && !isMockAuthRuntimeProfile(runtimeProfile);

export const buildLocalHealthUrl = (env: NodeJS.ProcessEnv) =>
  new URL('/health/live', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString();

export const waitForHttpOk = async (url: string, timeoutMs: number) => {
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

export const upLocalInfra = ({ composeArgs, env, run }: LocalInfraOptions) => {
  run('docker', [...composeArgs, 'up', '-d'], env);
};

export const downLocalInfra = ({ composeArgs, env, run }: LocalInfraOptions) => {
  run('docker', [...composeArgs, 'down'], env);
};

export const pullLocalInfra = ({ composeArgs, env, run }: LocalInfraOptions) => {
  run('docker', [...composeArgs, 'pull'], env);
};

export const bootstrapLocalAppUser = (
  run: (command: string, args: readonly string[], env: NodeJS.ProcessEnv) => void,
  env: NodeJS.ProcessEnv,
) => {
  run('pnpm', ['nx', 'run', 'data:db:bootstrap-app-user'], env);
};

export const migrateLocalDatabase = (
  run: (command: string, args: readonly string[], env: NodeJS.ProcessEnv) => void,
  env: NodeJS.ProcessEnv,
) => {
  run('pnpm', ['nx', 'run', 'data:db:migrate'], env);
};

export const shouldCheckLocalInstanceRegistryDriftBeforeCommand = (runtimeCommand: LocalRuntimeCommandForDriftCheck) =>
  runtimeCommand === 'up' || runtimeCommand === 'update';
