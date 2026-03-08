#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export type ModuleClass = 'zentral' | 'kritisch';
export type ComplexityMetricKey =
  | 'fileLines'
  | 'functionLines'
  | 'cyclomaticComplexity'
  | 'publicExports';

export interface ComplexityThresholds {
  fileLines: number;
  functionLines: number;
  cyclomaticComplexity: number;
  publicExports: number;
}

export interface ComplexityModule {
  id: string;
  label: string;
  class: ModuleClass;
  owner: string;
  reviewCadence: string;
  include: string[];
  exclude?: string[];
  overrides?: Partial<ComplexityThresholds>;
}

export interface TrackedFinding {
  ticketId: string;
  ticketSystem: string;
  status: 'planned' | 'open' | 'in_progress' | 'blocked';
  summary: string;
}

export interface ComplexityPolicy {
  version: number;
  classThresholds: Record<ModuleClass, ComplexityThresholds>;
  modules: ComplexityModule[];
  trackedFindings: Record<string, TrackedFinding>;
}

export interface FileComplexityMetrics {
  filePath: string;
  fileLines: number;
  maxFunctionLines: number;
  maxFunctionName: string;
  maxCyclomaticComplexity: number;
  maxComplexityFunctionName: string;
  publicExports: number;
}

export interface ComplexityBaselineEntry {
  moduleId: string;
  filePath: string;
  fileLines: number;
  functionLines: number;
  cyclomaticComplexity: number;
  publicExports: number;
}

export interface ComplexityBaseline {
  files: Record<string, ComplexityBaselineEntry>;
}

interface ComplexityPaths {
  rootDir: string;
  policyPath: string;
  baselinePath: string;
}

interface AnalyzedFile {
  module: ComplexityModule;
  metrics: FileComplexityMetrics;
}

interface MetricViolation {
  findingId: string;
  moduleId: string;
  moduleLabel: string;
  moduleClass: ModuleClass;
  filePath: string;
  metric: ComplexityMetricKey;
  current: number;
  threshold: number;
  trend: number | null;
  trackedFinding: TrackedFinding | null;
}

interface ModuleSummary {
  module: ComplexityModule;
  fileCount: number;
  maxFileLines: number;
  maxFunctionLines: number;
  maxCyclomaticComplexity: number;
  maxPublicExports: number;
}

export interface RunComplexityGateOptions {
  rootDir?: string;
  updateBaseline?: boolean;
  stepSummaryPath?: string | null;
}

export interface RunComplexityGateResult {
  passed: boolean;
  updatedBaseline: boolean;
  summaryBody: string;
  trackedViolations: MetricViolation[];
  untrackedViolations: MetricViolation[];
  analyzedFiles: AnalyzedFile[];
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

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

function isComplexityThresholds(input: unknown): input is ComplexityThresholds {
  if (!isRecord(input)) {
    return false;
  }

  return (
    typeof input.fileLines === 'number' &&
    typeof input.functionLines === 'number' &&
    typeof input.cyclomaticComplexity === 'number' &&
    typeof input.publicExports === 'number'
  );
}

function isTrackedFinding(input: unknown): input is TrackedFinding {
  if (!isRecord(input)) {
    return false;
  }

  return (
    typeof input.ticketId === 'string' &&
    typeof input.ticketSystem === 'string' &&
    typeof input.status === 'string' &&
    typeof input.summary === 'string'
  );
}

export function assertComplexityPolicy(policy: unknown): asserts policy is ComplexityPolicy {
  if (!isRecord(policy)) {
    throw new TypeError('Invalid complexity policy: expected object');
  }

  if (typeof policy.version !== 'number') {
    throw new TypeError('Invalid complexity policy: version must be a number');
  }

  if (
    !isRecord(policy.classThresholds) ||
    !isComplexityThresholds(policy.classThresholds.zentral) ||
    !isComplexityThresholds(policy.classThresholds.kritisch)
  ) {
    throw new TypeError('Invalid complexity policy: classThresholds must define zentral and kritisch');
  }

  if (!Array.isArray(policy.modules) || policy.modules.length === 0) {
    throw new TypeError('Invalid complexity policy: modules must be a non-empty array');
  }

  for (const moduleConfig of policy.modules) {
    if (!isRecord(moduleConfig)) {
      throw new TypeError('Invalid complexity policy: module config must be an object');
    }

    if (
      typeof moduleConfig.id !== 'string' ||
      typeof moduleConfig.label !== 'string' ||
      (moduleConfig.class !== 'zentral' && moduleConfig.class !== 'kritisch') ||
      typeof moduleConfig.owner !== 'string' ||
      typeof moduleConfig.reviewCadence !== 'string'
    ) {
      throw new TypeError('Invalid complexity policy: module config is incomplete');
    }

    if (
      !Array.isArray(moduleConfig.include) ||
      moduleConfig.include.length === 0 ||
      moduleConfig.include.some((pattern) => typeof pattern !== 'string')
    ) {
      throw new TypeError(`Invalid complexity policy: module ${moduleConfig.id} include patterns are invalid`);
    }

    if (
      moduleConfig.exclude !== undefined &&
      (!Array.isArray(moduleConfig.exclude) || moduleConfig.exclude.some((pattern) => typeof pattern !== 'string'))
    ) {
      throw new TypeError(`Invalid complexity policy: module ${moduleConfig.id} exclude patterns are invalid`);
    }

    if (
      moduleConfig.overrides !== undefined &&
      (!isRecord(moduleConfig.overrides) ||
        Object.values(moduleConfig.overrides).some((value) => value !== undefined && typeof value !== 'number'))
    ) {
      throw new TypeError(`Invalid complexity policy: module ${moduleConfig.id} overrides are invalid`);
    }
  }

  if (!isRecord(policy.trackedFindings)) {
    throw new TypeError('Invalid complexity policy: trackedFindings must be an object');
  }

  for (const [findingId, trackedFinding] of Object.entries(policy.trackedFindings)) {
    if (!isTrackedFinding(trackedFinding)) {
      throw new TypeError(`Invalid complexity policy: trackedFindings.${findingId} is invalid`);
    }
  }
}

function resolveComplexityPaths(rootDir: string): ComplexityPaths {
  return {
    rootDir,
    policyPath: path.join(rootDir, 'tooling/quality/complexity-policy.json'),
    baselinePath: path.join(rootDir, 'tooling/quality/complexity-baseline.json'),
  };
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function globToRegExp(pattern: string): RegExp {
  let regex = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const nextChar = pattern[index + 1];
    const charAfterNext = pattern[index + 2];

    if (char === '*' && nextChar === '*' && charAfterNext === '/') {
      regex += '(?:.*/)?';
      index += 2;
      continue;
    }

    if (char === '*' && nextChar === '*') {
      regex += '.*';
      index += 1;
      continue;
    }

    if (char === '*') {
      regex += '[^/]*';
      continue;
    }

    if (char === '?') {
      regex += '[^/]';
      continue;
    }

    regex += /[|\\{}()[\]^$+?.]/.test(char) ? `\\${char}` : char;
  }

  regex += '$';
  return new RegExp(regex);
}

function createMatcher(patterns: string[]): (candidate: string) => boolean {
  const regexes = patterns.map((pattern) => globToRegExp(pattern));
  return (candidate: string): boolean => regexes.some((regex) => regex.test(candidate));
}

function walkFiles(dirPath: string, results: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) {
    return results;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'coverage' || entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      walkFiles(entryPath, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith('.d.ts')) {
      continue;
    }

    results.push(entryPath);
  }

  return results;
}

function resolveModuleFiles(rootDir: string, modules: ComplexityModule[]): AnalyzedFile[] {
  const allFiles = walkFiles(rootDir).map((filePath) => normalizePath(path.relative(rootDir, filePath)));
  const assignments = new Map<string, ComplexityModule>();
  const analyzedFiles: AnalyzedFile[] = [];

  for (const moduleConfig of modules) {
    const include = createMatcher(moduleConfig.include);
    const exclude = createMatcher(moduleConfig.exclude ?? []);

    for (const relativePath of allFiles) {
      if (!include(relativePath) || exclude(relativePath)) {
        continue;
      }

      const existingModule = assignments.get(relativePath);
      if (existingModule && existingModule.id !== moduleConfig.id) {
        throw new Error(
          `Complexity module overlap detected: ${relativePath} matches both ${existingModule.id} and ${moduleConfig.id}`
        );
      }

      assignments.set(relativePath, moduleConfig);
      analyzedFiles.push({
        module: moduleConfig,
        metrics: analyzeFile(path.join(rootDir, relativePath), relativePath),
      });
    }
  }

  return analyzedFiles.sort((left, right) => left.metrics.filePath.localeCompare(right.metrics.filePath));
}

function computeLineCount(sourceFile: ts.SourceFile): number {
  const lineAndCharacter = sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd());
  return lineAndCharacter.line + 1;
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    ? ts
        .getModifiers(node)
        ?.some(
          (modifier) =>
            modifier.kind === ts.SyntaxKind.ExportKeyword || modifier.kind === ts.SyntaxKind.DefaultKeyword
        ) ?? false
    : false;
}

function countPublicExports(sourceFile: ts.SourceFile): number {
  let exportCount = 0;

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      exportCount += 1;
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) {
        exportCount += 1;
        continue;
      }

      if (ts.isNamedExports(statement.exportClause)) {
        exportCount += statement.exportClause.elements.length;
      }
      continue;
    }

    if (!hasExportModifier(statement)) {
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      exportCount += statement.declarationList.declarations.length;
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      exportCount += 1;
    }
  }

  return exportCount;
}

function findFunctionName(node: ts.FunctionLikeDeclarationBase): string {
  if ('name' in node && node.name && ts.isIdentifier(node.name)) {
    return node.name.text;
  }

  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
    return node.name.getText();
  }

  if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    return node.name.getText();
  }

  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }

  if (parent && ts.isPropertyAssignment(parent)) {
    return parent.name.getText();
  }

  return '<anonymous>';
}

function computeFunctionLines(sourceFile: ts.SourceFile, node: ts.FunctionLikeDeclarationBase): number {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
  return end - start + 1;
}

function computeCyclomaticComplexity(node: ts.FunctionLikeDeclarationBase): number {
  let complexity = 1;

  const visit = (current: ts.Node): void => {
    switch (current.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ConditionalExpression:
      case ts.SyntaxKind.CaseClause:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.CatchClause:
        complexity += 1;
        break;
      case ts.SyntaxKind.BinaryExpression: {
        const expression = current as ts.BinaryExpression;
        if (
          expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          expression.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
          complexity += 1;
        }
        break;
      }
      default:
        break;
    }

    ts.forEachChild(current, visit);
  };

  if (node.body) {
    visit(node.body);
  }

  return complexity;
}

export function analyzeFile(absolutePath: string, relativePath: string): FileComplexityMetrics {
  const sourceText = fs.readFileSync(absolutePath, 'utf8');
  const sourceFile = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true);

  let maxFunctionLines = 0;
  let maxFunctionName = '<none>';
  let maxCyclomaticComplexity = 0;
  let maxComplexityFunctionName = '<none>';

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) && node.body) {
      const functionLines = computeFunctionLines(sourceFile, node);
      const functionName = findFunctionName(node);
      if (functionLines > maxFunctionLines) {
        maxFunctionLines = functionLines;
        maxFunctionName = functionName;
      }

      const cyclomaticComplexity = computeCyclomaticComplexity(node);
      if (cyclomaticComplexity > maxCyclomaticComplexity) {
        maxCyclomaticComplexity = cyclomaticComplexity;
        maxComplexityFunctionName = functionName;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return {
    filePath: normalizePath(relativePath),
    fileLines: computeLineCount(sourceFile),
    maxFunctionLines,
    maxFunctionName,
    maxCyclomaticComplexity,
    maxComplexityFunctionName,
    publicExports: countPublicExports(sourceFile),
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

function getEffectiveThresholds(policy: ComplexityPolicy, moduleConfig: ComplexityModule): ComplexityThresholds {
  const baseThresholds = policy.classThresholds[moduleConfig.class];
  return {
    ...baseThresholds,
    ...moduleConfig.overrides,
  };
}

function toFindingId(moduleId: string, filePath: string, metric: ComplexityMetricKey): string {
  return `${moduleId}:${filePath}:${metric}`;
}

function baselineMetricValue(
  baseline: ComplexityBaseline,
  filePath: string,
  metric: ComplexityMetricKey
): number | null {
  const entry = baseline.files[filePath];
  if (!entry) {
    return null;
  }

  switch (metric) {
    case 'fileLines':
      return entry.fileLines;
    case 'functionLines':
      return entry.functionLines;
    case 'cyclomaticComplexity':
      return entry.cyclomaticComplexity;
    case 'publicExports':
      return entry.publicExports;
  }
}

function collectViolations(
  policy: ComplexityPolicy,
  baseline: ComplexityBaseline,
  analyzedFiles: AnalyzedFile[]
): MetricViolation[] {
  const violations: MetricViolation[] = [];

  for (const analyzedFile of analyzedFiles) {
    const thresholds = getEffectiveThresholds(policy, analyzedFile.module);
    const metricValues: Record<ComplexityMetricKey, number> = {
      fileLines: analyzedFile.metrics.fileLines,
      functionLines: analyzedFile.metrics.maxFunctionLines,
      cyclomaticComplexity: analyzedFile.metrics.maxCyclomaticComplexity,
      publicExports: analyzedFile.metrics.publicExports,
    };

    for (const metric of Object.keys(metricValues) as ComplexityMetricKey[]) {
      const current = metricValues[metric];
      const threshold = thresholds[metric];
      if (current <= threshold) {
        continue;
      }

      const findingId = toFindingId(analyzedFile.module.id, analyzedFile.metrics.filePath, metric);
      const previous = baselineMetricValue(baseline, analyzedFile.metrics.filePath, metric);
      violations.push({
        findingId,
        moduleId: analyzedFile.module.id,
        moduleLabel: analyzedFile.module.label,
        moduleClass: analyzedFile.module.class,
        filePath: analyzedFile.metrics.filePath,
        metric,
        current,
        threshold,
        trend: previous === null ? null : current - previous,
        trackedFinding: policy.trackedFindings[findingId] ?? null,
      });
    }
  }

  return violations.sort((left, right) => {
    if (left.trackedFinding && !right.trackedFinding) {
      return 1;
    }

    if (!left.trackedFinding && right.trackedFinding) {
      return -1;
    }

    if (left.moduleId !== right.moduleId) {
      return left.moduleId.localeCompare(right.moduleId);
    }

    if (left.filePath !== right.filePath) {
      return left.filePath.localeCompare(right.filePath);
    }

    return left.metric.localeCompare(right.metric);
  });
}

function buildBaseline(analyzedFiles: AnalyzedFile[]): ComplexityBaseline {
  const files = analyzedFiles.reduce<Record<string, ComplexityBaselineEntry>>((acc, analyzedFile) => {
    acc[analyzedFile.metrics.filePath] = {
      moduleId: analyzedFile.module.id,
      filePath: analyzedFile.metrics.filePath,
      fileLines: analyzedFile.metrics.fileLines,
      functionLines: analyzedFile.metrics.maxFunctionLines,
      cyclomaticComplexity: analyzedFile.metrics.maxCyclomaticComplexity,
      publicExports: analyzedFile.metrics.publicExports,
    };
    return acc;
  }, {});

  return { files };
}

function formatTrend(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }

  if (value === 0) {
    return '0';
  }

  return value > 0 ? `+${value}` : `${value}`;
}

function buildModuleSummaries(analyzedFiles: AnalyzedFile[]): ModuleSummary[] {
  const summaryMap = new Map<string, ModuleSummary>();

  for (const analyzedFile of analyzedFiles) {
    const existing = summaryMap.get(analyzedFile.module.id);
    if (existing) {
      existing.fileCount += 1;
      existing.maxFileLines = Math.max(existing.maxFileLines, analyzedFile.metrics.fileLines);
      existing.maxFunctionLines = Math.max(existing.maxFunctionLines, analyzedFile.metrics.maxFunctionLines);
      existing.maxCyclomaticComplexity = Math.max(
        existing.maxCyclomaticComplexity,
        analyzedFile.metrics.maxCyclomaticComplexity
      );
      existing.maxPublicExports = Math.max(existing.maxPublicExports, analyzedFile.metrics.publicExports);
      continue;
    }

    summaryMap.set(analyzedFile.module.id, {
      module: analyzedFile.module,
      fileCount: 1,
      maxFileLines: analyzedFile.metrics.fileLines,
      maxFunctionLines: analyzedFile.metrics.maxFunctionLines,
      maxCyclomaticComplexity: analyzedFile.metrics.maxCyclomaticComplexity,
      maxPublicExports: analyzedFile.metrics.publicExports,
    });
  }

  return Array.from(summaryMap.values()).sort((left, right) => left.module.id.localeCompare(right.module.id));
}

function generateReport(analyzedFiles: AnalyzedFile[], violations: MetricViolation[]): string {
  const trackedViolations = violations.filter((violation) => violation.trackedFinding);
  const untrackedViolations = violations.filter((violation) => !violation.trackedFinding);
  const moduleRows = buildModuleSummaries(analyzedFiles).map(
    (summary) =>
      `| ${summary.module.label} | ${summary.module.class} | ${summary.fileCount} | ${summary.module.owner} | ${summary.module.reviewCadence} | ${summary.maxFileLines} | ${summary.maxFunctionLines} | ${summary.maxCyclomaticComplexity} | ${summary.maxPublicExports} |`
  );

  const reportLines = [
    '## Complexity Summary',
    '',
    '| Module | Klasse | Dateien | Owner | Review-Zyklus | Max Dateizeilen | Max Funktionslaenge | Max Cyclomatic | Max Public Exports |',
    '| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: |',
    ...moduleRows,
  ];

  if (untrackedViolations.length > 0) {
    reportLines.push(
      '',
      '### Neue Findings ohne Ticket',
      '',
      '| Modul | Datei | Metrik | Ist | Soll | Trend |',
      '| --- | --- | --- | ---: | ---: | ---: |',
      ...untrackedViolations.map(
        (violation) =>
          `| ${violation.moduleLabel} | ${violation.filePath} | ${violation.metric} | ${violation.current} | ${violation.threshold} | ${formatTrend(violation.trend)} |`
      )
    );
  }

  if (trackedViolations.length > 0) {
    reportLines.push(
      '',
      '### Getrackte Findings',
      '',
      '| Modul | Datei | Metrik | Ist | Soll | Trend | Ticket | Status |',
      '| --- | --- | --- | ---: | ---: | ---: | --- | --- |',
      ...trackedViolations.map((violation) => {
        const trackedFinding = violation.trackedFinding as TrackedFinding;
        return `| ${violation.moduleLabel} | ${violation.filePath} | ${violation.metric} | ${violation.current} | ${violation.threshold} | ${formatTrend(violation.trend)} | ${trackedFinding.ticketSystem}:${trackedFinding.ticketId} | ${trackedFinding.status} |`;
      })
    );
  }

  reportLines.push(
    '',
    `Ausgewertete Dateien: ${analyzedFiles.length}`,
    `Neue Findings: ${untrackedViolations.length}`,
    `Getrackte Findings: ${trackedViolations.length}`
  );

  return reportLines.join('\n') + '\n';
}

function writeSummary(stepSummaryPath: string | null, summaryBody: string): void {
  if (stepSummaryPath) {
    fs.appendFileSync(stepSummaryPath, summaryBody, 'utf8');
  }
}

export function runComplexityGate(options: RunComplexityGateOptions = {}): RunComplexityGateResult {
  const rootDir = options.rootDir ?? process.cwd();
  const updateBaseline = options.updateBaseline ?? false;
  const stepSummaryPath = options.stepSummaryPath ?? process.env.GITHUB_STEP_SUMMARY ?? null;
  const { paths, policy, baseline, analyzedFiles } = loadComplexityData(rootDir);

  if (analyzedFiles.length === 0) {
    throw new Error('No files matched the complexity policy');
  }

  if (updateBaseline) {
    const nextBaseline = buildBaseline(analyzedFiles);
    fs.writeFileSync(paths.baselinePath, JSON.stringify(nextBaseline, null, 2) + '\n', 'utf8');
    return {
      passed: true,
      updatedBaseline: true,
      summaryBody: '',
      trackedViolations: [],
      untrackedViolations: [],
      analyzedFiles,
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

  try {
    const result = runComplexityGate({
      rootDir,
      updateBaseline,
      stepSummaryPath: process.env.GITHUB_STEP_SUMMARY ?? null,
    });

    if (result.updatedBaseline) {
      console.log(colors.green(`✅ Updated complexity baseline at ${path.join(rootDir, 'tooling/quality/complexity-baseline.json')}`));
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
      console.warn(colors.yellow('⚠️  Complexity findings remain tracked via refactoring tickets.'));
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
