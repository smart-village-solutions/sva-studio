import { runGh, runGhJson } from './pr-review-intake.gh.js';
import type {
  CheckCollection,
  CheckRunMetadata,
  CheckSummary,
  CliOptions,
  FailingCheckDetails,
  GhExecutor,
  PendingCheckDetails,
  PullRequestRef,
} from './pr-review-intake.types.js';
import { extractFailureSnippet, extractJobId, extractRunId, parseAvailableFields } from './pr-review-intake.utils.js';

const FAILURE_CONCLUSIONS = new Set(['failure', 'cancelled', 'timed_out', 'action_required']);
const FAILURE_STATES = new Set(['failure', 'error', 'cancelled', 'timed_out', 'action_required']);
const FAILURE_BUCKETS = new Set(['fail']);
const PENDING_STATES = new Set(['pending', 'in_progress', 'queued', 'requested', 'waiting']);
const PENDING_BUCKETS = new Set(['pending', 'skipping']);
const PENDING_LOG_MARKERS = ['still in progress', 'log will be available when it is complete'] as const;

type RawCheckRecord = Record<string, unknown>;

const normalizeField = (value: unknown): string => (value == null ? '' : String(value).trim().toLowerCase());
const isPendingLogMessage = (message: string): boolean =>
  PENDING_LOG_MARKERS.some((marker) => message.toLowerCase().includes(marker));

const isFailingCheck = (check: Pick<CheckSummary, 'state' | 'conclusion' | 'bucket'>): boolean => {
  return (
    FAILURE_CONCLUSIONS.has(normalizeField(check.conclusion)) ||
    FAILURE_STATES.has(normalizeField(check.state)) ||
    FAILURE_BUCKETS.has(normalizeField(check.bucket))
  );
};

const isPendingCheck = (check: Pick<CheckSummary, 'state' | 'conclusion' | 'bucket'>): boolean => {
  return (
    !isFailingCheck(check) &&
    (PENDING_STATES.has(normalizeField(check.state)) || PENDING_BUCKETS.has(normalizeField(check.bucket)))
  );
};

export const normalizeCheckRecord = (record: RawCheckRecord): CheckSummary => {
  const detailsUrl = String(record.detailsUrl ?? record.link ?? '');
  const summary: CheckSummary = {
    name: String(record.name ?? ''),
    state: record.state == null ? null : String(record.state),
    conclusion: record.conclusion == null ? null : String(record.conclusion),
    bucket: record.bucket == null ? null : String(record.bucket),
    detailsUrl,
    startedAt: record.startedAt == null ? null : String(record.startedAt),
    completedAt: record.completedAt == null ? null : String(record.completedAt),
    runId: extractRunId(detailsUrl),
    jobId: extractJobId(detailsUrl),
    workflow: typeof record.workflow === 'string' ? record.workflow : null,
    health: 'passing',
  };

  if (isFailingCheck(summary)) {
    return { ...summary, health: 'failing' };
  }
  if (isPendingCheck(summary)) {
    return { ...summary, health: 'pending' };
  }
  return summary;
};

const fetchChecksRaw = (ref: PullRequestRef, executor: GhExecutor): RawCheckRecord[] => {
  const repoSlug = `${ref.owner}/${ref.repo}`;
  const primaryFields = ['name', 'state', 'conclusion', 'detailsUrl', 'startedAt', 'completedAt'];
  const primary = runGh(executor, ['pr', 'checks', String(ref.number), '--repo', repoSlug, '--json', primaryFields.join(',')]);
  let stdout = primary.stdout;

  if (primary.exitCode !== 0) {
    const availableFields = parseAvailableFields(`${primary.stderr}\n${primary.stdout}`.trim());
    const selected = ['name', 'state', 'bucket', 'link', 'startedAt', 'completedAt', 'workflow'].filter((field) =>
      availableFields.includes(field)
    );
    if (selected.length === 0) {
      throw new Error((primary.stderr || primary.stdout || 'gh pr checks fehlgeschlagen').trim());
    }

    const fallback = runGh(executor, ['pr', 'checks', String(ref.number), '--repo', repoSlug, '--json', selected.join(',')]);
    if (fallback.exitCode !== 0) {
      throw new Error((fallback.stderr || fallback.stdout || 'gh pr checks fehlgeschlagen').trim());
    }
    stdout = fallback.stdout;
  }

  const parsed = JSON.parse(stdout) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('gh pr checks lieferte kein Array.');
  }
  return parsed as RawCheckRecord[];
};

const fetchRunMetadata = (runId: string, repoSlug: string, executor: GhExecutor): CheckRunMetadata | undefined => {
  const fields = ['conclusion', 'status', 'workflowName', 'name', 'event', 'headBranch', 'headSha', 'url'];
  const result = runGh(executor, ['run', 'view', runId, '--repo', repoSlug, '--json', fields.join(',')]);
  if (result.exitCode !== 0) {
    return undefined;
  }
  const data = JSON.parse(result.stdout) as Record<string, unknown>;
  return {
    conclusion: data.conclusion == null ? null : String(data.conclusion),
    status: data.status == null ? null : String(data.status),
    workflowName: data.workflowName == null ? null : String(data.workflowName),
    name: data.name == null ? null : String(data.name),
    event: data.event == null ? null : String(data.event),
    headBranch: data.headBranch == null ? null : String(data.headBranch),
    headSha: data.headSha == null ? null : String(data.headSha),
    url: data.url == null ? null : String(data.url),
  };
};

const fetchRunLog = (runId: string, repoSlug: string, executor: GhExecutor): { logText: string; error?: string } => {
  const result = runGh(executor, ['run', 'view', runId, '--repo', repoSlug, '--log']);
  return result.exitCode === 0
    ? { logText: result.stdout }
    : { logText: '', error: (result.stderr || result.stdout || 'gh run view --log fehlgeschlagen').trim() };
};

const fetchJobLog = (jobId: string, repoSlug: string, executor: GhExecutor): { logText: string; error?: string } => {
  const result = runGh(executor, ['api', `/repos/${repoSlug}/actions/jobs/${jobId}/logs`]);
  if (result.exitCode !== 0) {
    return { logText: '', error: (result.stderr || result.stdout || 'gh api job logs fehlgeschlagen').trim() };
  }
  if (result.stdoutBytes.subarray(0, 2).equals(Buffer.from('PK'))) {
    return { logText: '', error: 'Job-Logs wurden als ZIP-Archiv geliefert und konnten nicht direkt ausgewertet werden.' };
  }
  return { logText: result.stdout };
};

const tailLines = (text: string, maxLines: number): string => text.split('\n').slice(-maxLines).join('\n');

const analyzeFailingCheck = (
  check: CheckSummary,
  repoSlug: string,
  executor: GhExecutor,
  options: Pick<CliOptions, 'maxLines' | 'context'>
): FailingCheckDetails => {
  if (!check.runId) {
    return { ...check, analysisStatus: 'external', note: 'Kein GitHub-Actions-Run in detailsUrl/link erkannt.' };
  }

  const run = fetchRunMetadata(check.runId, repoSlug, executor);
  const runLog = fetchRunLog(check.runId, repoSlug, executor);

  if (!runLog.error) {
    return {
      ...check,
      analysisStatus: 'ok',
      run,
      logSnippet: extractFailureSnippet(runLog.logText, options.maxLines, options.context),
      logTail: tailLines(runLog.logText, options.maxLines),
    };
  }

  if (!check.jobId || !isPendingLogMessage(runLog.error)) {
    return {
      ...check,
      analysisStatus: isPendingLogMessage(runLog.error) ? 'log_pending' : 'log_unavailable',
      run,
      ...(isPendingLogMessage(runLog.error) ? { note: runLog.error } : { error: runLog.error }),
    };
  }

  const jobLog = fetchJobLog(check.jobId, repoSlug, executor);
  if (!jobLog.error) {
    return {
      ...check,
      analysisStatus: 'ok',
      run,
      logSnippet: extractFailureSnippet(jobLog.logText, options.maxLines, options.context),
      logTail: tailLines(jobLog.logText, options.maxLines),
    };
  }

  return {
    ...check,
    analysisStatus: isPendingLogMessage(jobLog.error) ? 'log_pending' : 'log_unavailable',
    run,
    ...(isPendingLogMessage(jobLog.error) ? { note: jobLog.error } : { error: jobLog.error }),
  };
};

const analyzePendingCheck = (check: CheckSummary, repoSlug: string, executor: GhExecutor): PendingCheckDetails => {
  return {
    ...check,
    analysisStatus: 'pending',
    run: check.runId ? fetchRunMetadata(check.runId, repoSlug, executor) : undefined,
    note: check.runId ? 'Check läuft noch oder wartet auf Abschluss.' : 'Kein GitHub-Actions-Run in detailsUrl/link erkannt.',
  };
};

export const fetchChecks = (
  ref: PullRequestRef,
  executor: GhExecutor,
  options: Pick<CliOptions, 'maxLines' | 'context'>
): CheckCollection => {
  const repoSlug = `${ref.owner}/${ref.repo}`;
  const normalized = fetchChecksRaw(ref, executor).map(normalizeCheckRecord);

  return {
    failing: normalized.filter((check) => check.health === 'failing').map((check) => analyzeFailingCheck(check, repoSlug, executor, options)),
    pending: normalized.filter((check) => check.health === 'pending').map((check) => analyzePendingCheck(check, repoSlug, executor)),
  };
};
