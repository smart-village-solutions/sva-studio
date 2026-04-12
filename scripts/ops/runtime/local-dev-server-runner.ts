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

const forwardSignal = (child: ChildProcess, logFile: string, signal: NodeJS.Signals) => {
  appendRunnerLogLine(logFile, `Signal ${signal} empfangen, leite an Kindprozess weiter.`);

  if (!child.killed && child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
  }
};

export const runLocalDevServerRunner = async (argv: readonly string[]) => {
  const { logFile, profile, stateFile } = parseLocalDevServerRunnerArgs(argv);
  const logFd = openSync(logFile, 'a');
  let child: ChildProcess | null = null;
  let terminating = false;

  appendRunnerLogLine(logFile, `Starte Dev-Server fuer Profil ${profile}.`);

  child = spawn(runnerCommand[0], [...runnerCommand.slice(1)], {
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

  const scheduleForcedShutdown = () => {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    const forceKillTimer = setTimeout(() => {
      if (!child || child.exitCode !== null || child.signalCode !== null) {
        return;
      }

      appendRunnerLogLine(logFile, `Kindprozess reagiert nicht, sende SIGKILL an PID ${child.pid}.`);
      child.kill('SIGKILL');
    }, 5_000);

    forceKillTimer.unref();
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => {
      if (terminating || !child) {
        return;
      }

      terminating = true;
      forwardSignal(child, logFile, signal);
      scheduleForcedShutdown();
    });
  }

  process.on('uncaughtException', (error) => {
    appendRunnerLogLine(logFile, `uncaughtException: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    if (child) {
      forwardSignal(child, logFile, 'SIGTERM');
      scheduleForcedShutdown();
    }
  });

  process.on('unhandledRejection', (reason) => {
    appendRunnerLogLine(logFile, `unhandledRejection: ${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}`);
    if (child) {
      forwardSignal(child, logFile, 'SIGTERM');
      scheduleForcedShutdown();
    }
  });

  const exitCode = await new Promise<number>((resolvePromise) => {
    child!.once('exit', (code, signal) => {
      const resolvedCode = code ?? (signal ? 1 : 0);
      appendRunnerLogLine(
        logFile,
        `Kindprozess beendet (pid=${child?.pid ?? 'n/a'}, code=${code ?? 'null'}, signal=${signal ?? 'null'}).`
      );
      clearLocalStateIfOwned(stateFile, process.pid);
      resolvePromise(resolvedCode);
    });
  });

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
    const logFileArg = process.argv
      .slice(2)
      .find((entry) => entry.startsWith('--log-file='))
      ?.slice('--log-file='.length);

    if (logFileArg) {
      appendRunnerLogLine(logFileArg, `Runner-Start fehlgeschlagen: ${message}`);
    } else {
      console.error(message);
    }

    process.exitCode = 1;
  });
}
