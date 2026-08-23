import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseBaseHeadCliOptions, type BaseHeadCliOptions } from './base-head-cli-options.ts';
import { CiCommandExecutionError, runCiCommand } from './ci-command-runner.ts';
import { buildCiFeedbackEvidence, writeCiFeedbackEvidence } from './ci-feedback-evidence.ts';
import {
  buildAppUnitCommand,
  planAppUnitExecution,
  type AppUnitExecutionPlan,
} from './affected-unit-plan.ts';
import {
  planChangedProjectsWithFallback,
  type ChangedProjectPlan,
} from './changed-project-plan.ts';
import { loadNxProjectRoots } from './nx-project-graph.ts';
import { resolveChangedFiles } from './pr-scope.ts';

export interface DurationEntry {
  label: string;
  durationMs: number;
  projects?: string[];
  retryCount?: number;
}

export type UnitGatePhase = 'all' | 'direct' | 'remaining';

const APP_PROJECT = 'sva-studio-react';
const require = createRequire(import.meta.url);
const getUnitProjects = (base: string, head: string, full: boolean): string[] => {
  const nxPackageJson = require.resolve('nx/package.json');
  const nxEntrypoint = path.join(path.dirname(nxPackageJson), 'dist', 'bin', 'nx.js');
  const scopeArguments = full ? [] : ['--affected', '--base', base, '--head', head];
  const output = execFileSync(
    process.execPath,
    [nxEntrypoint, 'show', 'projects', '--withTarget=test:unit', ...scopeArguments, '--json'],
    {
      encoding: 'utf8',
      env: process.env,
    }
  ).trim();

  if (output.length === 0) {
    return [];
  }

  return JSON.parse(output) as string[];
};

export const buildUnitProjectCommand = (project: string): string =>
  `env -u NO_COLOR pnpm nx run ${project}:test:unit --nxBail --output-style=stream`;

export const resolveAppUnitExecutionPlan = (
  changedFiles: readonly string[],
  affectedProjects: readonly string[],
  changedProjectPlan: ChangedProjectPlan
): AppUnitExecutionPlan => {
  if (
    changedProjectPlan.reason === 'nx-project-graph-unavailable' &&
    affectedProjects.includes(APP_PROJECT)
  ) {
    return { mode: 'aggregate', reason: 'nx-project-graph-unavailable', slices: [] };
  }

  return planAppUnitExecution(changedFiles, affectedProjects);
};

export const hasPlannedUnitProjects = (plan: ChangedProjectPlan): boolean =>
  plan.directProjects.length > 0 || plan.remainingProjects.length > 0;

export const runAffectedUnitGate = (
  options: BaseHeadCliOptions,
  reportDuration?: (entry: DurationEntry) => void,
  reportPlan?: (plan: ReturnType<typeof planChangedProjectsWithFallback>) => void,
  phase: UnitGatePhase = 'all'
): DurationEntry[] => {
  const full = process.env.NX_RUN_FULL === '1';
  const fullProjects = getUnitProjects(options.base, options.head, true);
  let changedFiles: string[];
  let affectedProjects: string[];
  let changedProjectPlan: ChangedProjectPlan;
  try {
    changedFiles = resolveChangedFiles(options.base, options.head);
    affectedProjects = getUnitProjects(options.base, options.head, full);
    changedProjectPlan = planChangedProjectsWithFallback(
      changedFiles,
      affectedProjects,
      loadNxProjectRoots,
      fullProjects
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Base-/Head-Scope ist ungültig; verwende vollständigen Unit-Fallback: ${message}`);
    changedFiles = [];
    affectedProjects = fullProjects;
    changedProjectPlan = {
      mode: 'full-fallback',
      reason: 'invalid-base-or-head',
      directProjects: [],
      remainingProjects: fullProjects,
      unmappedFiles: [],
    };
  }
  reportPlan?.(changedProjectPlan);
  const durationEntries: DurationEntry[] = [];
  const appPlan = resolveAppUnitExecutionPlan(changedFiles, affectedProjects, changedProjectPlan);
  const directNonAppProjects = changedProjectPlan.directProjects.filter(
    (project) => project !== APP_PROJECT
  );
  const remainingNonAppProjects = changedProjectPlan.remainingProjects.filter(
    (project) => project !== APP_PROJECT
  );

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

  if (phase !== 'remaining' && changedProjectPlan.directProjects.includes(APP_PROJECT)) {
    if (appPlan.mode === 'aggregate') {
      runTarget('unit:direct:app', buildAppUnitCommand(), [APP_PROJECT]);
    } else if (appPlan.mode === 'slices') {
      for (const slice of appPlan.slices) {
        runTarget(`unit:direct:app:${slice}`, buildAppUnitCommand(slice), [APP_PROJECT]);
      }
    }
  }

  if (phase !== 'direct') {
    if (changedProjectPlan.remainingProjects.includes(APP_PROJECT)) {
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
  const options = parseBaseHeadCliOptions(args);
  const phaseArgumentIndex = args.indexOf('--phase');
  const phaseValue = phaseArgumentIndex >= 0 ? args[phaseArgumentIndex + 1] : 'all';
  if (phaseValue !== 'all' && phaseValue !== 'direct' && phaseValue !== 'remaining') {
    throw new Error(`Ungültige Unit-Phase: ${phaseValue ?? '<fehlend>'}`);
  }
  const phase: UnitGatePhase = phaseValue;
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
      phase
    );
  } catch (error) {
    writeCiFeedbackEvidence(
      buildCiFeedbackEvidence({
        gate: 'unit',
        role: phase === 'direct' ? 'fast-feedback' : 'complete',
        shardId: `unit-${phase}`,
        status: 'failed',
        baseSha: options.base,
        headSha: options.head,
        scopeMode: full ? 'full' : 'affected',
        plan,
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
      shardId: `unit-${phase}`,
      status: durationEntries.length === 0 ? 'skipped' : 'passed',
      baseSha: options.base,
      headSha: options.head,
      scopeMode: full ? 'full' : 'affected',
      plan,
      phases: durationEntries,
      startedAt,
      finishedAt: new Date(),
      workflowCreatedAt: parseOptionalDate(process.env.CI_WORKFLOW_CREATED_AT),
      jobStartedAt: parseOptionalDate(process.env.CI_JOB_STARTED_AT),
    })
  );

  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runAffectedUnitGateCli(process.argv.slice(2)));
}
