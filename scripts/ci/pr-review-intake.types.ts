export type IntakeSubcommand = 'snapshot' | 'threads' | 'checks';
export type PullRequestResolutionSource = 'explicit' | 'branch';
export type CheckHealth = 'failing' | 'pending' | 'passing';
export type CheckAnalysisStatus = 'ok' | 'external' | 'log_pending' | 'log_unavailable' | 'pending';

export interface CliOptions {
  command: IntakeSubcommand;
  json: boolean;
  repo?: string;
  pullRequestNumber?: number;
  maxLines: number;
  context: number;
}

export interface PullRequestRef {
  owner: string;
  repo: string;
  number: number;
  source: PullRequestResolutionSource;
}

export interface PullRequestSummary {
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  headRefName: string;
  baseRefName: string;
  reviewDecision: string | null;
  mergeable: string | null;
  authorLogin: string | null;
  changedFiles: number;
  additions: number;
  deletions: number;
  source: PullRequestResolutionSource;
}

export interface ReviewThreadCommentSummary {
  id: string;
  authorLogin: string;
  body: string;
  createdAt: string;
  url: string;
}

export interface ReviewThreadSummary {
  id: string;
  url: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  originalLine: number | null;
  commentCount: number;
  rootComment: ReviewThreadCommentSummary | null;
  latestComment: ReviewThreadCommentSummary | null;
  comments: readonly ReviewThreadCommentSummary[];
}

export interface ReviewThreadCollection {
  open: readonly ReviewThreadSummary[];
  resolved: readonly ReviewThreadSummary[];
}

export interface CheckRunMetadata {
  conclusion: string | null;
  status: string | null;
  workflowName: string | null;
  name: string | null;
  event: string | null;
  headBranch: string | null;
  headSha: string | null;
  url: string | null;
}

export interface CheckSummary {
  name: string;
  state: string | null;
  conclusion: string | null;
  bucket: string | null;
  detailsUrl: string;
  startedAt: string | null;
  completedAt: string | null;
  runId: string | null;
  jobId: string | null;
  workflow: string | null;
  health: CheckHealth;
}

export interface FailingCheckDetails extends CheckSummary {
  analysisStatus: CheckAnalysisStatus;
  note?: string;
  error?: string;
  run?: CheckRunMetadata;
  logSnippet?: string;
  logTail?: string;
}

export interface PendingCheckDetails extends CheckSummary {
  analysisStatus: 'pending';
  note?: string;
  run?: CheckRunMetadata;
}

export interface CheckCollection {
  failing: readonly FailingCheckDetails[];
  pending: readonly PendingCheckDetails[];
}

export interface SnapshotSummary {
  openThreads: number;
  resolvedThreads: number;
  failingChecks: number;
  pendingChecks: number;
  hasBlockers: boolean;
}

export interface SnapshotResult {
  pr: PullRequestSummary;
  reviewThreads: ReviewThreadCollection;
  checks: CheckCollection;
  summary: SnapshotSummary;
  sources: {
    pullRequest: string;
    reviewThreads: string;
    checks: string;
  };
}

export interface GhCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  stdoutBytes: Buffer;
}

export interface GhExecutor {
  (args: readonly string[], options?: { input?: string }): GhCommandResult;
}
