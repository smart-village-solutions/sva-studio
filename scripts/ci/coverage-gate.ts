#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadCoverageData } from './coverage-artifacts.ts';
import {
  evaluateCriticalHotspots,
  evaluateFloors,
  evaluateRegressions,
} from './coverage-evaluation.ts';
import { generateReport } from './coverage-metrics.ts';
import type {
  CoverageBaseline,
  RunCoverageGateOptions,
  RunCoverageGateResult,
} from './coverage-policy.ts';
export type {
  CoverageMetric,
  MetricFloors,
  CoveragePolicy,
  CoverageBaseline,
  CoverageSummary,
  HotspotCoverageFloors,
  CriticalCoverageHotspot,
  CriticalCoveragePolicy,
} from './coverage-policy.ts';
export { readJson, assertCoveragePolicy } from './coverage-policy.ts';
export {
  findCoverageSummaries,
  findCoverageArtifacts,
  projectFromCoveragePath,
} from './coverage-artifacts.ts';
export { toMetricValues, mergeGlobal } from './coverage-metrics.ts';

const isTTY = process.stdout.isTTY;
const colorize = (code: string, text: string): string =>
  isTTY ? `\x1b[${code}m${text}\x1b[0m` : text;
const colors = {
  green: (text: string): string => colorize('32', text),
  red: (text: string): string => colorize('31', text),
  yellow: (text: string): string => colorize('33', text),
  blue: (text: string): string => colorize('34', text),
  bold: (text: string): string => colorize('1', text),
};

function writeSummary(stepSummaryPath: string | null, summaryBody: string): void {
  if (stepSummaryPath) {
    fs.appendFileSync(stepSummaryPath, summaryBody, 'utf8');
  }
}

export function runCoverageGate(options: RunCoverageGateOptions = {}): RunCoverageGateResult {
  const rootDir = options.rootDir ?? process.cwd();
  const updateBaseline = options.updateBaseline ?? false;
  const requireSummaries = options.requireSummaries ?? false;
  const evaluateRegressionDrops = options.evaluateRegressions ?? requireSummaries;
  const regressionProjectFilter = options.regressionProjectFilter ?? [];
  const stepSummaryPath = options.stepSummaryPath ?? process.env.GITHUB_STEP_SUMMARY ?? null;

  const loaded = loadCoverageData(rootDir);
  const { paths, policy, baseline, projects, fileCoverageByProject } = loaded;

  if (Object.keys(projects).length === 0) {
    if (requireSummaries) {
      throw new Error(
        'No coverage-summary.json files found. Failing coverage gate because requireSummaries=true.'
      );
    }

    return {
      passed: true,
      updatedBaseline: false,
      summaryBody: '',
      errors: [],
      projects,
    };
  }

  if (updateBaseline) {
    const nextBaseline: CoverageBaseline = { projects };
    fs.writeFileSync(paths.baselinePath, JSON.stringify(nextBaseline, null, 2) + '\n', 'utf8');
    return {
      passed: true,
      updatedBaseline: true,
      summaryBody: '',
      errors: [],
      projects,
    };
  }

  const floorErrors = evaluateFloors(policy, projects, requireSummaries);
  const hotspotErrors = evaluateCriticalHotspots(
    policy,
    projects,
    fileCoverageByProject,
    requireSummaries
  );
  const regressionErrors = evaluateRegressions(
    policy,
    baseline,
    projects,
    evaluateRegressionDrops,
    regressionProjectFilter
  );
  const errors = [...floorErrors, ...hotspotErrors, ...regressionErrors];

  const summaryBody = generateReport(policy, projects);
  writeSummary(stepSummaryPath, summaryBody);

  const sortedErrors = errors
    .sort((a, b) => {
      if (a.scope === b.scope) return a.message.localeCompare(b.message);
      return a.scope === 'global' ? -1 : 1;
    })
    .map((error) => error.message);

  return {
    passed: sortedErrors.length === 0,
    updatedBaseline: false,
    summaryBody,
    errors: sortedErrors,
    projects,
  };
}

export function main(): number {
  const rootDir = process.cwd();
  const updateBaseline = process.argv.includes('--update-baseline');
  const requireSummaries = process.env.COVERAGE_GATE_REQUIRE_SUMMARIES === '1';
  const evaluateRegressions =
    process.env.COVERAGE_GATE_EVALUATE_REGRESSIONS === '1' ? true : undefined;
  const regressionProjectFilter = (process.env.COVERAGE_GATE_PROJECT_FILTER ?? '')
    .split(',')
    .map((projectName) => projectName.trim())
    .filter(Boolean);

  try {
    const result = runCoverageGate({
      rootDir,
      updateBaseline,
      requireSummaries,
      evaluateRegressions,
      regressionProjectFilter,
      stepSummaryPath: process.env.GITHUB_STEP_SUMMARY ?? null,
    });

    if (result.updatedBaseline) {
      const baselinePath = path.join(rootDir, 'tooling/testing/coverage-baseline.json');
      console.log(colors.green(`✅ Updated baseline at ${baselinePath}`));
      return 0;
    }

    if (!result.summaryBody) {
      console.warn(
        colors.yellow('⚠️  No coverage-summary.json files found. Skipping coverage gate.')
      );
      return 0;
    }

    console.log(colors.blue('📊 Coverage summary generated'));
    console.log(result.summaryBody);

    if (!result.passed) {
      console.error(colors.red(`❌ ${colors.bold('Coverage gate failed')}:`));
      for (const error of result.errors) {
        console.error(colors.red(`- ${error}`));
      }
      return 1;
    }

    console.log(colors.green('✅ Coverage gate passed.'));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(colors.red(`❌ ${message}`));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
