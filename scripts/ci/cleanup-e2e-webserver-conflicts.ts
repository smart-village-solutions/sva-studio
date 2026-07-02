import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

interface ProcessInfo {
  pid: number;
  ppid: number;
  command: string;
}

const DEFAULT_PORT = 3000;

const parsePidList = (output: string): number[] =>
  output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => Number.parseInt(line, 10))
    .filter((value) => Number.isInteger(value) && value > 0);

export const parseProcessTable = (output: string): ProcessInfo[] =>
  output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = /^(?<pid>\d+)\s+(?<ppid>\d+)\s+(?<command>.+)$/u.exec(line);
      if (!match?.groups) {
        return null;
      }

      return {
        pid: Number.parseInt(match.groups.pid, 10),
        ppid: Number.parseInt(match.groups.ppid, 10),
        command: match.groups.command,
      } satisfies ProcessInfo;
    })
    .filter((value): value is ProcessInfo => value !== null);

const getAncestorChain = (processMap: ReadonlyMap<number, ProcessInfo>, pid: number): number[] => {
  const ancestors: number[] = [];
  const visited = new Set<number>();
  let currentPid = pid;

  while (!visited.has(currentPid)) {
    visited.add(currentPid);
    const processInfo = processMap.get(currentPid);
    if (!processInfo) {
      break;
    }

    ancestors.push(processInfo.pid);
    if (processInfo.ppid <= 1) {
      break;
    }

    currentPid = processInfo.ppid;
  }

  return ancestors;
};

const isWorkspaceStudioServeProcess = (processInfo: ProcessInfo, workspaceRoot: string): boolean => {
  if (!processInfo.command.includes(workspaceRoot)) {
    return false;
  }

  return (
    processInfo.command.includes('nx.js run sva-studio-react:serve') ||
    processInfo.command.includes('run-executor.js') ||
    processInfo.command.includes('vite dev --host 0.0.0.0 --port 3000') ||
    processInfo.command.includes('vite dev --port 3000')
  );
};

export const resolveConflictingStudioServePids = (
  listeners: readonly number[],
  processes: readonly ProcessInfo[],
  workspaceRoot: string
): number[] => {
  const processMap = new Map(processes.map((processInfo) => [processInfo.pid, processInfo] as const));
  const pidsToKill = new Set<number>();

  for (const listenerPid of listeners) {
    const ancestorChain = getAncestorChain(processMap, listenerPid);
    const matchingAncestors = ancestorChain
      .map((pid) => processMap.get(pid))
      .filter((processInfo): processInfo is ProcessInfo => processInfo !== undefined)
      .filter((processInfo) => isWorkspaceStudioServeProcess(processInfo, workspaceRoot));

    if (matchingAncestors.length === 0) {
      continue;
    }

    for (const processInfo of matchingAncestors) {
      pidsToKill.add(processInfo.pid);
    }
  }

  return [...pidsToKill].sort((left, right) => left - right);
};

const parsePortFromArgs = (args: readonly string[]): number => {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--port') {
      continue;
    }

    const value = args[index + 1];
    if (!value) {
      throw new Error('Fehlender Wert fuer --port');
    }

    const parsedPort = Number.parseInt(value, 10);
    if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
      throw new Error(`Ungueltiger Port: ${value}`);
    }

    return parsedPort;
  }

  return DEFAULT_PORT;
};

const loadListeningPids = (port: number): number[] => {
  try {
    return parsePidList(
      execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
        encoding: 'utf8',
      })
    );
  } catch (error) {
    const exitStatus = typeof error === 'object' && error !== null && 'status' in error ? error.status : null;
    if (exitStatus === 1) {
      return [];
    }

    throw error;
  }
};

const loadProcesses = (): ProcessInfo[] =>
  parseProcessTable(
    execFileSync('ps', ['-Ao', 'pid=,ppid=,command='], {
      encoding: 'utf8',
    })
  );

export const cleanupE2EWebserverConflicts = (
  port: number,
  workspaceRoot: string
): { killedPids: number[]; listeners: number[] } => {
  const listeners = loadListeningPids(port);
  if (listeners.length === 0) {
    return { killedPids: [], listeners: [] };
  }

  const processes = loadProcesses();
  const conflictingPids = resolveConflictingStudioServePids(listeners, processes, workspaceRoot);

  for (const pid of [...conflictingPids].reverse()) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch (error) {
      const errorCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
      if (errorCode !== 'ESRCH') {
        throw error;
      }
    }
  }

  return { killedPids: conflictingPids, listeners };
};

const main = (): void => {
  const port = parsePortFromArgs(process.argv.slice(2));
  const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const result = cleanupE2EWebserverConflicts(port, workspaceRoot);

  if (result.killedPids.length === 0) {
    console.log(
      result.listeners.length === 0
        ? `Kein lokaler E2E-Webserver-Konflikt auf Port ${port} gefunden.`
        : `Port ${port} ist belegt, aber kein verwaister sva-studio-react:serve-Prozess wurde erkannt.`
    );
    return;
  }

  console.log(
    `Bereinigte verwaiste sva-studio-react-Serve-Prozesse auf Port ${port}: ${result.killedPids.join(', ')}`
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
