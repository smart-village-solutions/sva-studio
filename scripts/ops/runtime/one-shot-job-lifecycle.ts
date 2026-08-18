export type OneShotFailureKind = 'cleanup-failed' | 'task-failed' | 'timeout';

export type OneShotDiagnosticCode =
  | 'BOOTSTRAP_IAM_SCHEMA_GUARD_FAILED'
  | 'BOOTSTRAP_RUNTIME_ARTIFACT_MISSING'
  | 'BOOTSTRAP_SQL_FAILED'
  | 'CANDIDATE_CONFIG_INVALID'
  | 'CANDIDATE_SECRET_REFERENCE_MISSING'
  | 'CANDIDATE_TENANT_SCOPE_MISMATCH'
  | 'CANDIDATE_TENANT_SECRET_UNREADABLE'
  | 'MIGRATION_GOOSE_FAILED'
  | 'MIGRATION_GRAPHILE_WORKER_FAILED'
  | 'MIGRATION_IAM_SCHEMA_GUARD_FAILED'
  | 'MIGRATION_RUNTIME_ARTIFACT_MISSING'
  | 'MIGRATION_WASTE_TENANT_FAILED'
  | 'ONESHOT_DATABASE_AUTH_FAILED'
  | 'ONESHOT_DATABASE_CONNECTION_FAILED'
  | 'ONESHOT_DATABASE_PERMISSION_DENIED'
  | 'ONESHOT_DATABASE_SCHEMA_MISSING'
  | 'ONESHOT_REQUIRED_CONFIG_MISSING'
  | 'ONESHOT_UNKNOWN_TASK_FAILURE';

export type OneShotFailureEvidence = Readonly<{
  cleanupFailed?: boolean;
  diagnosticCode?: OneShotDiagnosticCode;
  exitCode?: number | null;
  failureKind: OneShotFailureKind;
  jobServiceName: 'bootstrap' | 'candidate' | 'migrate';
  jobStackName: string;
  state?: string;
  taskId?: string;
}>;

export const classifyOneShotDiagnostic = (
  diagnostic: string | undefined,
  jobServiceName: OneShotFailureEvidence['jobServiceName']
): OneShotDiagnosticCode => {
  const normalized = diagnostic?.toLowerCase() ?? '';

  if (normalized.includes('promote_preflight_tenant_secret_unreadable'))
    return 'CANDIDATE_TENANT_SECRET_UNREADABLE';
  if (normalized.includes('promote_preflight_tenant_scope_mismatch'))
    return 'CANDIDATE_TENANT_SCOPE_MISMATCH';
  if (normalized.includes('promote_preflight_secret_reference_missing'))
    return 'CANDIDATE_SECRET_REFERENCE_MISSING';
  if (normalized.includes('promote_preflight_config_invalid')) return 'CANDIDATE_CONFIG_INVALID';
  if (normalized.includes('password authentication failed')) return 'ONESHOT_DATABASE_AUTH_FAILED';
  if (
    normalized.includes('connection refused') ||
    normalized.includes('could not connect') ||
    normalized.includes('connection timed out')
  )
    return 'ONESHOT_DATABASE_CONNECTION_FAILED';
  if (normalized.includes('permission denied')) return 'ONESHOT_DATABASE_PERMISSION_DENIED';
  if (
    normalized.includes('does not exist') &&
    (normalized.includes('relation') ||
      normalized.includes('schema') ||
      normalized.includes('function'))
  )
    return 'ONESHOT_DATABASE_SCHEMA_MISSING';
  if (
    normalized.includes('pflichtvariable fehlt') ||
    normalized.includes('missing required environment variable')
  )
    return 'ONESHOT_REQUIRED_CONFIG_MISSING';

  if (jobServiceName === 'migrate') {
    if (normalized.includes('wende graphile-worker-migrationen'))
      return 'MIGRATION_GRAPHILE_WORKER_FAILED';
    if (normalized.includes('prüfe migrationsstand und kritische iam-schemaobjekte'))
      return 'MIGRATION_IAM_SCHEMA_GUARD_FAILED';
    if (normalized.includes('wende ausstehende versionierte waste-tenant-migrationen'))
      return 'MIGRATION_WASTE_TENANT_FAILED';
    if (normalized.includes('wende migrationen an')) return 'MIGRATION_GOOSE_FAILED';
    if (
      normalized.includes('goose-wrapper nicht gefunden') ||
      normalized.includes('migrationsverzeichnis fehlt') ||
      normalized.includes('migrator fehlt')
    )
      return 'MIGRATION_RUNTIME_ARTIFACT_MISSING';
  }

  if (jobServiceName === 'bootstrap') {
    if (normalized.includes('verifying iam database readiness'))
      return 'BOOTSTRAP_IAM_SCHEMA_GUARD_FAILED';
    if (
      normalized.includes('bootstrap-package nicht gefunden') ||
      normalized.includes('cannot find module')
    )
      return 'BOOTSTRAP_RUNTIME_ARTIFACT_MISSING';
    if (normalized.includes('running bootstrap sql')) return 'BOOTSTRAP_SQL_FAILED';
  }

  return 'ONESHOT_UNKNOWN_TASK_FAILURE';
};

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
      diagnosticCode: classifyOneShotDiagnostic(input.diagnostic, input.jobServiceName),
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
