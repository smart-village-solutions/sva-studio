#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { assertCoveragePolicy, findCoverageArtifacts, readJson, type CoveragePolicy } from './coverage-gate.ts';

interface RunSonarNewCodeGateOptions {
  rootDir?: string;
  baseRef?: string;
  headRef?: string;
  targetPct?: number;
}

interface ChangedFile {
  path: string;
  changedLines: number[];
}

interface FileCoverage {
  coveredLines: Set<number>;
  instrumentedLines: Set<number>;
  coveredBranchesByLine: Map<number, number>;
  instrumentedBranchesByLine: Map<number, number>;
}

interface UncoveredFileSummary {
  path: string;
  covered: number;
  missed: number;
  coveredBranches: number;
  missedBranches: number;
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

function loadPolicy(rootDir: string): CoveragePolicy {
  const policyPath = path.join(rootDir, 'tooling/testing/coverage-policy.json');
  const policy = readJson<unknown>(policyPath);
  assertCoveragePolicy(policy);
  return policy;
}

function normalizeRelativePath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function resolveProjectRoots(rootDir: string, policy: CoveragePolicy): string[] {
  const exemptProjects = new Set(policy.exemptProjects ?? []);
  const projectNames = Object.keys(policy.perProjectFloors ?? {}).filter((projectName) => !exemptProjects.has(projectName));
  const roots = projectNames.flatMap((projectName) => {
    const appRoot = path.join(rootDir, 'apps', projectName);
    if (fs.existsSync(appRoot)) {
      return [appRoot];
    }

    const packageRoot = path.join(rootDir, 'packages', projectName);
    if (fs.existsSync(packageRoot)) {
      return [packageRoot];
    }

    return [];
  });

  return roots.sort();
}

function resolveLcovSourcePath(rootDir: string, projectRoot: string, sourceFilePath: string): string {
  const absoluteFilePath = path.isAbsolute(sourceFilePath)
    ? sourceFilePath
    : path.join(projectRoot, sourceFilePath);

  const extension = path.extname(absoluteFilePath);
  const extensionFallbacks =
    extension === '.js'
      ? ['.ts', '.tsx']
      : extension === '.jsx'
        ? ['.tsx', '.ts']
        : extension === '.mjs'
          ? ['.mts', '.ts']
          : [];

  for (const fallbackExtension of extensionFallbacks) {
    const fallbackPath = absoluteFilePath.slice(0, -extension.length) + fallbackExtension;
    if (fs.existsSync(fallbackPath)) {
      return normalizeRelativePath(rootDir, fallbackPath);
    }
  }

  if (fs.existsSync(absoluteFilePath)) {
    return normalizeRelativePath(rootDir, absoluteFilePath);
  }

  return normalizeRelativePath(rootDir, absoluteFilePath);
}

function isCoverableSourceFile(filePath: string): boolean {
  if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) {
    return false;
  }

  if (filePath.endsWith('.d.ts')) {
    return false;
  }

  if (
    filePath.includes('/node_modules/') ||
    filePath.includes('/dist/') ||
    filePath.includes('/build/') ||
    filePath.includes('/coverage/') ||
    filePath.includes('/.nx/') ||
    filePath.includes('/.turbo/') ||
    filePath.includes('/__tests__/') ||
    filePath.includes('/__mocks__/') ||
    filePath.includes('/test-utils/') ||
    filePath.includes('/examples/') ||
    filePath.includes('/e2e/') ||
    filePath.includes('/scripts/') ||
    filePath.includes('/tools/')
  ) {
    return false;
  }

  return !/(\.test|\.spec|\.config)\.(ts|tsx|js|jsx)$/.test(filePath);
}

function listChangedFiles(rootDir: string, baseRef: string, headRef: string, projectRoots: string[]): ChangedFile[] {
  if (projectRoots.length === 0) {
    return [];
  }

  const relativeRoots = projectRoots.map((projectRoot) => normalizeRelativePath(rootDir, projectRoot));
  const diffArgs = ['diff', '--unified=0', '--diff-filter=AM', `${baseRef}...${headRef}`, '--', ...relativeRoots];
  const result = spawnSync('git', diffArgs, {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${diffArgs.join(' ')} failed`);
  }

  const files = new Map<string, Set<number>>();
  let currentFile: string | null = null;

  for (const line of result.stdout.split('\n')) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      if (!files.has(currentFile)) {
        files.set(currentFile, new Set<number>());
      }
      continue;
    }

    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!hunkMatch || !currentFile) {
      continue;
    }

    const start = Number(hunkMatch[1]);
    const count = Number(hunkMatch[2] ?? '1');
    if (count <= 0) {
      continue;
    }

    const changedLines = files.get(currentFile);
    if (!changedLines) {
      continue;
    }

    for (let lineNumber = start; lineNumber < start + count; lineNumber += 1) {
      changedLines.add(lineNumber);
    }
  }

  return [...files.entries()]
    .map(([filePath, lines]) => ({
      path: filePath,
      changedLines: [...lines].sort((left, right) => left - right),
    }))
    .filter((entry) => entry.changedLines.length > 0 && isCoverableSourceFile(entry.path));
}

function isLikelyExecutableLine(sourceLine: string): boolean {
  const trimmed = sourceLine.trim();
  if (!trimmed) {
    return false;
  }

  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('*/') ||
    trimmed === '{' ||
    trimmed === '}' ||
    trimmed === '};' ||
    trimmed === '];' ||
    trimmed === '),' ||
    trimmed === ');'
  ) {
    return false;
  }

  if (
    trimmed.startsWith('import ') ||
    trimmed.startsWith('export type ') ||
    trimmed.startsWith('type ') ||
    trimmed.startsWith('interface ') ||
    trimmed.startsWith('declare ') ||
    trimmed.startsWith('export {') ||
    trimmed.startsWith('export interface ') ||
    trimmed.startsWith('export declare ')
  ) {
    return false;
  }

  if (
    /^from\s+['"][^'"]+['"];?$/.test(trimmed) ||
    /^['"`][^'"`]+['"`][;,]?$/.test(trimmed) ||
    /^[A-Za-z_$][\w$]*,?$/.test(trimmed) ||
    /^(readonly\s+)?[A-Za-z_$][\w$]*\??:\s.+;?$/.test(trimmed) ||
    /^(export\s+)?type\s+[A-Za-z_$][\w$]*\s*=\s*.+;?$/.test(trimmed) ||
    /^}[,\s]*from\s+['"][^'"]+['"];?$/.test(trimmed) ||
    trimmed === '}[];'
  ) {
    return false;
  }

  return true;
}

function isLikelyTypeOnlyOrReexportLine(sourceLine: string): boolean {
  const trimmed = sourceLine.trim();
  if (!trimmed) {
    return true;
  }

  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('*/') ||
    trimmed.startsWith('import type ') ||
    trimmed.startsWith('export type ') ||
    trimmed.startsWith('type ') ||
    trimmed.startsWith('interface ') ||
    trimmed.startsWith('export interface ') ||
    trimmed.startsWith('declare ') ||
    trimmed.startsWith('export declare ') ||
    trimmed.startsWith('readonly ') ||
    trimmed.startsWith('export {') ||
    trimmed.startsWith('export * from ')
  ) {
    return true;
  }

  if (
    /^(readonly\s+)?[A-Za-z_$][\w$]*\??:\s.+;?$/.test(trimmed) ||
    /^(export\s+)?type\s+[A-Za-z_$][\w$]*\s*=\s*.+;?$/.test(trimmed) ||
    /^(\||&)\s+['"`][^'"`]+['"`][;,]?$/.test(trimmed) ||
    /^['"`][^'"`]+['"`][;,]?$/.test(trimmed) ||
    /^from\s+['"][^'"]+['"];?$/.test(trimmed) ||
    /^}[,\s]*from\s+['"][^'"]+['"];?$/.test(trimmed) ||
    /^[A-Za-z_$][\w$]*,?$/.test(trimmed) ||
    trimmed === '{' ||
    trimmed === '}' ||
    trimmed === '};' ||
    trimmed === '}[];'
  ) {
    return true;
  }

  return false;
}

function isLikelyGeneratedFile(filePath: string, sourceLines: readonly string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (
    normalizedPath.endsWith('.gen.ts') ||
    normalizedPath.endsWith('.gen.tsx') ||
    normalizedPath.endsWith('.generated.ts') ||
    normalizedPath.endsWith('.generated.tsx')
  ) {
    return true;
  }

  const leadingLines = sourceLines
    .slice(0, 12)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

  return (
    leadingLines.includes('This file was automatically generated') ||
    leadingLines.includes('You should NOT make any changes in this file')
  );
}

function isLikelyNonExecutableFile(filePath: string, sourceLines: readonly string[]): boolean {
  if (isLikelyGeneratedFile(filePath, sourceLines)) {
    return true;
  }

  const significantLines = sourceLines.map((line) => line.trim()).filter(Boolean);
  if (significantLines.length === 0) {
    return true;
  }

  return significantLines.every(isLikelyTypeOnlyOrReexportLine);
}

function readSourceLines(rootDir: string, filePath: string): string[] {
  const absoluteFilePath = path.join(rootDir, filePath);
  if (!fs.existsSync(absoluteFilePath)) {
    return [];
  }

  return fs.readFileSync(absoluteFilePath, 'utf8').split('\n');
}

function parseLcovCoverage(rootDir: string): Map<string, FileCoverage> {
  const workspaceRoots = [path.join(rootDir, 'apps'), path.join(rootDir, 'packages')];
  const lcovFiles = workspaceRoots.flatMap((workspaceRoot) => findCoverageArtifacts(workspaceRoot, 'lcov.info'));
  const coverageByFile = new Map<string, FileCoverage>();

  for (const lcovPath of lcovFiles) {
    const projectRoot = path.dirname(path.dirname(lcovPath));
    const contents = fs.readFileSync(lcovPath, 'utf8');
    const records = contents.split('end_of_record');

    for (const record of records) {
      const trimmed = record.trim();
      if (!trimmed) {
        continue;
      }

      const sfMatch = trimmed.match(/^SF:(.+)$/m);
      if (!sfMatch) {
        continue;
      }

      const sourceFilePath = sfMatch[1].trim();
      const normalizedFilePath = resolveLcovSourcePath(rootDir, projectRoot, sourceFilePath);
      const fileCoverage: FileCoverage = {
        coveredLines: new Set<number>(),
        instrumentedLines: new Set<number>(),
        coveredBranchesByLine: new Map<number, number>(),
        instrumentedBranchesByLine: new Map<number, number>(),
      };

      for (const entryLine of trimmed.split('\n')) {
        const daMatch = entryLine.match(/^DA:(\d+),(\d+)/);
        if (daMatch) {
          const lineNumber = Number(daMatch[1]);
          const hits = Number(daMatch[2]);
          fileCoverage.instrumentedLines.add(lineNumber);
          if (hits > 0) {
            fileCoverage.coveredLines.add(lineNumber);
          }
          continue;
        }

        const brdaMatch = entryLine.match(/^BRDA:(\d+),(\d+|-),(\d+|-),(.+)$/);
        if (!brdaMatch) {
          continue;
        }

        const lineNumber = Number(brdaMatch[1]);
        const taken = brdaMatch[4];
        fileCoverage.instrumentedBranchesByLine.set(
          lineNumber,
          (fileCoverage.instrumentedBranchesByLine.get(lineNumber) ?? 0) + 1
        );
        if (taken !== '-' && Number(taken) > 0) {
          fileCoverage.coveredBranchesByLine.set(
            lineNumber,
            (fileCoverage.coveredBranchesByLine.get(lineNumber) ?? 0) + 1
          );
        }
      }

      coverageByFile.set(normalizedFilePath, fileCoverage);
    }
  }

  return coverageByFile;
}

export function runSonarNewCodeGate(options: RunSonarNewCodeGateOptions = {}): RunSonarNewCodeGateResult {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const baseRef = options.baseRef ?? 'origin/main';
  const headRef = options.headRef ?? 'HEAD';
  const targetPct = options.targetPct ?? defaultTargetPct;
  const policy = loadPolicy(rootDir);
  const projectRoots = resolveProjectRoots(rootDir, policy);
  const changedFiles = listChangedFiles(rootDir, baseRef, headRef, projectRoots);
  const coverageByFile = parseLcovCoverage(rootDir);

  let coveredLines = 0;
  let missedLines = 0;
  let coveredBranches = 0;
  let missedBranches = 0;
  let ignoredFiles = 0;
  const uncoveredFiles: UncoveredFileSummary[] = [];

  for (const changedFile of changedFiles) {
    const sourceLines = readSourceLines(rootDir, changedFile.path);
    const fileCoverage = coverageByFile.get(changedFile.path);
    const ignoreFileWithoutCoverage = !fileCoverage && isLikelyNonExecutableFile(changedFile.path, sourceLines);
    let fileCovered = 0;
    let fileMissed = 0;
    let fileCoveredBranches = 0;
    let fileMissedBranches = 0;

    for (const changedLineNumber of changedFile.changedLines) {
      if (fileCoverage?.instrumentedLines.has(changedLineNumber)) {
        if (fileCoverage.coveredLines.has(changedLineNumber)) {
          coveredLines += 1;
          fileCovered += 1;
        } else {
          missedLines += 1;
          fileMissed += 1;
        }
      } else if (!fileCoverage && !ignoreFileWithoutCoverage) {
        const sourceLine = sourceLines[changedLineNumber - 1] ?? '';
        if (isLikelyExecutableLine(sourceLine)) {
          missedLines += 1;
          fileMissed += 1;
        }
      }

      const instrumentedBranches = fileCoverage?.instrumentedBranchesByLine.get(changedLineNumber) ?? 0;
      if (instrumentedBranches > 0) {
        const coveredBranchCount = fileCoverage?.coveredBranchesByLine.get(changedLineNumber) ?? 0;
        coveredBranches += coveredBranchCount;
        missedBranches += instrumentedBranches - coveredBranchCount;
        fileCoveredBranches += coveredBranchCount;
        fileMissedBranches += instrumentedBranches - coveredBranchCount;
      }
    }

    if (fileCovered === 0 && fileMissed === 0 && fileCoveredBranches === 0 && fileMissedBranches === 0) {
      ignoredFiles += 1;
      continue;
    }

    if (fileMissed > 0 || fileMissedBranches > 0) {
      uncoveredFiles.push({
        path: changedFile.path,
        covered: fileCovered,
        missed: fileMissed,
        coveredBranches: fileCoveredBranches,
        missedBranches: fileMissedBranches,
      });
    }
  }

  const coveredUnits = coveredLines + coveredBranches;
  const missedUnits = missedLines + missedBranches;
  const coveragePct = coveredUnits + missedUnits === 0 ? 100 : Number(((coveredUnits / (coveredUnits + missedUnits)) * 100).toFixed(2));

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
          right.missed + right.missedBranches - (left.missed + left.missedBranches) || left.path.localeCompare(right.path)
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
