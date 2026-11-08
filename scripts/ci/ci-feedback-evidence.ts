import fs from 'node:fs';
import path from 'node:path';

import {
  appUnitJobs,
  isAppUnitJobSelected,
  resolveAppUnitJob,
  resolveAppUnitExecutionPlan,
  type AppUnitExecutionPlan,
  type AppUnitManifest,
} from './affected-unit-plan.ts';
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
  appPlan?: AppUnitExecutionPlan;
  appManifest?: AppUnitManifest;
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
    aggregationMs: number | null;
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
  appPlan?: AppUnitExecutionPlan;
  appManifest?: AppUnitManifest;
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
  ...(options.appPlan ? { appPlan: options.appPlan } : {}),
  ...(options.appManifest ? { appManifest: options.appManifest } : {}),
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
    aggregationMs: options.aggregationMs === undefined ? null : Math.max(0, options.aggregationMs),
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

const assertAppManifestCases = (manifest: AppUnitManifest, slice: string): void => {
  if (
    manifest.tests.some(
      (test) =>
        !manifest.files.includes(test.file) ||
        !['passed', 'pending', 'todo', 'skipped', 'disabled'].includes(test.status)
    )
  )
    throw new Error(`Ungültiger App-Testreport: ${slice}`);
};
const assertAppManifestGroup = (
  manifests: (AppUnitManifest | undefined)[],
  slice: string
): void => {
  if (manifests.some((manifest) => !manifest)) throw new Error(`App-Dateiinventar fehlt: ${slice}`);
  const complete = manifests.map((manifest) => manifest!);
  const expected = [...complete[0].expectedFiles].sort();
  if (
    new Set(expected).size !== expected.length ||
    complete.some(
      (manifest) => JSON.stringify([...manifest.expectedFiles].sort()) !== JSON.stringify(expected)
    )
  )
    throw new Error(`App-Dateiinventare unterscheiden sich: ${slice}`);
  const actual = complete.flatMap((manifest) => manifest.files).sort();
  if (new Set(actual).size !== actual.length || JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`App-Testdateien sind unvollständig oder doppelt: ${slice}`);
  for (const manifest of complete) assertAppManifestCases(manifest, slice);
};
const assertAppManifests = (accepted: ReadonlyMap<string, CiFeedbackEvidence>): void => {
  for (const slice of ['ui', 'hooks', 'server', 'routes']) {
    const entries = appUnitJobs
      .filter((job) => resolveAppUnitJob(job).slice === slice)
      .map((job) => accepted.get(`unit-app-${job}`)!)
      .filter((entry) => entry.status === 'passed');
    if (entries.length > 0)
      assertAppManifestGroup(
        entries.map((entry) => entry.appManifest),
        slice
      );
  }
};
const assertAppJobEvidence = (
  evidence: CiFeedbackEvidence,
  job: string,
  selected: boolean,
  projects: readonly string[]
): void => {
  const expected = selected ? ['sva-studio-react'] : [];
  if (JSON.stringify([...projects].sort()) !== JSON.stringify(expected))
    throw new Error(`App-Unit-Shard ${job} ist unvollständig.`);
  const valid = selected
    ? evidence.status === 'passed' &&
      evidence.phases.length === 1 &&
      evidence.phases[0].label === `unit:app:${job}`
    : evidence.status === 'skipped' && evidence.phases.length === 0;
  if (!valid) throw new Error(`App-Unit-Shard ${job} enthält keine passende Ausführung.`);
};
export const assertSeparateAppUnitEvidence = (
  accepted: ReadonlyMap<string, CiFeedbackEvidence>,
  projectsByShard: ReadonlyMap<string, Set<string>>,
  expectedPlan = accepted.get('unit-direct')?.appPlan
): void => {
  const expectedIds = appUnitJobs.map((job) => `unit-app-${job}`).sort();
  const appIds = [...accepted.keys()].filter((id) => id.startsWith('unit-app-')).sort();
  if (JSON.stringify(appIds) !== JSON.stringify(expectedIds))
    throw new Error('Unvollständige App-Unit-Shards.');
  const plan = expectedPlan;
  if (!plan) throw new Error('App-Testplan fehlt.');
  for (const evidence of accepted.values())
    if (JSON.stringify(evidence.appPlan) !== JSON.stringify(plan))
      throw new Error('App-Testpläne unterscheiden sich.');
  for (const job of appUnitJobs) {
    const id = `unit-app-${job}`;
    assertAppJobEvidence(accepted.get(id)!, job, isAppUnitJobSelected(plan, job), [
      ...(projectsByShard.get(id) ?? []),
    ]);
  }
  assertAppManifests(accepted);
};

export const assertFullAppUnitEvidence = (
  accepted: ReadonlyMap<string, CiFeedbackEvidence>,
  projectsByShard: ReadonlyMap<string, Set<string>>
): void => {
  const sourcePlan = accepted.values().next().value?.plan;
  if (
    !sourcePlan ||
    sourcePlan.directProjects.length > 0 ||
    !sourcePlan.remainingProjects.includes('sva-studio-react')
  )
    throw new Error('Vollständiger App-Unit-Scope fehlt.');
  for (const evidence of accepted.values()) {
    if (
      evidence.scopeMode !== 'full' ||
      JSON.stringify(evidence.plan) !== JSON.stringify(sourcePlan)
    )
      throw new Error('App-Unit-Shards verwenden unterschiedliche vollständige Scope-Pläne.');
  }
  const appPlan = resolveAppUnitExecutionPlan([], ['sva-studio-react'], sourcePlan, true);
  assertSeparateAppUnitEvidence(accepted, projectsByShard, appPlan);
};
