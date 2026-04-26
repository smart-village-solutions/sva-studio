import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

export type RuntimeImportReference = Readonly<{
  filePath: string;
  isTypeOnly: boolean;
  kind: 'dynamic-import' | 'export' | 'import';
  line: number;
  specifier: string;
}>;

export type RuntimeViolation = Readonly<{
  filePath: string;
  line?: number;
  message: string;
}>;

const RUNTIME_EXTENSION_PATTERN = /\.(?:cjs|js|json|mjs|node)$/;
const SKIPPED_FILE_PATTERN =
  /(?:\.test|\.integration\.test|\.vitest\.test|\.e2e\.test|\.spec|\.stories|\.story|\.TEST)\.[cm]?tsx?$/;

const formatViolation = (violation: RuntimeViolation): string =>
  violation.line ? `${violation.filePath}:${violation.line}: ${violation.message}` : `${violation.filePath}: ${violation.message}`;

const readJsonFile = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const isDirectory = (filePath: string): boolean => {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
};

const walkFiles = (rootDir: string, predicate: (filePath: string) => boolean): string[] => {
  const results: string[] = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current || !isDirectory(current)) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }
      if (predicate(absolutePath)) {
        results.push(absolutePath);
      }
    }
  }

  return results.sort();
};

export const discoverWorkspacePackages = (
  rootDir: string
): ReadonlyMap<string, Readonly<{ dirName: string; packageDir: string }>> => {
  const packagesDir = path.join(rootDir, 'packages');
  const results = new Map<string, Readonly<{ dirName: string; packageDir: string }>>();

  if (!isDirectory(packagesDir)) {
    return results;
  }

  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageDir = path.join(packagesDir, entry.name);
    const packageJsonPath = path.join(packageDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }
    const packageJson = readJsonFile<{ name?: string }>(packageJsonPath);
    if (!packageJson.name) {
      continue;
    }
    results.set(packageJson.name, {
      dirName: entry.name,
      packageDir,
    });
  }

  return results;
};

export const findPackageDirectory = (rootDir: string, packageSelector: string): string => {
  const directDir = path.join(rootDir, 'packages', packageSelector);
  if (isDirectory(directDir)) {
    return directDir;
  }

  const workspacePackages = discoverWorkspacePackages(rootDir);
  const found = workspacePackages.get(packageSelector);
  if (found) {
    return found.packageDir;
  }

  throw new Error(`Unknown workspace package: ${packageSelector}`);
};

const isRuntimeSourceFile = (filePath: string): boolean =>
  /\.(?:cts|mts|ts|tsx)$/.test(filePath) && !SKIPPED_FILE_PATTERN.test(filePath);

export const collectRuntimeSourceFiles = (packageDir: string): string[] =>
  walkFiles(path.join(packageDir, 'src'), isRuntimeSourceFile);

const readLineNumber = (sourceFile: ts.SourceFile, nodeStart: number): number =>
  sourceFile.getLineAndCharacterOfPosition(nodeStart).line + 1;

export const collectRuntimeImportReferences = (filePath: string): RuntimeImportReference[] => {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const references: RuntimeImportReference[] = [];

  const pushReference = (
    specifier: string,
    isTypeOnly: boolean,
    kind: RuntimeImportReference['kind'],
    nodeStart: number
  ): void => {
    references.push({
      filePath,
      isTypeOnly,
      kind,
      line: readLineNumber(sourceFile, nodeStart),
      specifier,
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      pushReference(node.moduleSpecifier.text, node.importClause?.isTypeOnly ?? false, 'import', node.getStart(sourceFile));
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      pushReference(node.moduleSpecifier.text, node.isTypeOnly ?? false, 'export', node.getStart(sourceFile));
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      pushReference(node.arguments[0].text, false, 'dynamic-import', node.getStart(sourceFile));
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return references;
};

const normalizeWorkspaceImport = (specifier: string): string | null => {
  if (!specifier.startsWith('@')) {
    return null;
  }

  const parts = specifier.split('/');
  if (parts.length < 2) {
    return null;
  }

  return `${parts[0]}/${parts[1]}`;
};

const hasRuntimeExtension = (specifier: string): boolean => RUNTIME_EXTENSION_PATTERN.test(specifier);

export const findStaticRuntimeViolations = (
  rootDir: string,
  packageDir: string,
  workspacePackages = discoverWorkspacePackages(rootDir)
): RuntimeViolation[] => {
  const packageJsonPath = path.join(packageDir, 'package.json');
  const packageJson = readJsonFile<{
    dependencies?: Record<string, string>;
    name: string;
  }>(packageJsonPath);

  const dependencyNames = new Set(Object.keys(packageJson.dependencies ?? {}));
  const violations: RuntimeViolation[] = [];

  for (const filePath of collectRuntimeSourceFiles(packageDir)) {
    for (const reference of collectRuntimeImportReferences(filePath)) {
      if (!reference.isTypeOnly && reference.specifier.startsWith('.') && !hasRuntimeExtension(reference.specifier)) {
        violations.push({
          filePath: path.relative(rootDir, filePath),
          line: reference.line,
          message: `relative runtime ${reference.kind} must use an explicit runtime extension (.js/.mjs/.cjs/.json): ${reference.specifier}`,
        });
      }

      if (reference.isTypeOnly) {
        continue;
      }

      const workspaceDependency = normalizeWorkspaceImport(reference.specifier);
      if (!workspaceDependency || workspaceDependency === packageJson.name || !workspacePackages.has(workspaceDependency)) {
        continue;
      }

      if (!dependencyNames.has(workspaceDependency)) {
        violations.push({
          filePath: path.relative(rootDir, filePath),
          line: reference.line,
          message: `runtime import ${reference.specifier} requires ${workspaceDependency} in dependencies`,
        });
      }
    }
  }

  return violations;
};

const readExportTarget = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'default' in value) {
    const defaultValue = (value as { default?: unknown }).default;
    return typeof defaultValue === 'string' ? defaultValue : null;
  }
  return null;
};

export const collectDistRuntimeEntryPoints = (packageDir: string): string[] => {
  const packageJson = readJsonFile<{ exports?: Record<string, unknown> }>(path.join(packageDir, 'package.json'));
  const entryPoints = new Set<string>();

  for (const exportValue of Object.values(packageJson.exports ?? {})) {
    const target = readExportTarget(exportValue);
    if (!target || !target.startsWith('./dist/') || !target.endsWith('.js')) {
      continue;
    }
    entryPoints.add(target);
  }

  return [...entryPoints].sort();
};

export const runDistRuntimeSmokeCheck = async (rootDir: string, packageDir: string): Promise<RuntimeViolation[]> => {
  const violations: RuntimeViolation[] = [];
  const previousEnableOtel = process.env.ENABLE_OTEL;

  if (previousEnableOtel === undefined) {
    process.env.ENABLE_OTEL = 'false';
  }

  try {
    for (const relativeEntryPoint of collectDistRuntimeEntryPoints(packageDir)) {
      const absoluteEntryPoint = path.join(packageDir, relativeEntryPoint);
      const relativePath = path.relative(rootDir, absoluteEntryPoint);
      if (!fs.existsSync(absoluteEntryPoint)) {
        violations.push({
          filePath: relativePath,
          message: 'dist entry point is missing; run the package build before the smoke check',
        });
        continue;
      }

      try {
        await import(`${pathToFileURL(absoluteEntryPoint).href}?runtime-guard=${Date.now()}`);
      } catch (error) {
        violations.push({
          filePath: relativePath,
          message: `dist runtime import failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  } finally {
    if (previousEnableOtel === undefined) {
      delete process.env.ENABLE_OTEL;
    }
  }

  return violations;
};

export const checkServerPackageRuntime = async (input: {
  rootDir: string;
  packageSelector: string;
  mode?: 'all' | 'smoke' | 'static';
}): Promise<RuntimeViolation[]> => {
  const packageDir = findPackageDirectory(input.rootDir, input.packageSelector);
  const mode = input.mode ?? 'all';

  const violations: RuntimeViolation[] = [];
  if (mode === 'all' || mode === 'static') {
    violations.push(...findStaticRuntimeViolations(input.rootDir, packageDir));
  }
  if (mode === 'all' || mode === 'smoke') {
    violations.push(...(await runDistRuntimeSmokeCheck(input.rootDir, packageDir)));
  }
  return violations;
};

const parseArgValue = (args: readonly string[], flag: string): string[] => {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) {
      continue;
    }
    const nextValue = args[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      throw new Error(`Missing value for ${flag}`);
    }
    values.push(nextValue);
    index += 1;
  }
  return values;
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const packageSelectors = parseArgValue(args, '--package');
  const rootDir = parseArgValue(args, '--root-dir')[0] ?? process.cwd();
  const modeValue = parseArgValue(args, '--mode')[0] ?? 'all';
  const mode = modeValue === 'static' || modeValue === 'smoke' || modeValue === 'all' ? modeValue : null;

  if (!mode) {
    throw new Error(`Unsupported mode: ${modeValue}`);
  }
  if (packageSelectors.length === 0) {
    throw new Error('Pass at least one --package <name> argument.');
  }

  const allViolations: RuntimeViolation[] = [];
  for (const packageSelector of packageSelectors) {
    const violations = await checkServerPackageRuntime({
      rootDir,
      packageSelector,
      mode,
    });
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    console.error('Server package runtime guard failed:\n');
    for (const violation of allViolations) {
      console.error(`- ${formatViolation(violation)}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Server package runtime guard passed for ${packageSelectors.join(', ')} (${mode}).`);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main();
}
