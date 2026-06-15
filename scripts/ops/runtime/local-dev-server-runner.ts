import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, existsSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type LocalRunnerState = {
  pid?: number;
};

type RunnerArgs = {
  logFile: string;
  profile: string;
  stateFile: string;
};

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const runnerCommand = ['pnpm', 'nx', 'run', 'sva-studio-react:serve'] as const;

export const parseLocalDevServerRunnerArgs = (argv: readonly string[]): RunnerArgs => {
  const parsed = new Map<string, string>();

  for (const entry of argv) {
    if (!entry.startsWith('--')) {
      continue;
    }

    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    parsed.set(entry.slice(2, separatorIndex), entry.slice(separatorIndex + 1));
  }

  const profile = parsed.get('profile')?.trim();
  const logFile = parsed.get('log-file')?.trim();
  const stateFile = parsed.get('state-file')?.trim();

  if (!profile || !logFile || !stateFile) {
    throw new Error(
      'Usage: tsx scripts/ops/runtime/local-dev-server-runner.ts --profile=<profile> --log-file=<path> --state-file=<path>'
    );
  }

  return { logFile, profile, stateFile };
};

export const clearLocalStateIfOwned = (stateFile: string, pid: number) => {
  if (!existsSync(stateFile)) {
    return;
  }

  try {
    const parsed = JSON.parse(readFileSync(stateFile, 'utf8')) as LocalRunnerState;
    if (parsed.pid === pid) {
      unlinkSync(stateFile);
    }
  } catch {
    // Ignore malformed or concurrently removed state files.
  }
};

const appendRunnerLogLine = (logFile: string, message: string) => {
  appendFileSync(logFile, `[local-dev-server-runner ${new Date().toISOString()}] ${message}\n`, 'utf8');
};

const isChildProcessRunning = (child: ChildProcess | null): child is ChildProcess =>
  child !== null && child.exitCode === null && child.signalCode === null;

const forwardSignal = (child: ChildProcess, logFile: string, signal: NodeJS.Signals) => {
  appendRunnerLogLine(logFile, `Signal ${signal} empfangen, leite an Kindprozess weiter.`);

  if (!child.killed && isChildProcessRunning(child)) {
    child.kill(signal);
  }
};

const scheduleForcedShutdown = (child: ChildProcess | null, logFile: string) => {
  const runningChild = child;
  if (!isChildProcessRunning(runningChild)) {
    return;
  }

  const forceKillTimer = setTimeout(() => {
    if (!isChildProcessRunning(runningChild)) {
      return;
    }

    appendRunnerLogLine(logFile, `Kindprozess reagiert nicht, sende SIGKILL an PID ${runningChild.pid}.`);
    runningChild.kill('SIGKILL');
  }, 5_000);

  forceKillTimer.unref();
};

const terminateChild = (
  child: ChildProcess | null,
  logFile: string,
  signal: NodeJS.Signals,
  state: { terminating: boolean }
) => {
  if (state.terminating || !child) {
    return;
  }

  state.terminating = true;
  forwardSignal(child, logFile, signal);
  scheduleForcedShutdown(child, logFile);
};

const registerSignalHandlers = (child: ChildProcess | null, logFile: string, state: { terminating: boolean }) => {
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => {
      terminateChild(child, logFile, signal, state);
    });
  }
};

const registerCrashHandlers = (child: ChildProcess | null, logFile: string) => {
  const forwardCrash = (kind: 'uncaughtException' | 'unhandledRejection', reason: unknown) => {
    appendRunnerLogLine(logFile, `${kind}: ${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}`);
    if (!child) {
      return;
    }

    forwardSignal(child, logFile, 'SIGTERM');
    scheduleForcedShutdown(child, logFile);
  };

  process.on('uncaughtException', (error) => {
    forwardCrash('uncaughtException', error);
  });

  process.on('unhandledRejection', (reason) => {
    forwardCrash('unhandledRejection', reason);
  });
};

const waitForChildExit = (child: ChildProcess, logFile: string, stateFile: string) =>
  new Promise<number>((resolvePromise) => {
    child.once('exit', (code, signal) => {
      const resolvedCode = code ?? (signal ? 1 : 0);
      appendRunnerLogLine(
        logFile,
        `Kindprozess beendet (pid=${child.pid ?? 'n/a'}, code=${code ?? 'null'}, signal=${signal ?? 'null'}).`
      );
      clearLocalStateIfOwned(stateFile, process.pid);
      resolvePromise(resolvedCode);
    });
  });

const readLogFileArg = (argv: readonly string[]) =>
  argv.find((entry) => entry.startsWith('--log-file='))?.slice('--log-file='.length);

export const runLocalDevServerRunner = async (argv: readonly string[]) => {
  const { logFile, profile, stateFile } = parseLocalDevServerRunnerArgs(argv);
  const logFd = openSync(logFile, 'a');
  const state = { terminating: false };

  appendRunnerLogLine(logFile, `Starte Dev-Server fuer Profil ${profile}.`);

  const child = spawn(runnerCommand[0], [...runnerCommand.slice(1)], {
    cwd: rootDir,
    env: process.env,
    stdio: ['ignore', logFd, logFd],
  });

  if (child.pid === undefined) {
    appendRunnerLogLine(logFile, 'Kindprozess konnte nicht gestartet werden.');
    clearLocalStateIfOwned(stateFile, process.pid);
    throw new Error('Kindprozess fuer lokalen Dev-Server konnte nicht gestartet werden.');
  }

  appendRunnerLogLine(logFile, `Kindprozess gestartet (PID ${child.pid}).`);

  registerSignalHandlers(child, logFile, state);
  registerCrashHandlers(child, logFile);

  const exitCode = await waitForChildExit(child, logFile, stateFile);

  process.exitCode = exitCode;
};

const isMainModule = () => {
  const mainEntry = process.argv[1];
  if (!mainEntry) {
    return false;
  }

  return resolve(mainEntry) === fileURLToPath(import.meta.url);
};

if (isMainModule()) {
  void runLocalDevServerRunner(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    const logFileArg = readLogFileArg(process.argv.slice(2));

    if (logFileArg) {
      appendRunnerLogLine(logFileArg, `Runner-Start fehlgeschlagen: ${message}`);
    } else {
      console.error(message);
    }

    process.exitCode = 1;
  });
}
