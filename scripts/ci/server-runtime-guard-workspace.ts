import fs from 'node:fs';
import path from 'node:path';

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

export const readJsonFile = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

export const isDirectory = (filePath: string): boolean => {
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
