export type OneShotFailureKind = 'cleanup-failed' | 'task-failed' | 'timeout';

export type OneShotFailureEvidence = Readonly<{
  cleanupFailed?: boolean;
  exitCode?: number | null;
  failureKind: OneShotFailureKind;
  jobServiceName: 'bootstrap' | 'candidate' | 'migrate';
  jobStackName: string;
  state?: string;
  taskId?: string;
}>;

export class OneShotJobError extends Error {
  readonly evidence: OneShotFailureEvidence;

  constructor(evidence: OneShotFailureEvidence, options?: ErrorOptions) {
    super('Der isolierte One-shot-Job hat seinen terminalen Vertrag nicht erfüllt.', options);
    this.name = 'OneShotJobError';
    this.evidence = evidence;
  }
}

export const createOneShotJobError = (
  input: Readonly<{
    diagnostic?: string;
    failureKind: OneShotFailureKind;
    jobServiceName: OneShotFailureEvidence['jobServiceName'];
    jobStackName: string;
    task?: Readonly<{ exitCode?: number | null; state?: string; taskId?: string }> | null;
  }>
): OneShotJobError =>
  new OneShotJobError(
    {
      exitCode: input.task?.exitCode,
      failureKind: input.failureKind,
      jobServiceName: input.jobServiceName,
      jobStackName: input.jobStackName,
      state: input.task?.state,
      taskId: input.task?.taskId,
    },
    input.diagnostic ? { cause: new Error(input.diagnostic) } : undefined
  );

export const withOneShotCleanupFailure = (error: unknown): OneShotJobError =>
  error instanceof OneShotJobError
    ? new OneShotJobError({ ...error.evidence, cleanupFailed: true }, { cause: error })
    : new OneShotJobError(
        {
          cleanupFailed: true,
          failureKind: 'cleanup-failed',
          jobServiceName: 'migrate',
          jobStackName: 'unknown',
        },
        { cause: error }
      );

export const buildSuccessfulOneShotResult = (
  input: Readonly<{
    cleanup: () => Promise<void>;
    durationMs: number;
    jobServiceName: OneShotFailureEvidence['jobServiceName'];
    jobStackName: string;
    logTail: string;
    startedAt: string;
    task?: Readonly<{
      exitCode?: number;
      message?: string;
      state?: string;
      taskId?: string;
    }> | null;
  }>
) => ({
  cleanup: input.cleanup,
  completedAt: new Date().toISOString(),
  durationMs: input.durationMs,
  exitCode: input.task?.exitCode,
  jobServiceName: input.jobServiceName,
  jobStackName: input.jobStackName,
  logTail: input.logTail,
  startedAt: input.startedAt,
  state: input.task?.state ?? 'complete',
  taskId: input.task?.taskId,
  taskMessage: input.task?.message,
});
