import fs from 'node:fs';
import path from 'node:path';

import type { ChangedProjectPlan } from './changed-project-plan.ts';

export interface CiFeedbackDuration {
  label: string;
  durationMs: number;
  projects?: string[];
  retryCount?: number;
}

export interface CiFeedbackEvidence {
  schemaVersion: 2;
  gate: 'coverage' | 'unit';
  role: 'aggregate' | 'complete' | 'fast-feedback';
  shardId: string;
  status: 'failed' | 'passed' | 'skipped';
  baseSha: string;
  headSha: string;
  scopeMode: 'affected' | 'full';
  plan: ChangedProjectPlan | null;
  phases: CiFeedbackDuration[];
  timing: {
    workflowCreatedAt: string | null;
    jobStartedAt: string | null;
    gateStartedAt: string;
    finishedAt: string;
    firstConfirmedFailureAt: string | null;
    queueMs: number | null;
    setupMs: number | null;
    executionMs: number;
    aggregationMs: number;
  };
  failure: {
    classification: 'deterministic' | 'infrastructure' | 'unknown';
    retryable: boolean;
  } | null;
  retries: {
    total: number;
  };
  cache: {
    transport: 'disabled' | 'local-only' | 'supported-remote';
    observation: 'observed' | 'unavailable';
    hits: number | null;
    misses: number | null;
    savedDurationMs: number | null;
  };
}

interface BuildCiFeedbackEvidenceOptions {
  gate: CiFeedbackEvidence['gate'];
  role: CiFeedbackEvidence['role'];
  shardId: string;
  status: CiFeedbackEvidence['status'];
  baseSha: string;
  headSha: string;
  scopeMode: CiFeedbackEvidence['scopeMode'];
  plan: ChangedProjectPlan | null;
  phases: readonly CiFeedbackDuration[];
  startedAt: Date;
  finishedAt: Date;
  workflowCreatedAt?: Date | null;
  jobStartedAt?: Date | null;
  aggregationMs?: number;
  failureClassification?: NonNullable<CiFeedbackEvidence['failure']>['classification'] | null;
  cache?: CiFeedbackEvidence['cache'];
}

const durationBetween = (
  start: Date | null | undefined,
  end: Date | null | undefined
): number | null => (start && end ? Math.max(0, end.getTime() - start.getTime()) : null);

export const buildCiFeedbackEvidence = (
  options: BuildCiFeedbackEvidenceOptions
): CiFeedbackEvidence => ({
  schemaVersion: 2,
  gate: options.gate,
  role: options.role,
  shardId: options.shardId,
  status: options.status,
  baseSha: options.baseSha,
  headSha: options.headSha,
  scopeMode: options.scopeMode,
  plan: options.plan,
  phases: options.phases.map((phase) => ({
    ...phase,
    projects: phase.projects ? [...phase.projects] : undefined,
  })),
  timing: {
    workflowCreatedAt: options.workflowCreatedAt?.toISOString() ?? null,
    jobStartedAt: options.jobStartedAt?.toISOString() ?? null,
    gateStartedAt: options.startedAt.toISOString(),
    finishedAt: options.finishedAt.toISOString(),
    firstConfirmedFailureAt: options.status === 'failed' ? options.finishedAt.toISOString() : null,
    queueMs: durationBetween(options.workflowCreatedAt, options.jobStartedAt),
    setupMs: durationBetween(options.jobStartedAt, options.startedAt),
    executionMs: Math.max(0, options.finishedAt.getTime() - options.startedAt.getTime()),
    aggregationMs: Math.max(0, options.aggregationMs ?? 0),
  },
  failure:
    options.status === 'failed'
      ? {
          classification: options.failureClassification ?? 'unknown',
          retryable: options.failureClassification === 'infrastructure',
        }
      : null,
  retries: {
    total: options.phases.reduce((sum, phase) => sum + (phase.retryCount ?? 0), 0),
  },
  cache: options.cache ?? {
    transport: 'local-only',
    observation: 'unavailable',
    hits: null,
    misses: null,
    savedDurationMs: null,
  },
});

export const writeCiFeedbackEvidence = (
  evidence: CiFeedbackEvidence,
  rootDir = process.cwd()
): string => {
  const evidenceDirectory = path.join(rootDir, 'artifacts', 'ci-feedback');
  const evidencePath = path.join(evidenceDirectory, `${evidence.gate}-${evidence.shardId}.json`);
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const directProjects = evidence.plan?.directProjects.join(', ') || 'keine';
    const elapsedMs =
      Date.parse(evidence.timing.finishedAt) - Date.parse(evidence.timing.gateStartedAt);
    fs.appendFileSync(
      summaryPath,
      [
        `### ${evidence.gate === 'unit' ? 'Unit' : 'Coverage'} Fast Feedback`,
        '',
        `- Status: \`${evidence.status}\``,
        `- Scope: \`${evidence.scopeMode}\``,
        `- Rolle: \`${evidence.role}\``,
        `- Shard: \`${evidence.shardId}\``,
        `- Direkt priorisiert: ${directProjects}`,
        `- Ausführungszeit: ${(elapsedMs / 1000).toFixed(2)} s`,
        `- Setup-Zeit: ${evidence.timing.setupMs === null ? 'nicht verfügbar' : `${(evidence.timing.setupMs / 1000).toFixed(2)} s`}`,
        `- Queue-Zeit: ${evidence.timing.queueMs === null ? 'nicht verfügbar' : `${(evidence.timing.queueMs / 1000).toFixed(2)} s`}`,
        `- Retries: ${evidence.retries.total}`,
        `- Cache-Beobachtung: \`${evidence.cache.observation}\` (Transport: \`${evidence.cache.transport}\`)`,
        `- Evidenz: \`${path.relative(rootDir, evidencePath)}\``,
        '',
      ].join('\n'),
      'utf8'
    );
  }

  return evidencePath;
};
