import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseBaseHeadCliOptions, type BaseHeadCliOptions } from './base-head-cli-options.ts';
import { CiCommandExecutionError, runCiCommand } from './ci-command-runner.ts';
import { buildCiFeedbackEvidence, writeCiFeedbackEvidence } from './ci-feedback-evidence.ts';
import { clearWorkspaceCoverageOutputs, mergeProjectCoverage } from './validate-downloaded-coverage.ts';
import { planChangedProjectsWithFallback } from './changed-project-plan.ts';
import {
  coveragePartitions,
  parseCoveragePartition,
  buildAppCoverageCommand,
  buildCoverageProjectCommand,
  buildEarlyCoverageGateCommand,
  buildCoveragePartitionCommand,
  resolveCurrentCoveragePlan,
  selectCoveragePartition,
  type ResolvedCoveragePlan,
} from './coverage-plan.ts';
import {
  validateCoveragePartitions,
  writeCoveragePartitionEvidence,
  writeCoverageShardEvidence,
  type CoveragePartitionEvidence,
} from './coverage-shard-evidence.ts';

export interface DurationEntry {
  label: string;
  durationMs: number;
  projects?: string[];
  retryCount?: number;
}

const APP_PROJECT = 'sva-studio-react';
const executeCoveragePlan = (
  options: BaseHeadCliOptions,
  resolvedPlan: ResolvedCoveragePlan,
  recordDuration: (entry: DurationEntry) => void
): void => {
  const { changedProjectPlan, projectRoots } = resolvedPlan;
  const runTarget = (phase: 'direct' | 'remaining', project: string, command: string): void => {
    try {
      const result = runCiCommand(command);
      recordDuration({
        label: `coverage:${phase}:${project}`,
        durationMs: result.durationMs,
        projects: [project],
        retryCount: result.retryCount,
      });
      writeCoverageShardEvidence({
        project,
        phase,
        headSha: options.head,
        projectRoots,
      });
    } catch (error) {
      if (error instanceof CiCommandExecutionError) {
        recordDuration({
          label: `coverage:${phase}:${project}`,
          durationMs: error.durationMs,
          projects: [project],
          retryCount: error.retryCount,
        });
      }
      throw error;
    }
  };
  const runPhase = (phase: 'direct' | 'remaining', projects: readonly string[]): void => {
    for (const project of projects) {
      runTarget(
        phase,
        project,
        project === APP_PROJECT ? buildAppCoverageCommand() : buildCoverageProjectCommand(project)
      );
    }
  };

  runPhase('direct', changedProjectPlan.directProjects);
  if (changedProjectPlan.directProjects.length > 0) {
    const result = runCiCommand(buildEarlyCoverageGateCommand(changedProjectPlan.directProjects));
    recordDuration({ label: 'coverage:direct-project-gate', durationMs: result.durationMs });
  }
  runPhase('remaining', changedProjectPlan.remainingProjects);
};

export const runAffectedCoverageGate = (
  options: BaseHeadCliOptions,
  reportDuration?: (entry: DurationEntry) => void,
  reportPlan?: (plan: ReturnType<typeof planChangedProjectsWithFallback>) => void,
  partition?: string
): DurationEntry[] => {
  const startedAt = new Date();
  clearWorkspaceCoverageOutputs();
  const resolvedPlan = resolveCurrentCoveragePlan(options);
  const { affectedProjects, changedFiles, changedProjectPlan } = resolvedPlan;
  reportPlan?.(changedProjectPlan);
  const durationEntries: DurationEntry[] = [];

  const recordDuration = (entry: DurationEntry): void => {
    durationEntries.push(entry);
    reportDuration?.(entry);
  };

  console.log(
    JSON.stringify(
      {
        base: options.base,
        head: options.head,
        scopeMode: process.env.NX_RUN_FULL === '1' ? 'full' : 'affected',
        changedFiles,
        affectedProjects,
        changedProjectPlan,
      },
      null,
      2
    )
  );

  if (affectedProjects.length === 0 && !partition) {
    console.log('Keine betroffenen Coverage-Projekte erkannt.');
    return durationEntries;
  }

  if (partition) {
    for (const project of selectCoveragePartition(resolvedPlan, partition)) {
      const result = runCiCommand(buildCoveragePartitionCommand(project, partition));
      recordDuration({
        label: `coverage:${partition}:${project}`,
        projects: [project],
        durationMs: result.durationMs,
        retryCount: result.retryCount,
      });
    }
    writeCoveragePartitionEvidence({
      partition,
      baseSha: options.base,
      headSha: options.head,
      plan: resolvedPlan,
      phases: durationEntries,
      timing: { startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString() },
    });
  } else executeCoveragePlan(options, resolvedPlan, recordDuration);

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

export const runAffectedCoverageGateCli = (args: readonly string[]): number => {
  const options = parseBaseHeadCliOptions(args);
  const partitionIndex = args.indexOf('--partition');
  const partition =
    partitionIndex >= 0 ? parseCoveragePartition(args[partitionIndex + 1] ?? '') : undefined;
  const mergeIndex = args.indexOf('--merge-partitions');
  if (mergeIndex >= 0) {
    mergeCoveragePartitions(options, args[mergeIndex + 1], args.includes('--priority-only'));
    return 0;
  }
  const startedAt = new Date();
  const full = process.env.NX_RUN_FULL === '1';
  let plan: ReturnType<typeof planChangedProjectsWithFallback> | null = null;
  const durationEntries: DurationEntry[] = [];

  try {
    runAffectedCoverageGate(
      options,
      (entry) => durationEntries.push(entry),
      (reportedPlan) => {
        plan = reportedPlan;
      },
      partition
    );
  } catch (error) {
    writeCiFeedbackEvidence(
      buildCiFeedbackEvidence({
        gate: 'coverage',
        role: 'complete',
        shardId: partition ? `coverage-${partition}` : 'coverage-complete',
        status: 'failed',
        baseSha: options.base,
        headSha: options.head,
        scopeMode: process.env.NX_RUN_FULL === '1' ? 'full' : 'affected',
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
    console.error(`Coverage Fast Feedback fehlgeschlagen: ${message}`);
    return 1;
  }

  if (durationEntries.length > 0) {
    console.log('\nAffected coverage summary:');
    for (const entry of durationEntries) {
      console.log(`- ${entry.label}: ${formatDuration(entry.durationMs)}`);
    }
  }

  writeCiFeedbackEvidence(
    buildCiFeedbackEvidence({
      gate: 'coverage',
      role: 'complete',
      shardId: partition ? `coverage-${partition}` : 'coverage-complete',
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

export const mergeCoveragePartitions = (
  options: BaseHeadCliOptions,
  directory: string | undefined,
  priorityOnly = false
): void => {
  const startedAt = new Date();
  if (!directory) throw new Error('Coverage-Partitionsverzeichnis fehlt.');
  const expected = priorityOnly
    ? coveragePartitions.filter((partition) => !partition.startsWith('remaining-'))
    : coveragePartitions;
  const entries = validateCoveragePartitions({
    directory,
    baseSha: options.base,
    headSha: options.head,
    expected,
  });
  const resolved = entries[0].plan;
  const current = resolveCurrentCoveragePlan(options);
  if (JSON.stringify(resolved) !== JSON.stringify(current))
    throw new Error('Coverage-Plan entspricht nicht dem aktuellen Quellstand.');
  const projects = priorityOnly
    ? resolved.changedProjectPlan.directProjects
    : resolved.affectedProjects;
  const rootDir = process.cwd();
  clearWorkspaceCoverageOutputs(rootDir);
  const mergePhases: DurationEntry[] = [];
  for (const project of projects) {
    const projectStarted = performance.now();
    mergeProjectCoverage(project, entries, directory, rootDir);
    mergePhases.push({
      label: `coverage:merge:${project}`,
      projects: [project],
      durationMs: performance.now() - projectStarted,
    });
    writeCoverageShardEvidence({
      project,
      phase: resolved.changedProjectPlan.directProjects.includes(project) ? 'direct' : 'remaining',
      headSha: options.head,
      projectRoots: resolved.projectRoots,
    });
  }
  if (priorityOnly && projects.length > 0) runCiCommand(buildEarlyCoverageGateCommand(projects));
  if (!priorityOnly)
    writeCiFeedbackEvidence(
      buildCiFeedbackEvidence({
        gate: 'coverage',
        role: 'complete',
        shardId: 'coverage-complete',
        status: projects.length ? 'passed' : 'skipped',
        baseSha: options.base,
        headSha: options.head,
        scopeMode: process.env.NX_RUN_FULL === '1' ? 'full' : 'affected',
        plan: resolved.changedProjectPlan,
        phases: [...entries.flatMap((entry) => entry.phases), ...mergePhases],
        startedAt,
        finishedAt: new Date(),
        aggregationMs: Date.now() - startedAt.getTime(),
      })
    );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runAffectedCoverageGateCli(process.argv.slice(2)));
}
