export type OneShotFailureKind = 'cleanup-failed' | 'task-failed' | 'timeout';
type OneShotServiceName = 'bootstrap' | 'candidate' | 'migrate';

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
  jobServiceName: OneShotServiceName;
  jobStackName: string;
  state?: string;
  taskId?: string;
}>;

const diagnosticRules: readonly Readonly<{
  code: OneShotDiagnosticCode;
  pattern: RegExp;
  service?: OneShotServiceName;
}>[] = [
  {
    code: 'CANDIDATE_TENANT_SECRET_UNREADABLE',
    pattern: /promote_preflight_tenant_secret_unreadable/iu,
  },
  {
    code: 'CANDIDATE_TENANT_SCOPE_MISMATCH',
    pattern: /promote_preflight_tenant_scope_mismatch/iu,
  },
  {
    code: 'CANDIDATE_SECRET_REFERENCE_MISSING',
    pattern: /promote_preflight_secret_reference_missing/iu,
  },
  { code: 'CANDIDATE_CONFIG_INVALID', pattern: /promote_preflight_config_invalid/iu },
  { code: 'ONESHOT_DATABASE_AUTH_FAILED', pattern: /password authentication failed/iu },
  {
    code: 'ONESHOT_DATABASE_CONNECTION_FAILED',
    pattern: /connection refused|could not connect|connection timed out/iu,
  },
  { code: 'ONESHOT_DATABASE_PERMISSION_DENIED', pattern: /permission denied/iu },
  {
    code: 'ONESHOT_DATABASE_SCHEMA_MISSING',
    pattern: /(?:relation|schema|function).*does not exist/iu,
  },
  {
    code: 'ONESHOT_REQUIRED_CONFIG_MISSING',
    pattern: /pflichtvariable fehlt|missing required environment variable/iu,
  },
  {
    code: 'MIGRATION_GRAPHILE_WORKER_FAILED',
    pattern: /wende graphile-worker-migrationen/iu,
    service: 'migrate',
  },
  {
    code: 'MIGRATION_IAM_SCHEMA_GUARD_FAILED',
    pattern: /prüfe migrationsstand und kritische iam-schemaobjekte/iu,
    service: 'migrate',
  },
  {
    code: 'MIGRATION_WASTE_TENANT_FAILED',
    pattern: /wende ausstehende versionierte waste-tenant-migrationen/iu,
    service: 'migrate',
  },
  {
    code: 'MIGRATION_GOOSE_FAILED',
    pattern: /wende migrationen an/iu,
    service: 'migrate',
  },
  {
    code: 'MIGRATION_RUNTIME_ARTIFACT_MISSING',
    pattern: /goose-wrapper nicht gefunden|migrationsverzeichnis fehlt|migrator fehlt/iu,
    service: 'migrate',
  },
  {
    code: 'BOOTSTRAP_IAM_SCHEMA_GUARD_FAILED',
    pattern: /verifying iam database readiness/iu,
    service: 'bootstrap',
  },
  {
    code: 'BOOTSTRAP_RUNTIME_ARTIFACT_MISSING',
    pattern: /bootstrap-package nicht gefunden|cannot find module/iu,
    service: 'bootstrap',
  },
  {
    code: 'BOOTSTRAP_SQL_FAILED',
    pattern: /running bootstrap sql/iu,
    service: 'bootstrap',
  },
];

export const classifyOneShotDiagnostic = (
  diagnostic: string | undefined,
  jobServiceName: OneShotFailureEvidence['jobServiceName']
): OneShotDiagnosticCode => {
  const matchedRule = diagnosticRules.find(
    (rule) =>
      (!rule.service || rule.service === jobServiceName) && rule.pattern.test(diagnostic ?? '')
  );
  return matchedRule?.code ?? 'ONESHOT_UNKNOWN_TASK_FAILURE';
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
