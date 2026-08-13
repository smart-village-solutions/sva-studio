import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseBaseHeadCliOptions, type BaseHeadCliOptions } from './base-head-cli-options.ts';
import { buildCiFeedbackEvidence, writeCiFeedbackEvidence } from './ci-feedback-evidence.ts';
import { planChangedProjectsWithFallback } from './changed-project-plan.ts';
import { loadNxProjectRoots } from './nx-project-graph.ts';
import { resolveChangedFiles } from './pr-scope.ts';

export interface DurationEntry {
  label: string;
  durationMs: number;
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

const runCommand = (command: string): number => {
  console.log(`\n$ ${command}`);
  const startedAt = performance.now();
  execSync(command, {
    env: process.env,
    stdio: 'inherit',
  });
  return performance.now() - startedAt;
};

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

export const buildAppCoverageCommand = (): string => `pnpm nx run ${APP_PROJECT}:test:coverage`;

export const buildCoverageProjectsCommand = (projects: readonly string[]): string =>
  `env -u NO_COLOR pnpm nx run-many --target=test:coverage --projects=${projects.join(',')} --parallel=1 --nxBail --output-style=stream`;

export const buildEarlyCoverageGateCommand = (projects: readonly string[]): string =>
  `COVERAGE_GATE_EVALUATE_REGRESSIONS=1 COVERAGE_GATE_PROJECT_FILTER=${projects.join(',')} pnpm coverage-gate`;

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
};

export const runAffectedCoverageGate = (
  options: BaseHeadCliOptions,
  reportDuration?: (entry: DurationEntry) => void,
  reportPlan?: (plan: ReturnType<typeof planChangedProjectsWithFallback>) => void
): DurationEntry[] => {
  clearWorkspaceCoverageOutputs();
  const full = process.env.NX_RUN_FULL === '1';
  const changedFiles = resolveChangedFiles(options.base, options.head);
  const affectedProjects = getCoverageProjects(options.base, options.head, full);
  const changedProjectPlan = planChangedProjectsWithFallback(
    changedFiles,
    affectedProjects,
    loadNxProjectRoots
  );
  reportPlan?.(changedProjectPlan);
  const durationEntries: DurationEntry[] = [];
  const directNonAppProjects = changedProjectPlan.directProjects.filter(
    (project) => project !== APP_PROJECT
  );
  const remainingNonAppProjects = changedProjectPlan.remainingProjects.filter(
    (project) => project !== APP_PROJECT
  );
  const directApp = changedProjectPlan.directProjects.includes(APP_PROJECT);
  const remainingApp = changedProjectPlan.remainingProjects.includes(APP_PROJECT);

  const recordDuration = (label: string, durationMs: number): void => {
    const entry = { label, durationMs };
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

  if (directNonAppProjects.length > 0) {
    recordDuration(
      'coverage:direct-projects',
      runCommand(buildCoverageProjectsCommand(directNonAppProjects))
    );
  }

  if (directApp) {
    recordDuration('coverage:app', runCommand(buildAppCoverageCommand()));
  }

  if (changedProjectPlan.directProjects.length > 0) {
    recordDuration(
      'coverage:direct-project-gate',
      runCommand(buildEarlyCoverageGateCommand(changedProjectPlan.directProjects))
    );
  }

  if (remainingNonAppProjects.length > 0) {
    recordDuration(
      'coverage:remaining-projects',
      runCommand(buildCoverageProjectsCommand(remainingNonAppProjects))
    );
  }

  if (remainingApp) {
    recordDuration('coverage:remaining-app', runCommand(buildAppCoverageCommand()));
  }

  return durationEntries;
};

const formatDuration = (durationMs: number): string => `${(durationMs / 1000).toFixed(2)}s`;

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
        status: 'failed',
        baseSha: options.base,
        headSha: options.head,
        scopeMode: full ? 'full' : 'affected',
        plan,
        phases: durationEntries,
        startedAt,
        finishedAt: new Date(),
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
      status: 'passed',
      baseSha: options.base,
      headSha: options.head,
      scopeMode: full ? 'full' : 'affected',
      plan,
      phases: durationEntries,
      startedAt,
      finishedAt: new Date(),
    })
  );

  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runAffectedCoverageGateCli(process.argv.slice(2)));
}
