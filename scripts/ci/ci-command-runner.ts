import { execSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

export type CiFailureClassification = 'deterministic' | 'infrastructure' | 'unknown';

export interface CiCommandAttempt {
  attempt: number;
  durationMs: number;
  classification: CiFailureClassification | null;
}

export interface CiCommandResult {
  durationMs: number;
  retryCount: number;
  attempts: CiCommandAttempt[];
}

interface ProcessFailure {
  status?: number | null;
  signal?: string | null;
}

type CommandExecutor = (command: string) => void;

const TRANSIENT_EXIT_CODE = 75;

const readProcessFailure = (error: unknown): ProcessFailure =>
  typeof error === 'object' && error !== null ? (error as ProcessFailure) : {};

export const classifyCiCommandFailure = (error: unknown): CiFailureClassification => {
  const failure = readProcessFailure(error);
  if (failure.signal || failure.status === TRANSIENT_EXIT_CODE) {
    return 'infrastructure';
  }
  if (typeof failure.status === 'number') {
    return 'deterministic';
  }
  return 'unknown';
};

export class CiCommandExecutionError extends Error {
  readonly classification: CiFailureClassification;
  readonly retryCount: number;
  readonly durationMs: number;
  readonly attempts: readonly CiCommandAttempt[];

  constructor(
    command: string,
    classification: CiFailureClassification,
    attempts: readonly CiCommandAttempt[]
  ) {
    super(`CI-Kommando fehlgeschlagen: ${command}`);
    this.name = 'CiCommandExecutionError';
    this.classification = classification;
    this.retryCount = Math.max(0, attempts.length - 1);
    this.durationMs = attempts.reduce((sum, attempt) => sum + attempt.durationMs, 0);
    this.attempts = attempts;
  }
}

const executeInherited = (command: string): void => {
  execSync(command, { env: process.env, stdio: 'inherit' });
};

export const runCiCommand = (
  command: string,
  execute: CommandExecutor = executeInherited
): CiCommandResult => {
  const attempts: CiCommandAttempt[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    console.log(`\n$ ${command}${attempt === 2 ? ' (einmaliger Infrastruktur-Retry)' : ''}`);
    const startedAt = performance.now();
    try {
      execute(command);
      const durationMs = performance.now() - startedAt;
      attempts.push({ attempt, durationMs, classification: null });
      return {
        durationMs: attempts.reduce((sum, entry) => sum + entry.durationMs, 0),
        retryCount: attempt - 1,
        attempts,
      };
    } catch (error) {
      const classification = classifyCiCommandFailure(error);
      attempts.push({
        attempt,
        durationMs: performance.now() - startedAt,
        classification,
      });
      if (classification !== 'infrastructure' || attempt === 2) {
        throw new CiCommandExecutionError(command, classification, attempts);
      }
    }
  }

  throw new Error('Unerreichbarer CI-Retry-Zustand.');
};
