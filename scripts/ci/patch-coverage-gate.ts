#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listChangedFiles, loadPolicy, resolveProjectRoots } from './new-code-coverage-scope.ts';
import {
  isLikelyExecutableLine,
  isLikelyNonExecutableFile,
  readSourceLines,
} from './new-code-coverage-source.ts';
import { parseLcovLineCoverage } from './patch-coverage-lcov.ts';
import { isSonarCoverageExcludedPath, readSonarCoverageExclusions } from './sonar-paths.ts';

interface RunPatchCoverageGateOptions {
  rootDir?: string;
  baseRef?: string;
  headRef?: string;
  targetPct?: number;
}

interface UncoveredFileSummary {
  path: string;
  covered: number;
  missed: number;
}

export interface RunPatchCoverageGateResult {
  passed: boolean;
  targetPct: number;
  coveragePct: number;
  coveredLines: number;
  missedLines: number;
  consideredFiles: number;
  ignoredFiles: number;
  uncoveredFiles: UncoveredFileSummary[];
}

const defaultTargetPct = 85;
export function runPatchCoverageGate(
  options: RunPatchCoverageGateOptions = {}
): RunPatchCoverageGateResult {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const baseRef = options.baseRef ?? 'origin/main';
  const headRef = options.headRef ?? 'HEAD';
  const targetPct = options.targetPct ?? defaultTargetPct;
  const policy = loadPolicy(rootDir);
  const sonarCoverageExclusions = readSonarCoverageExclusions(rootDir);
  const projectRoots = resolveProjectRoots(rootDir, policy);
  const changedFiles = listChangedFiles(rootDir, baseRef, headRef, projectRoots).filter(
    (changedFile) => !isSonarCoverageExcludedPath(changedFile.path, sonarCoverageExclusions)
  );
  const coverageByFile = parseLcovLineCoverage(rootDir, projectRoots);

  let coveredLines = 0;
  let missedLines = 0;
  let ignoredFiles = 0;
  const uncoveredFiles: UncoveredFileSummary[] = [];

  for (const changedFile of changedFiles) {
    const sourceLines = readSourceLines(rootDir, changedFile.path);
    const fileCoverage = coverageByFile.get(changedFile.path);
    const ignoreFileWithoutCoverage =
      !fileCoverage && isLikelyNonExecutableFile(changedFile.path, sourceLines);
    let fileCovered = 0;
    let fileMissed = 0;

    for (const changedLineNumber of changedFile.changedLines) {
      if (fileCoverage) {
        if (!fileCoverage.instrumentedLines.has(changedLineNumber)) {
          continue;
        }

        if (fileCoverage.coveredLines.has(changedLineNumber)) {
          coveredLines += 1;
          fileCovered += 1;
          continue;
        }

        missedLines += 1;
        fileMissed += 1;
        continue;
      }

      if (ignoreFileWithoutCoverage) {
        continue;
      }

      const sourceLine = sourceLines[changedLineNumber - 1] ?? '';
      if (!isLikelyExecutableLine(sourceLine)) {
        continue;
      }

      missedLines += 1;
      fileMissed += 1;
    }

    if (fileCovered === 0 && fileMissed === 0) {
      ignoredFiles += 1;
      continue;
    }

    if (fileMissed > 0) {
      uncoveredFiles.push({
        path: changedFile.path,
        covered: fileCovered,
        missed: fileMissed,
      });
    }
  }

  const totalLines = coveredLines + missedLines;
  const coveragePct =
    totalLines === 0 ? 100 : Number(((coveredLines / totalLines) * 100).toFixed(2));

  return {
    passed: coveragePct >= targetPct,
    targetPct,
    coveragePct,
    coveredLines,
    missedLines,
    consideredFiles: changedFiles.length - ignoredFiles,
    ignoredFiles,
    uncoveredFiles: uncoveredFiles
      .sort((left, right) => right.missed - left.missed || left.path.localeCompare(right.path))
      .slice(0, 10),
  };
}

function parseArgs(argv: string[]): RunPatchCoverageGateOptions {
  return argv.reduce<RunPatchCoverageGateOptions>((options, argument) => {
    if (argument.startsWith('--base=')) {
      options.baseRef = argument.slice('--base='.length);
      return options;
    }

    if (argument.startsWith('--head=')) {
      options.headRef = argument.slice('--head='.length);
      return options;
    }

    if (argument.startsWith('--target=')) {
      options.targetPct = Number(argument.slice('--target='.length));
      return options;
    }

    if (argument.startsWith('--root=')) {
      options.rootDir = argument.slice('--root='.length);
    }

    return options;
  }, {});
}

function formatResult(result: RunPatchCoverageGateResult): string {
  const lines = [
    `Patch coverage: ${result.coveragePct.toFixed(2)}% (${result.coveredLines}/${result.coveredLines + result.missedLines})`,
    `Target: ${result.targetPct.toFixed(2)}%`,
    `Considered files: ${result.consideredFiles}`,
  ];

  if (result.ignoredFiles > 0) {
    lines.push(`Ignored changed files without coverable lines: ${result.ignoredFiles}`);
  }

  if (result.uncoveredFiles.length > 0) {
    lines.push('Top uncovered files:');
    for (const file of result.uncoveredFiles) {
      lines.push(`- ${file.path}: ${file.missed} missed, ${file.covered} covered`);
    }
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const result = runPatchCoverageGate(parseArgs(process.argv.slice(2)));
  const output = formatResult(result);
  if (result.passed) {
    console.log(output);
    return;
  }

  console.error(output);
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
