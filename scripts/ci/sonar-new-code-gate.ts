#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readJson } from './coverage-gate.ts';
import { listChangedFiles, loadPolicy, resolveProjectRoots } from './new-code-coverage-scope.ts';
import { evaluateChangedFiles, type UncoveredFileSummary } from './sonar-new-code-evaluation.ts';
import { parseLcovCoverage } from './sonar-new-code-lcov.ts';
import { isSonarCoverageExcludedPath, readSonarCoverageExclusions } from './sonar-paths.ts';

interface RunSonarNewCodeGateOptions {
  rootDir?: string;
  baseRef?: string;
  headRef?: string;
  targetPct?: number;
}

export interface RunSonarNewCodeGateResult {
  passed: boolean;
  targetPct: number;
  coveragePct: number;
  coveredUnits: number;
  missedUnits: number;
  coveredLines: number;
  missedLines: number;
  coveredBranches: number;
  missedBranches: number;
  consideredFiles: number;
  ignoredFiles: number;
  uncoveredFiles: UncoveredFileSummary[];
}

const defaultTargetPct = 85;
type GitHubPullRequestEvent = {
  pull_request?: {
    head?: {
      sha?: unknown;
    };
  };
};

export const resolveSonarHeadRef = (environment: NodeJS.ProcessEnv = process.env): string => {
  const configuredHead = environment.NX_HEAD?.trim();
  if (configuredHead) {
    return configuredHead;
  }

  const eventPath = environment.GITHUB_EVENT_PATH?.trim();
  if (eventPath) {
    try {
      const event = readJson<GitHubPullRequestEvent>(eventPath);
      const pullRequestHead = event.pull_request?.head?.sha;
      if (typeof pullRequestHead === 'string' && pullRequestHead.trim()) {
        return pullRequestHead.trim();
      }
    } catch {
      // Local and non-PR runs intentionally fall back to the checked-out HEAD.
    }
  }

  return 'HEAD';
};

export function runSonarNewCodeGate(
  options: RunSonarNewCodeGateOptions = {}
): RunSonarNewCodeGateResult {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const baseRef = options.baseRef ?? 'origin/main';
  const headRef = options.headRef ?? resolveSonarHeadRef();
  const targetPct = options.targetPct ?? defaultTargetPct;
  const policy = loadPolicy(rootDir);
  const sonarCoverageExclusions = readSonarCoverageExclusions(rootDir);
  const projectRoots = resolveProjectRoots(rootDir, policy);
  const changedFiles = listChangedFiles(rootDir, baseRef, headRef, projectRoots).filter(
    (changedFile) => !isSonarCoverageExcludedPath(changedFile.path, sonarCoverageExclusions)
  );
  const coverageByFile = parseLcovCoverage(rootDir);

  const {
    coveredLines,
    missedLines,
    coveredBranches,
    missedBranches,
    ignoredFiles,
    uncoveredFiles,
  } = evaluateChangedFiles(rootDir, changedFiles, coverageByFile);

  const coveredUnits = coveredLines + coveredBranches;
  const missedUnits = missedLines + missedBranches;
  const coveragePct =
    coveredUnits + missedUnits === 0
      ? 100
      : Number(((coveredUnits / (coveredUnits + missedUnits)) * 100).toFixed(2));

  return {
    passed: coveragePct >= targetPct,
    targetPct,
    coveragePct,
    coveredUnits,
    missedUnits,
    coveredLines,
    missedLines,
    coveredBranches,
    missedBranches,
    consideredFiles: changedFiles.length - ignoredFiles,
    ignoredFiles,
    uncoveredFiles: uncoveredFiles
      .sort(
        (left, right) =>
          right.missed + right.missedBranches - (left.missed + left.missedBranches) ||
          left.path.localeCompare(right.path)
      )
      .slice(0, 10),
  };
}

function parseArgs(argv: string[]): RunSonarNewCodeGateOptions {
  return argv.reduce<RunSonarNewCodeGateOptions>((options, argument) => {
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

function formatResult(result: RunSonarNewCodeGateResult): string {
  const lines = [
    `Sonar-like new code coverage: ${result.coveragePct.toFixed(2)}% (${result.coveredUnits}/${result.coveredUnits + result.missedUnits})`,
    `Target: ${result.targetPct.toFixed(2)}%`,
    `Lines: ${result.coveredLines} covered, ${result.missedLines} missed`,
    `Branches: ${result.coveredBranches} covered, ${result.missedBranches} missed`,
    `Considered files: ${result.consideredFiles}`,
  ];

  if (result.ignoredFiles > 0) {
    lines.push(`Ignored changed files without coverable units: ${result.ignoredFiles}`);
  }

  if (result.uncoveredFiles.length > 0) {
    lines.push('Top uncovered files:');
    for (const file of result.uncoveredFiles) {
      lines.push(
        `- ${file.path}: ${file.missed} missed lines, ${file.missedBranches} missed branches`
      );
    }
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const result = runSonarNewCodeGate(parseArgs(process.argv.slice(2)));
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
