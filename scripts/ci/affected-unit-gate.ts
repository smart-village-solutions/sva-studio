import { execFileSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseBaseHeadCliOptions, type BaseHeadCliOptions } from './base-head-cli-options.ts';
import { buildCiFeedbackEvidence, writeCiFeedbackEvidence } from './ci-feedback-evidence.ts';
import { buildAppUnitCommand, planAppUnitExecution } from './affected-unit-plan.ts';
import { planChangedProjectsWithFallback } from './changed-project-plan.ts';
import { loadNxProjectRoots } from './nx-project-graph.ts';
import { resolveChangedFiles } from './pr-scope.ts';

export interface DurationEntry {
  label: string;
  durationMs: number;
}

const APP_PROJECT = 'sva-studio-react';
const require = createRequire(import.meta.url);
const runCommand = (command: string): number => {
  const startedAt = performance.now();

  console.log(`\n$ ${command}`);
  execSync(command, {
    env: process.env,
    stdio: 'inherit',
  });
  return performance.now() - startedAt;
};

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

export const buildUnitProjectsCommand = (projects: readonly string[]): string =>
  `env -u NO_COLOR pnpm nx run-many --target=test:unit --projects=${projects.join(',')} --parallel=1 --nxBail --output-style=stream`;

export const runAffectedUnitGate = (
  options: BaseHeadCliOptions,
  reportDuration?: (entry: DurationEntry) => void,
  reportPlan?: (plan: ReturnType<typeof planChangedProjectsWithFallback>) => void
): DurationEntry[] => {
  const changedFiles = resolveChangedFiles(options.base, options.head);
  const full = process.env.NX_RUN_FULL === '1';
  const affectedProjects = getUnitProjects(options.base, options.head, full);
  const changedProjectPlan = planChangedProjectsWithFallback(
    changedFiles,
    affectedProjects,
    loadNxProjectRoots
  );
  reportPlan?.(changedProjectPlan);
  const durationEntries: DurationEntry[] = [];
  const appPlan = planAppUnitExecution(changedFiles, affectedProjects);
  const directNonAppProjects = changedProjectPlan.directProjects.filter(
    (project) => project !== APP_PROJECT
  );
  const remainingNonAppProjects = changedProjectPlan.remainingProjects.filter(
    (project) => project !== APP_PROJECT
  );

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
        appPlan,
      },
      null,
      2
    )
  );

  if (affectedProjects.length === 0) {
    console.log('Keine betroffenen Unit-Projekte erkannt.');
    return durationEntries;
  }

  if (directNonAppProjects.length > 0) {
    recordDuration(
      'unit:direct-projects',
      runCommand(buildUnitProjectsCommand(directNonAppProjects))
    );
  }

  if (affectedProjects.includes(APP_PROJECT)) {
    if (appPlan.mode === 'aggregate') {
      recordDuration('unit:app', runCommand(buildAppUnitCommand()));
    } else if (appPlan.mode === 'slices') {
      for (const slice of appPlan.slices) {
        recordDuration(`unit:app:${slice}`, runCommand(buildAppUnitCommand(slice)));
      }
    }
  }

  if (remainingNonAppProjects.length > 0) {
    recordDuration(
      'unit:remaining-projects',
      runCommand(buildUnitProjectsCommand(remainingNonAppProjects))
    );
  }

  return durationEntries;
};

const formatDuration = (durationMs: number): string => `${(durationMs / 1000).toFixed(2)}s`;

export const runAffectedUnitGateCli = (args: readonly string[]): number => {
  const options = parseBaseHeadCliOptions(args);
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
      }
    );
  } catch (error) {
    writeCiFeedbackEvidence(
      buildCiFeedbackEvidence({
        gate: 'unit',
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
  process.exit(runAffectedUnitGateCli(process.argv.slice(2)));
}
