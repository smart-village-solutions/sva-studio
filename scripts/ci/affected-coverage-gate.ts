import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseBaseHeadCliOptions, type BaseHeadCliOptions } from './base-head-cli-options.ts';
import { CiCommandExecutionError, runCiCommand } from './ci-command-runner.ts';
import { buildCiFeedbackEvidence, writeCiFeedbackEvidence } from './ci-feedback-evidence.ts';
import { planChangedProjectsWithFallback } from './changed-project-plan.ts';
import { readJson, type CoveragePolicy } from './coverage-gate.ts';
import { resolveCoveragePlan, type ResolvedCoveragePlan } from './coverage-plan.ts';
import { writeCoverageShardEvidence } from './coverage-shard-evidence.ts';
import { loadNxProjectRoots, loadWorkspaceProjectRoots } from './nx-project-graph.ts';
import { resolveChangedFiles } from './pr-scope.ts';

export interface DurationEntry {
  label: string;
  durationMs: number;
  projects?: string[];
  retryCount?: number;
}

const APP_PROJECT = 'sva-studio-react';
const COVERAGE_WORKSPACE_ROOTS = ['apps', 'packages'] as const;
const IGNORED_DIRECTORY_NAMES = new Set([
  'node_modules',
  '.git',
  '.nx',
  '.output',
  'dist',
  'build',
  '.generated',
]);
const require = createRequire(import.meta.url);

const getCoverageProjects = (base: string, head: string, full: boolean): string[] => {
  const nxPackageJson = require.resolve('nx/package.json');
  const nxEntrypoint = path.join(path.dirname(nxPackageJson), 'dist', 'bin', 'nx.js');
  const scopeArguments = full ? [] : ['--affected', '--base', base, '--head', head];
  const output = execFileSync(
    process.execPath,
    [nxEntrypoint, 'show', 'projects', '--withTarget=test:coverage', ...scopeArguments, '--json'],
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

export const excludeCoverageExemptProjects = (
  projects: readonly string[],
  exemptProjects: readonly string[]
): string[] => {
  const exemptions = new Set(exemptProjects);
  return projects.filter((project) => !exemptions.has(project));
};

export const buildAppCoverageCommand = (): string => `pnpm nx run ${APP_PROJECT}:test:coverage`;

export const buildCoverageProjectCommand = (project: string): string =>
  `env -u NO_COLOR pnpm nx run ${project}:test:coverage --nxBail --output-style=stream`;

export const buildEarlyCoverageGateCommand = (projects: readonly string[]): string =>
  `COVERAGE_GATE_EVALUATE_REGRESSIONS=1 COVERAGE_GATE_PROJECT_FILTER=${projects.join(',')} pnpm coverage-gate`;

export const writeCoverageShardShadowEvidence = (
  options: Parameters<typeof writeCoverageShardEvidence>[0],
  writeEvidence: typeof writeCoverageShardEvidence = writeCoverageShardEvidence
): void => {
  try {
    writeEvidence(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Coverage-Shard-Shadow-Evidenz konnte nicht geschrieben werden: ${message}`);
  }
};

const removeProjectRootCoverageDirectory = (workspaceRootPath: string): void => {
  if (!fs.existsSync(workspaceRootPath)) {
    return;
  }

  for (const entry of fs.readdirSync(workspaceRootPath, { withFileTypes: true })) {
    if (!entry.isDirectory() || IGNORED_DIRECTORY_NAMES.has(entry.name)) {
      continue;
    }

    const coverageDirectoryPath = path.join(workspaceRootPath, entry.name, 'coverage');
    if (fs.existsSync(coverageDirectoryPath)) {
      fs.rmSync(coverageDirectoryPath, { recursive: true, force: true });
    }
  }
};

export const clearWorkspaceCoverageOutputs = (rootDir = process.cwd()): void => {
  for (const workspaceRoot of COVERAGE_WORKSPACE_ROOTS) {
    removeProjectRootCoverageDirectory(path.join(rootDir, workspaceRoot));
  }
  fs.rmSync(path.join(rootDir, 'artifacts', 'ci-feedback', 'coverage-shards'), {
    recursive: true,
    force: true,
  });
};

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
      writeCoverageShardShadowEvidence({
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
  reportPlan?: (plan: ReturnType<typeof planChangedProjectsWithFallback>) => void
): DurationEntry[] => {
  clearWorkspaceCoverageOutputs();
  const full = process.env.NX_RUN_FULL === '1';
  const coveragePolicy = readJson<CoveragePolicy>(
    path.join(process.cwd(), 'tooling/testing/coverage-policy.json')
  );
  const getPolicyCoveredProjects = (base: string, head: string, runFull: boolean): string[] =>
    excludeCoverageExemptProjects(
      getCoverageProjects(base, head, runFull),
      coveragePolicy.exemptProjects
    );
  const fullProjects = getPolicyCoveredProjects(options.base, options.head, true);
  const resolvedPlan = resolveCoveragePlan(options, full, fullProjects, {
    resolveChangedFiles,
    getCoverageProjects: getPolicyCoveredProjects,
    loadNxProjectRoots,
    loadWorkspaceProjectRoots,
  });
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
        scopeMode: full ? 'full' : 'affected',
        changedFiles,
        affectedProjects,
        changedProjectPlan,
      },
      null,
      2
    )
  );

  if (affectedProjects.length === 0) {
    console.log('Keine betroffenen Coverage-Projekte erkannt.');
    return durationEntries;
  }

  executeCoveragePlan(options, resolvedPlan, recordDuration);

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
      }
    );
  } catch (error) {
    writeCiFeedbackEvidence(
      buildCiFeedbackEvidence({
        gate: 'coverage',
        role: 'complete',
        shardId: 'coverage-complete',
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
      shardId: 'coverage-complete',
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
  process.exit(runAffectedCoverageGateCli(process.argv.slice(2)));
}
