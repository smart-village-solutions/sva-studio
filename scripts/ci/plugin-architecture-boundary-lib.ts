import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

import {
  diffViolationsAgainstBaseline,
  parsePluginArchitectureBaseline,
} from './plugin-architecture-boundary-baseline.ts';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../..');
export const DEFAULT_BASELINE_PATH = path.join(PROJECT_ROOT, 'docs/reports/plugin-architecture-boundary-baseline.md');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const WORKSPACE_DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
const ALLOWED_WORKSPACE_DEPENDENCIES = new Set(['@sva/plugin-sdk', '@sva/studio-ui-react']);
const FORBIDDEN_HOST_WORKSPACE_PACKAGES = new Set([
  '@sva/core',
  '@sva/auth-runtime',
  '@sva/server-runtime',
  '@sva/routing',
  '@sva/iam-core',
  '@sva/iam-admin',
  '@sva/iam-governance',
  '@sva/instance-registry',
  '@sva/data',
  '@sva/data-client',
  '@sva/data-repositories',
  '@sva/sva-mainserver',
  '@sva/studio-module-iam',
  '@sva/monitoring-client',
  '@sva/media',
]);
const FORBIDDEN_PATH_SIGNALS = ['route-binding', 'plugin-catalog', 'catalog-loader', 'plugin-build-registry', 'mainserver-', 'admin-resource-'];
const REVIEW_REQUIRED_PATH_SIGNALS = ['server.ts', 'plugin-operations.ts', '.controller.', '.loaders.', '.state.', '.submissions.'];

export type PluginArchitectureViolationRule = 'workspace-dependency' | 'workspace-import' | 'forbidden-path-signal' | 'review-required-path-signal';
export type PluginArchitectureViolation = { packageName: string; relativePath: string; rule: PluginArchitectureViolationRule; subject: string; message: string };
export type PluginArchitectureBaselineEntry = {
  packageName: string; relativePath: string; rule: PluginArchitectureViolationRule; subject: string; owner: string; justification: string; removalChange: string;
};
type PackageJson = { name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };
type PluginPackage = { packageName: string; packageDir: string; packageJson: PackageJson };

const toPosixRelativePath = (projectRoot: string, targetPath: string): string =>
  path.relative(projectRoot, targetPath).split(path.sep).join(path.posix.sep);

const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const collectSourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
      continue;
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
};

const isPluginPackageName = (packageName: string): boolean =>
  packageName.startsWith('@sva/plugin-') && packageName !== '@sva/plugin-sdk';

const readPluginPackages = async (projectRoot: string): Promise<readonly PluginPackage[]> => {
  const packagesDir = path.join(projectRoot, 'packages');
  if (!(await pathExists(packagesDir))) {
    return [];
  }

  const entries = await readdir(packagesDir, { withFileTypes: true });
  const pluginPackages: PluginPackage[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = path.join(packagesDir, entry.name);
    const packageJsonPath = path.join(packageDir, 'package.json');
    if (!(await pathExists(packageJsonPath))) {
      continue;
    }

    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson;
    const packageName = packageJson.name ?? '';
    if (isPluginPackageName(packageName)) {
      pluginPackages.push({ packageName, packageDir, packageJson });
    }
  }
  return pluginPackages;
};

const isWorkspaceDependency = (packageName: string, version: string): boolean =>
  packageName.startsWith('@sva/') && version.startsWith('workspace:');

const normalizeWorkspaceModuleSpecifier = (moduleSpecifier: string): string | null => {
  if (moduleSpecifier.startsWith('@sva/')) {
    return moduleSpecifier;
  }

  const normalized = path.posix.normalize(moduleSpecifier.replaceAll('\\', '/'));
  const withoutRelativePrefix = normalized.replace(/^(?:(?:\.\.\/)|(?:\.\/))+/, '');
  return withoutRelativePrefix.startsWith('apps/') ? withoutRelativePrefix : null;
};

const getWorkspacePackageName = (moduleSpecifier: string): string | null => {
  if (!moduleSpecifier.startsWith('@sva/')) {
    return null;
  }

  const [scope, packageName] = moduleSpecifier.split('/');
  return scope && packageName ? `${scope}/${packageName}` : null;
};

const isAllowedWorkspaceModuleSpecifier = (moduleSpecifier: string): boolean => {
  const workspacePackageName = getWorkspacePackageName(moduleSpecifier);
  return workspacePackageName ? ALLOWED_WORKSPACE_DEPENDENCIES.has(workspacePackageName) : false;
};

const isForbiddenHostWorkspaceModuleSpecifier = (moduleSpecifier: string): boolean => {
  const workspacePackageName = getWorkspacePackageName(moduleSpecifier);
  return workspacePackageName ? FORBIDDEN_HOST_WORKSPACE_PACKAGES.has(workspacePackageName) : false;
};

const getWorkspaceImportSubject = (moduleSpecifier: string): string =>
  getWorkspacePackageName(moduleSpecifier) ?? moduleSpecifier;

const matchesReviewRequiredPathSignal = (relativePath: string, signal: string): boolean => {
  const normalizedPath = relativePath.toLowerCase();
  if (signal === 'server.ts' || signal === 'plugin-operations.ts') {
    return path.posix.basename(normalizedPath) === signal;
  }

  return normalizedPath.includes(signal);
};

const getModuleSpecifiers = (sourceFile: ts.SourceFile): readonly string[] => {
  const moduleSpecifiers = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      moduleSpecifiers.add(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      moduleSpecifiers.add(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      ((node.expression.kind === ts.SyntaxKind.ImportKeyword) ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      moduleSpecifiers.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...moduleSpecifiers];
};

const createViolation = (
  packageName: string,
  relativePath: string,
  rule: PluginArchitectureViolationRule,
  subject: string,
  message: string
): PluginArchitectureViolation => ({ packageName, relativePath, rule, subject, message });

const collectPackageViolations = async (
  pluginPackage: PluginPackage,
  projectRoot: string
): Promise<readonly PluginArchitectureViolation[]> => {
  const violations: PluginArchitectureViolation[] = [];
  const packageJsonPath = path.join(pluginPackage.packageDir, 'package.json');
  const packageRelativePath = toPosixRelativePath(projectRoot, packageJsonPath);

  for (const fieldName of WORKSPACE_DEPENDENCY_FIELDS) {
    const dependencies = pluginPackage.packageJson[fieldName];
    if (!dependencies) {
      continue;
    }
    for (const [dependencyName, version] of Object.entries(dependencies)) {
      if (!isWorkspaceDependency(dependencyName, version) || ALLOWED_WORKSPACE_DEPENDENCIES.has(dependencyName)) {
        continue;
      }
      const message = FORBIDDEN_HOST_WORKSPACE_PACKAGES.has(dependencyName)
        ? `${pluginPackage.packageName} darf ${dependencyName} nicht direkt als Host-Package konsumieren`
        : `${pluginPackage.packageName} fuehrt mit ${dependencyName} eine nicht freigegebene Workspace-Abhaengigkeit ein`;
      violations.push(createViolation(pluginPackage.packageName, packageRelativePath, 'workspace-dependency', dependencyName, message));
    }
  }

  const sourceDir = path.join(pluginPackage.packageDir, 'src');
  if (!(await pathExists(sourceDir))) {
    return violations;
  }

  for (const filePath of await collectSourceFiles(sourceDir)) {
    const relativePath = toPosixRelativePath(projectRoot, filePath);
    const sourceFile = ts.createSourceFile(filePath, await readFile(filePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    for (const rawModuleSpecifier of getModuleSpecifiers(sourceFile)) {
      const moduleSpecifier = normalizeWorkspaceModuleSpecifier(rawModuleSpecifier);
      if (!moduleSpecifier || isAllowedWorkspaceModuleSpecifier(moduleSpecifier)) {
        continue;
      }
      const subject = getWorkspaceImportSubject(moduleSpecifier);
      const message = moduleSpecifier.startsWith('apps/')
        ? `${pluginPackage.packageName} importiert App-Code statt eines oeffentlichen Plugin-Vertrags`
        : isForbiddenHostWorkspaceModuleSpecifier(moduleSpecifier)
          ? `${pluginPackage.packageName} importiert das interne Host-Package ${subject}`
          : `${pluginPackage.packageName} importiert mit ${subject} einen nicht freigegebenen Workspace-Vertrag`;
      violations.push(createViolation(pluginPackage.packageName, relativePath, 'workspace-import', subject, message));
    }

    const normalizedPath = relativePath.toLowerCase();
    for (const signal of FORBIDDEN_PATH_SIGNALS) {
      if (normalizedPath.includes(signal)) {
        violations.push(
          createViolation(
            pluginPackage.packageName,
            relativePath,
            'forbidden-path-signal',
            signal,
            `${pluginPackage.packageName} verwendet mit ${signal} ein host-owned Dateistruktur-Signal`
          )
        );
      }
    }

    for (const signal of REVIEW_REQUIRED_PATH_SIGNALS) {
      if (matchesReviewRequiredPathSignal(relativePath, signal)) {
        violations.push(
          createViolation(
            pluginPackage.packageName,
            relativePath,
            'review-required-path-signal',
            signal,
            `${pluginPackage.packageName} verwendet mit ${signal} ein review-pflichtiges Runtime-Signal`
          )
        );
      }
    }
  }

  return violations;
};

export { diffViolationsAgainstBaseline, parsePluginArchitectureBaseline };

export const collectPluginArchitectureViolations = async (
  projectRoot = PROJECT_ROOT
): Promise<readonly PluginArchitectureViolation[]> => {
  const pluginPackages = await readPluginPackages(projectRoot);
  const nestedViolations = await Promise.all(pluginPackages.map((pluginPackage) => collectPackageViolations(pluginPackage, projectRoot)));
  return nestedViolations.flat().sort((left, right) =>
    `${left.packageName}:${left.rule}:${left.subject}:${left.relativePath}`.localeCompare(
      `${right.packageName}:${right.rule}:${right.subject}:${right.relativePath}`
    )
  );
};

export const runPluginArchitectureBoundaryCheck = async (
  projectRoot = PROJECT_ROOT,
  baselinePath = DEFAULT_BASELINE_PATH
): Promise<readonly PluginArchitectureViolation[]> => {
  const [baselineMarkdown, violations] = await Promise.all([
    readFile(baselinePath, 'utf8'),
    collectPluginArchitectureViolations(projectRoot),
  ]);
  return diffViolationsAgainstBaseline(violations, parsePluginArchitectureBaseline(baselineMarkdown));
};
