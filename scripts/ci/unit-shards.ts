import path from 'node:path';
import {
  buildAppUnitJobCommand,
  isAppUnitJobSelected,
  resolveAppUnitJob,
  type AppUnitExecutionPlan,
} from './affected-unit-plan.ts';
import type { BaseHeadCliOptions } from './base-head-cli-options.ts';
import type { CiFeedbackDuration } from './ci-feedback-evidence.ts';
import { CiCommandExecutionError, runCiCommand } from './ci-command-runner.ts';
import { loadNxProjectsWithTarget, loadNxProjectRoots } from './nx-project-graph.ts';
import { resolveChangedFiles } from './pr-scope.ts';
import {
  planChangedProjectsWithFallback,
  type ChangedProjectPlan,
} from './changed-project-plan.ts';
/** Deterministic project sharding; each existing Nx target stays indivisible and cacheable. */
export interface UnitShard {
  index: number;
  count: number;
}

export const parseUnitShard = (value: string): UnitShard => {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/u.exec(value);
  const index = Number(match?.[1]);
  const count = Number(match?.[2]);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(count) || index > count) {
    throw new Error(`Ungültiger Unit-Shard: ${value}; erwartet index/count (1-basiert).`);
  }
  return { index, count };
};

export const unitShardId = ({ index, count }: UnitShard): string =>
  `unit-remaining-${index}-of-${count}`;

export const selectRemainingUnitProjects = (
  projects: readonly string[],
  shard: UnitShard
): string[] => {
  // Validate programmatic callers as well as CLI input.
  parseUnitShard(`${shard.index}/${shard.count}`);
  const sorted = [...new Set(projects)].sort();
  if (shard.count === 1) return sorted;
  // The app is the longest target in the measured full fallback. Isolate it
  // without changing its test selection, command or Nx cache key.
  const app = 'sva-studio-react';
  if (shard.index === 1) return sorted.filter((project) => project === app);
  return sorted
    .filter((project) => project !== app)
    .filter((_project, index) => index % (shard.count - 1) === shard.index - 2);
};

const executeAppUnitJob = (appJob: string): ReturnType<typeof runCiCommand> => {
  const previous = {
    manifest: process.env.CI_APP_UNIT_MANIFEST,
    root: process.env.CI_APP_UNIT_ROOT,
  };
  try {
    process.env.CI_APP_UNIT_MANIFEST = path.resolve(
      'artifacts',
      'ci-feedback',
      'app-unit-manifests',
      `${appJob}.json`
    );
    process.env.CI_APP_UNIT_ROOT = process.cwd();
    return runCiCommand(buildAppUnitJobCommand(appJob));
  } finally {
    if (previous.manifest === undefined) delete process.env.CI_APP_UNIT_MANIFEST;
    else process.env.CI_APP_UNIT_MANIFEST = previous.manifest;
    if (previous.root === undefined) delete process.env.CI_APP_UNIT_ROOT;
    else process.env.CI_APP_UNIT_ROOT = previous.root;
  }
};

export const resolveUnitScope = (
  options: BaseHeadCliOptions,
  full: boolean
): {
  changedFiles: string[];
  affectedProjects: string[];
  changedProjectPlan: ChangedProjectPlan;
} => {
  const fullProjects = loadNxProjectsWithTarget('test:unit', options.base, options.head, true);
  let changedFiles: string[];
  let affectedProjects: string[];
  let changedProjectPlan: ChangedProjectPlan;
  try {
    changedFiles = resolveChangedFiles(options.base, options.head);
    affectedProjects = loadNxProjectsWithTarget('test:unit', options.base, options.head, full);
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
  return { changedFiles, affectedProjects, changedProjectPlan };
};
export const runAppUnitPartition = (
  appPlan: AppUnitExecutionPlan,
  appJob: string | undefined,
  reportDuration?: (entry: CiFeedbackDuration) => void
): CiFeedbackDuration[] => {
  if (!appJob) throw new Error('App-Unit-Job fehlt.');
  resolveAppUnitJob(appJob);
  if (!isAppUnitJobSelected(appPlan, appJob)) return [];
  try {
    const result = executeAppUnitJob(appJob);
    const entry = {
      label: `unit:app:${appJob}`,
      projects: ['sva-studio-react'],
      durationMs: result.durationMs,
      retryCount: result.retryCount,
    };
    reportDuration?.(entry);
    return [entry];
  } catch (error) {
    if (error instanceof CiCommandExecutionError)
      reportDuration?.({
        label: `unit:app:${appJob}`,
        projects: ['sva-studio-react'],
        durationMs: error.durationMs,
        retryCount: error.retryCount,
      });
    throw error;
  }
};

export type UnitGatePhase = 'all' | 'direct' | 'remaining' | 'app';

export const assertShardPhase = (phase: UnitGatePhase, shard: UnitShard | undefined): void => {
  if (shard && phase !== 'remaining') {
    throw new Error('Unit-Sharding ist nur für die remaining-Phase zulässig.');
  }
};

export const parseUnitSelection = (
  args: readonly string[]
): { phase: UnitGatePhase; shard?: UnitShard; appJob?: string; shardId: string } => {
  const read = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index < 0) return undefined;
    if (!args[index + 1]) throw new Error(`Fehlender Wert für ${flag}`);
    return args[index + 1];
  };
  const phaseValue = read('--phase') ?? 'all';
  if (!['all', 'direct', 'remaining', 'app'].includes(phaseValue))
    throw new Error(`Ungültige Unit-Phase: ${phaseValue}`);
  const phase = phaseValue as UnitGatePhase;
  const shardValue = read('--shard');
  const shard = shardValue ? parseUnitShard(shardValue) : undefined;
  assertShardPhase(phase, shard);
  const appJob = read('--app-job');
  if (phase === 'app') resolveAppUnitJob(appJob ?? '');
  const shardId =
    phase === 'app' ? `unit-app-${appJob}` : shard ? unitShardId(shard) : `unit-${phase}`;
  return { phase, shard, appJob, shardId };
};
