import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseBaseHeadCliOptions, type BaseHeadCliOptions } from './base-head-cli-options.ts';
import { CiCommandExecutionError, runCiCommand } from './ci-command-runner.ts';
import { buildCiFeedbackEvidence, writeCiFeedbackEvidence } from './ci-feedback-evidence.ts';
import {
  buildAppUnitCommand,
  resolveAppUnitExecutionPlan,
  planAppUnitExecution,
  type AppUnitExecutionPlan,
  type AppUnitManifest,
} from './affected-unit-plan.ts';
import {
  planChangedProjectsWithFallback,
  type ChangedProjectPlan,
} from './changed-project-plan.ts';
import { loadResidualUnitProjects } from './nx-project-graph.ts';
import {
  parseUnitSelection,
  assertShardPhase,
  type UnitGatePhase,
  resolveUnitScope,
  runAppUnitPartition,
  selectRemainingUnitProjects,
  type UnitShard,
} from './unit-shards.ts';

export interface DurationEntry {
  label: string;
  durationMs: number;
  projects?: string[];
  retryCount?: number;
}

const APP_PROJECT = 'sva-studio-react';
export const buildUnitProjectCommand = (project: string): string =>
  `env -u NO_COLOR pnpm nx run ${project}:test:unit --nxBail --output-style=stream`;

export {
  resolveAppUnitExecutionPlan,
  coverageExecutesSameUnitCommand,
} from './affected-unit-plan.ts';

export const hasPlannedUnitProjects = (plan: ChangedProjectPlan): boolean =>
  plan.directProjects.length > 0 || plan.remainingProjects.length > 0;

export const runAffectedUnitGate = (
  options: BaseHeadCliOptions,
  reportDuration?: (entry: DurationEntry) => void,
  reportPlan?: (plan: ReturnType<typeof planChangedProjectsWithFallback>) => void,
  phase: UnitGatePhase = 'all',
  shard?: UnitShard,
  appJob?: string,
  reportAppPlan?: (plan: AppUnitExecutionPlan) => void
): DurationEntry[] => {
  assertShardPhase(phase, shard);
  const full = process.env.NX_RUN_FULL === '1';
  const { changedFiles, affectedProjects, changedProjectPlan } = resolveUnitScope(options, full);
  reportPlan?.(changedProjectPlan);
  const durationEntries: DurationEntry[] = [];
  const separateApp = process.env.CI_UNIT_APP_SEPARATE === '1';
  const appPlan = resolveAppUnitExecutionPlan(
    changedFiles,
    affectedProjects,
    changedProjectPlan,
    separateApp
  );
  reportAppPlan?.(appPlan);
  if (phase === 'app') return runAppUnitPartition(appPlan, appJob, reportDuration);
  const directNonAppProjects = changedProjectPlan.directProjects.filter(
    (project) => project !== APP_PROJECT
  );
  const remainingProjects = shard
    ? selectRemainingUnitProjects(changedProjectPlan.remainingProjects, shard)
    : changedProjectPlan.remainingProjects;
  const remainingNonAppProjects = remainingProjects.filter((project) => project !== APP_PROJECT);

  const recordDuration = (
    label: string,
    durationMs: number,
    projects: string[],
    retryCount: number
  ): void => {
    const entry = { label, durationMs, projects, retryCount };
    durationEntries.push(entry);
    reportDuration?.(entry);
  };

  console.log(
    JSON.stringify(
      {
        base: options.base,
        head: options.head,
        scopeMode: full ? 'full' : 'affected',
        changedFiles,
        affectedProjects,
        changedProjectPlan,
        appPlan,
        shard,
        remainingProjects,
      },
      null,
      2
    )
  );

  if (!hasPlannedUnitProjects(changedProjectPlan)) {
    console.log('Keine betroffenen Unit-Projekte erkannt.');
    return durationEntries;
  }

  const runTarget = (label: string, command: string, projects: string[]): void => {
    try {
      const result = runCiCommand(command);
      recordDuration(label, result.durationMs, projects, result.retryCount);
    } catch (error) {
      if (error instanceof CiCommandExecutionError) {
        recordDuration(label, error.durationMs, projects, error.retryCount);
      }
      throw error;
    }
  };

  if (phase !== 'remaining') {
    for (const project of directNonAppProjects) {
      runTarget(`unit:direct:${project}`, buildUnitProjectCommand(project), [project]);
    }
  }

  if (
    !separateApp &&
    phase !== 'remaining' &&
    changedProjectPlan.directProjects.includes(APP_PROJECT)
  ) {
    if (appPlan.mode === 'aggregate') {
      runTarget('unit:direct:app', buildAppUnitCommand(), [APP_PROJECT]);
    } else if (appPlan.mode === 'slices') {
      for (const slice of appPlan.slices) {
        runTarget(`unit:direct:app:${slice}`, buildAppUnitCommand(slice), [APP_PROJECT]);
      }
    }
  }

  if (phase !== 'direct') {
    if (!separateApp && remainingProjects.includes(APP_PROJECT)) {
      runTarget('unit:remaining:app', buildAppUnitCommand(), [APP_PROJECT]);
    }
    for (const project of remainingNonAppProjects) {
      runTarget(`unit:remaining:${project}`, buildUnitProjectCommand(project), [project]);
    }
  }

  return durationEntries;
};

const formatDuration = (durationMs: number): string => `${(durationMs / 1000).toFixed(2)}s`;

const parseOptionalDate = (value: string | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const runAffectedUnitGateCli = (args: readonly string[]): number => {
  if (args.includes('--residual-only')) {
    runResidualUnitGate();
    return 0;
  }
  const options = parseBaseHeadCliOptions(args);
  const { phase, shard, appJob, shardId } = parseUnitSelection(args);
  let appPlan: AppUnitExecutionPlan | undefined;
  let appManifest: AppUnitManifest | undefined;
  const startedAt = new Date();
  const full = process.env.NX_RUN_FULL === '1';
  let plan: ReturnType<typeof planChangedProjectsWithFallback> | null = null;
  const durationEntries: DurationEntry[] = [];

  try {
    runAffectedUnitGate(
      options,
      (entry) => durationEntries.push(entry),
      (reportedPlan) => {
        plan = reportedPlan;
      },
      phase,
      shard,
      appJob,
      (reportedAppPlan) => {
        appPlan = reportedAppPlan;
      }
    );
    if (phase === 'app' && durationEntries.length > 0) {
      appManifest = JSON.parse(
        fs.readFileSync(
          path.resolve('artifacts', 'ci-feedback', 'app-unit-manifests', `${appJob}.json`),
          'utf8'
        )
      ) as AppUnitManifest;
    }
  } catch (error) {
    writeCiFeedbackEvidence(
      buildCiFeedbackEvidence({
        gate: 'unit',
        role: phase === 'direct' ? 'fast-feedback' : 'complete',
        shardId,
        status: 'failed',
        baseSha: options.base,
        headSha: options.head,
        scopeMode: full ? 'full' : 'affected',
        plan,
        appPlan,
        appManifest,
        phases: durationEntries,
        startedAt,
        finishedAt: new Date(),
        workflowCreatedAt: parseOptionalDate(process.env.CI_WORKFLOW_CREATED_AT),
        jobStartedAt: parseOptionalDate(process.env.CI_JOB_STARTED_AT),
        failureClassification:
          error instanceof CiCommandExecutionError ? error.classification : 'unknown',
      })
    );
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Unit Fast Feedback fehlgeschlagen: ${message}`);
    return 1;
  }

  if (durationEntries.length > 0) {
    console.log('\nAffected unit summary:');
    for (const entry of durationEntries) {
      console.log(`- ${entry.label}: ${formatDuration(entry.durationMs)}`);
    }
  }

  writeCiFeedbackEvidence(
    buildCiFeedbackEvidence({
      gate: 'unit',
      role: phase === 'direct' ? 'fast-feedback' : 'complete',
      shardId,
      status: durationEntries.length === 0 ? 'skipped' : 'passed',
      baseSha: options.base,
      headSha: options.head,
      scopeMode: full ? 'full' : 'affected',
      plan,
      appPlan,
      appManifest,
      phases: durationEntries,
      startedAt,
      finishedAt: new Date(),
      workflowCreatedAt: parseOptionalDate(process.env.CI_WORKFLOW_CREATED_AT),
      jobStartedAt: parseOptionalDate(process.env.CI_JOB_STARTED_AT),
    })
  );

  return 0;
};

export const runResidualUnitGate = (): void => {
  for (const project of loadResidualUnitProjects()) {
    if (process.env.CI_UNIT_APP_SEPARATE === '1' && project === 'sva-studio-react') continue;
    runCiCommand(buildUnitProjectCommand(project));
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runAffectedUnitGateCli(process.argv.slice(2)));
}
