#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { assertCoveragePolicy, findCoverageArtifacts, readJson, type CoveragePolicy } from './coverage-gate.ts';

interface RunPatchCoverageGateOptions {
  rootDir?: string;
  baseRef?: string;
  headRef?: string;
  targetPct?: number;
}

interface ChangedFile {
  path: string;
  changedLines: number[];
}

interface FileLineCoverage {
  coveredLines: Set<number>;
  instrumentedLines: Set<number>;
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
const gitDiffMaxBuffer = 32 * 1024 * 1024;
const gitGrepMaxBuffer = 64 * 1024 * 1024;

function loadPolicy(rootDir: string): CoveragePolicy {
  const policyPath = path.join(rootDir, 'tooling/testing/coverage-policy.json');
  const policy = readJson<unknown>(policyPath);
  assertCoveragePolicy(policy);
  return policy;
}

function resolveProjectRoots(rootDir: string, policy: CoveragePolicy): string[] {
  const exemptProjects = new Set(policy.exemptProjects ?? []);
  const newCodeExemptProjects = new Set(
    ((policy as CoveragePolicy & { newCodeExemptProjects?: string[] }).newCodeExemptProjects ?? [])
  );
  const projectNames = Object.keys(policy.perProjectFloors ?? {}).filter(
    (projectName) => !exemptProjects.has(projectName) && !newCodeExemptProjects.has(projectName)
  );
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

function normalizeRelativePath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function normalizeComparableSourceLine(line: string): string | null {
  const normalized = line.trim().replace(/\s+/g, ' ');
  return normalized.length >= 12 ? normalized : null;
}

function loadBaseComparableLines(rootDir: string, baseRef: string, relativeRoots: readonly string[]): Set<string> {
  const result = spawnSync('git', ['grep', '-I', '-h', '-e', '.', baseRef, '--', ...relativeRoots], {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: gitGrepMaxBuffer,
  });

  if (result.status !== 0 && result.status !== 1) {
    return new Set();
  }

  const lines = new Set<string>();
  for (const line of result.stdout.split('\n')) {
    const normalized = normalizeComparableSourceLine(line);
    if (normalized) {
      lines.add(normalized);
    }
  }

  return lines;
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
  const baseComparableLines = loadBaseComparableLines(rootDir, baseRef, relativeRoots);
  const diffArgs = ['diff', '--unified=0', '--diff-filter=AM', `${baseRef}...${headRef}`, '--', ...relativeRoots];
  const result = spawnSync('git', diffArgs, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: gitDiffMaxBuffer,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${diffArgs.join(' ')} failed`);
  }

  const files = new Map<string, Set<number>>();
  let currentFile: string | null = null;
  let nextNewLineNumber: number | null = null;

  for (const line of result.stdout.split('\n')) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      nextNewLineNumber = null;
      if (!files.has(currentFile)) {
        files.set(currentFile, new Set<number>());
      }
      continue;
    }

    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      nextNewLineNumber = Number(hunkMatch[1]);
      continue;
    }

    if (!currentFile || nextNewLineNumber === null) {
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      const normalized = normalizeComparableSourceLine(line.slice(1));
      if (!normalized || !baseComparableLines.has(normalized)) {
        files.get(currentFile)?.add(nextNewLineNumber);
      }
      nextNewLineNumber += 1;
      continue;
    }

    if (line.startsWith(' ') || line.startsWith('\\')) {
      nextNewLineNumber += 1;
    }
  }

  return [...files.entries()]
    .map(([filePath, lines]) => ({
      path: filePath,
      changedLines: [...lines].sort((left, right) => left - right),
    }))
    .filter((entry) => entry.changedLines.length > 0 && isCoverableSourceFile(entry.path));
}

function parseLcovLineCoverage(rootDir: string): Map<string, FileLineCoverage> {
  const workspaceRoots = [path.join(rootDir, 'apps'), path.join(rootDir, 'packages')];
  const lcovFiles = workspaceRoots.flatMap((workspaceRoot) => findCoverageArtifacts(workspaceRoot, 'lcov.info'));
  const coverageByFile = new Map<string, FileLineCoverage>();

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
      const coveredLines = new Set<number>();
      const instrumentedLines = new Set<number>();

      for (const entryLine of trimmed.split('\n')) {
        const daMatch = entryLine.match(/^DA:(\d+),(\d+)/);
        if (!daMatch) {
          continue;
        }

        const lineNumber = Number(daMatch[1]);
        const hits = Number(daMatch[2]);
        instrumentedLines.add(lineNumber);
        if (hits > 0) {
          coveredLines.add(lineNumber);
        }
      }

      coverageByFile.set(normalizedFilePath, {
        coveredLines,
        instrumentedLines,
      });
    }
  }

  return coverageByFile;
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

export function runPatchCoverageGate(options: RunPatchCoverageGateOptions = {}): RunPatchCoverageGateResult {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const baseRef = options.baseRef ?? 'origin/main';
  const headRef = options.headRef ?? 'HEAD';
  const targetPct = options.targetPct ?? defaultTargetPct;
  const policy = loadPolicy(rootDir);
  const projectRoots = resolveProjectRoots(rootDir, policy);
  const changedFiles = listChangedFiles(rootDir, baseRef, headRef, projectRoots);
  const coverageByFile = parseLcovLineCoverage(rootDir);

  let coveredLines = 0;
  let missedLines = 0;
  let ignoredFiles = 0;
  const uncoveredFiles: UncoveredFileSummary[] = [];

  for (const changedFile of changedFiles) {
    const sourceLines = readSourceLines(rootDir, changedFile.path);
    const fileCoverage = coverageByFile.get(changedFile.path);
    const ignoreFileWithoutCoverage = !fileCoverage && isLikelyNonExecutableFile(changedFile.path, sourceLines);
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
  const coveragePct = totalLines === 0 ? 100 : Number(((coveredLines / totalLines) * 100).toFixed(2));

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
