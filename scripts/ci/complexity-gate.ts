#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveChangedFiles, resolveModuleFiles } from './complexity-files.ts';
import { assertComplexityPolicy } from './complexity-policy.ts';
import { buildBaseline, collectViolations, generateReport } from './complexity-results.ts';
import type {
  AnalyzedFile,
  ComplexityBaseline,
  ComplexityPaths,
  ComplexityPolicy,
  RunComplexityGateOptions,
  RunComplexityGateResult,
} from './complexity-policy.ts';
export type {
  ModuleClass,
  ComplexityMetricKey,
  ComplexityThresholds,
  ComplexityModule,
  TrackedFinding,
  ComplexityPolicy,
  FileComplexityMetrics,
  ComplexityBaselineEntry,
  ComplexityBaseline,
  RunComplexityGateOptions,
  RunComplexityGateResult,
} from './complexity-policy.ts';
export { assertComplexityPolicy } from './complexity-policy.ts';
export { analyzeFile } from './complexity-metrics.ts';

export function readCliOptionValue(
  argv: readonly string[],
  optionName: string
): string | undefined {
  const directIndex = argv.indexOf(optionName);
  if (directIndex >= 0) {
    return argv[directIndex + 1];
  }

  const inlinePrefix = `${optionName}=`;
  const inlineValue = argv.find((arg) => arg.startsWith(inlinePrefix));
  return inlineValue ? inlineValue.slice(inlinePrefix.length) : undefined;
}

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

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function resolveComplexityPaths(rootDir: string): ComplexityPaths {
  return {
    rootDir,
    policyPath: path.join(rootDir, 'tooling/quality/complexity-policy.json'),
    baselinePath: path.join(rootDir, 'tooling/quality/complexity-baseline.json'),
  };
}

function loadComplexityData(rootDir: string): {
  paths: ComplexityPaths;
  policy: ComplexityPolicy;
  baseline: ComplexityBaseline;
  analyzedFiles: AnalyzedFile[];
} {
  const paths = resolveComplexityPaths(rootDir);
  if (!fs.existsSync(paths.policyPath)) {
    throw new Error(`Complexity policy not found: ${paths.policyPath}`);
  }

  const rawPolicy = readJson<unknown>(paths.policyPath);
  assertComplexityPolicy(rawPolicy);

  const baseline = fs.existsSync(paths.baselinePath)
    ? readJson<ComplexityBaseline>(paths.baselinePath)
    : { files: {} };

  return {
    paths,
    policy: rawPolicy,
    baseline,
    analyzedFiles: resolveModuleFiles(rootDir, rawPolicy.modules),
  };
}

function writeSummary(stepSummaryPath: string | null, summaryBody: string): void {
  if (stepSummaryPath) {
    fs.appendFileSync(stepSummaryPath, summaryBody, 'utf8');
  }
}

export function runComplexityGate(options: RunComplexityGateOptions = {}): RunComplexityGateResult {
  const rootDir = options.rootDir ?? process.cwd();
  const updateBaseline = options.updateBaseline ?? false;
  const baseRef = options.baseRef?.trim();
  const headRef = options.headRef?.trim() || 'HEAD';
  const stepSummaryPath = options.stepSummaryPath ?? process.env.GITHUB_STEP_SUMMARY ?? null;
  const { paths, policy, baseline, analyzedFiles: allAnalyzedFiles } = loadComplexityData(rootDir);

  if (allAnalyzedFiles.length === 0) {
    throw new Error('No files matched the complexity policy');
  }

  if (updateBaseline) {
    const nextBaseline = buildBaseline(allAnalyzedFiles);
    fs.writeFileSync(paths.baselinePath, JSON.stringify(nextBaseline, null, 2) + '\n', 'utf8');
    return {
      passed: true,
      updatedBaseline: true,
      summaryBody: '',
      trackedViolations: [],
      untrackedViolations: [],
      analyzedFiles: allAnalyzedFiles,
    };
  }

  const changedFiles =
    baseRef && baseRef.length > 0 ? resolveChangedFiles(rootDir, baseRef, headRef) : null;
  const analyzedFiles = changedFiles
    ? allAnalyzedFiles.filter((analyzedFile) => changedFiles.has(analyzedFile.metrics.filePath))
    : allAnalyzedFiles;

  if (analyzedFiles.length === 0) {
    const summaryBody =
      [
        '## Complexity Summary',
        '',
        'Keine vom Diff betroffenen Dateien innerhalb des Complexity-Scopes gefunden.',
        '',
        'Ausgewertete Dateien: 0',
        'Neue Findings: 0',
        'Getrackte Findings: 0',
      ].join('\n') + '\n';
    writeSummary(stepSummaryPath, summaryBody);
    return {
      passed: true,
      updatedBaseline: false,
      summaryBody,
      trackedViolations: [],
      untrackedViolations: [],
      analyzedFiles: [],
    };
  }

  const violations = collectViolations(policy, baseline, analyzedFiles);
  const trackedViolations = violations.filter((violation) => violation.trackedFinding);
  const untrackedViolations = violations.filter((violation) => !violation.trackedFinding);
  const summaryBody = generateReport(analyzedFiles, violations);
  writeSummary(stepSummaryPath, summaryBody);

  return {
    passed: untrackedViolations.length === 0,
    updatedBaseline: false,
    summaryBody,
    trackedViolations,
    untrackedViolations,
    analyzedFiles,
  };
}

export function main(): number {
  const rootDir = process.cwd();
  const updateBaseline = process.argv.includes('--update-baseline');
  const baseRef = readCliOptionValue(process.argv, '--base');
  const headRef = readCliOptionValue(process.argv, '--head');

  try {
    const result = runComplexityGate({
      rootDir,
      updateBaseline,
      baseRef,
      headRef,
      stepSummaryPath: process.env.GITHUB_STEP_SUMMARY ?? null,
    });

    if (result.updatedBaseline) {
      console.log(
        colors.green(
          `✅ Updated complexity baseline at ${path.join(rootDir, 'tooling/quality/complexity-baseline.json')}`
        )
      );
      return 0;
    }

    console.log(colors.blue('📐 Complexity summary generated'));
    console.log(result.summaryBody);

    if (result.untrackedViolations.length > 0) {
      console.error(colors.red(`❌ ${colors.bold('Complexity gate failed')}:`));
      for (const violation of result.untrackedViolations) {
        console.error(
          colors.red(
            `- ${violation.moduleId} ${violation.filePath} ${violation.metric}: ${violation.current} > ${violation.threshold}`
          )
        );
      }
      return 1;
    }

    if (result.trackedViolations.length > 0) {
      console.warn(
        colors.yellow('⚠️  Complexity findings remain tracked via refactoring tickets.')
      );
    }

    console.log(colors.green('✅ Complexity gate passed.'));
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
