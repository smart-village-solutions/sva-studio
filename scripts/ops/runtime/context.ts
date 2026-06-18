import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getRebuildAuditLogFile } from './rebuild-audit.ts';
import {
  commandExists as commandExistsForRoot,
  run as runForRoot,
  runCapture as runCaptureForRoot,
  runCaptureDetailed as runCaptureDetailedForRoot,
  runQuantumExec as runQuantumExecForRoot,
  spawnBackground as spawnBackgroundForRoot,
} from './process.ts';

type RunQuantumExecOptions = Readonly<{
  marker?: string;
  failureMessage: string;
}>;

export type RuntimeEnvContext = Readonly<{
  rootDir: string;
  runtimeArtifactsDir: string;
  rebuildAuditLogFile: string;
  localStateFile: string;
  localWorkerStateFile: string;
  appLogDir: string;
  deployReportDir: string;
  gooseConfigPath: string;
  gooseMigrationsDir: string;
  gooseConfig: {
    repo: string;
    version: string;
  };
  commandExists: (commandName: string) => boolean;
  run: (commandName: string, args: readonly string[], env?: NodeJS.ProcessEnv) => void;
  runCapture: (commandName: string, args: readonly string[], env?: NodeJS.ProcessEnv) => string;
  runCaptureDetailed: (
    commandName: string,
    args: readonly string[],
    env?: NodeJS.ProcessEnv
  ) => ReturnType<typeof runCaptureDetailedForRoot>;
  runQuantumExec: (
    args: readonly string[],
    env: NodeJS.ProcessEnv,
    options?: RunQuantumExecOptions
  ) => string;
  rootCommands: Readonly<{
    commandExists: typeof commandExistsForRoot;
    run: typeof runForRoot;
    runCapture: typeof runCaptureForRoot;
    runCaptureDetailed: typeof runCaptureDetailedForRoot;
    runQuantumExec: typeof runQuantumExecForRoot;
    spawnBackground: typeof spawnBackgroundForRoot;
  }>;
}>;

export const createRuntimeEnvContext = (): RuntimeEnvContext => {
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const runtimeArtifactsDir = resolve(rootDir, 'artifacts/runtime');
  const rebuildAuditLogFile = getRebuildAuditLogFile(rootDir);
  const localStateFile = resolve(runtimeArtifactsDir, 'local-app-state.json');
  const localWorkerStateFile = resolve(runtimeArtifactsDir, 'local-worker-state.json');
  const appLogDir = resolve(runtimeArtifactsDir, 'logs');
  const deployReportDir = resolve(runtimeArtifactsDir, 'deployments');
  const gooseConfigPath = resolve(rootDir, 'packages/data/goose.config.json');
  const gooseMigrationsDir = resolve(rootDir, 'packages/data/migrations');
  const gooseConfig = JSON.parse(readFileSync(gooseConfigPath, 'utf8')) as {
    repo: string;
    version: string;
  };

  return {
    rootDir,
    runtimeArtifactsDir,
    rebuildAuditLogFile,
    localStateFile,
    localWorkerStateFile,
    appLogDir,
    deployReportDir,
    gooseConfigPath,
    gooseMigrationsDir,
    gooseConfig,
    commandExists: (commandName: string) => commandExistsForRoot(rootDir, commandName),
    run: (commandName: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env) =>
      runForRoot(rootDir, commandName, args, env),
    runCapture: (commandName: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env) =>
      runCaptureForRoot(rootDir, commandName, args, env),
    runCaptureDetailed: (
      commandName: string,
      args: readonly string[],
      env: NodeJS.ProcessEnv = process.env
    ) => runCaptureDetailedForRoot(rootDir, commandName, args, env),
    runQuantumExec: (
      args: readonly string[],
      env: NodeJS.ProcessEnv,
      options?: RunQuantumExecOptions
    ) => runQuantumExecForRoot(rootDir, args, env, options),
    rootCommands: {
      commandExists: commandExistsForRoot,
      run: runForRoot,
      runCapture: runCaptureForRoot,
      runCaptureDetailed: runCaptureDetailedForRoot,
      runQuantumExec: runQuantumExecForRoot,
      spawnBackground: spawnBackgroundForRoot,
    },
  };
};
