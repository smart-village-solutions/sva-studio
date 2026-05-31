import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

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
  packageName: string; rule: PluginArchitectureViolationRule; subject: string; owner: string; justification: string; removalChange: string;
};
type PackageJson = { name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };
type PluginPackage = { packageName: string; packageDir: string; packageJson: PackageJson };
const RULES = new Set<PluginArchitectureViolationRule>(['workspace-dependency', 'workspace-import', 'forbidden-path-signal', 'review-required-path-signal']);

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
      if (!moduleSpecifier || ALLOWED_WORKSPACE_DEPENDENCIES.has(moduleSpecifier)) {
        continue;
      }
      const message = moduleSpecifier.startsWith('apps/')
        ? `${pluginPackage.packageName} importiert App-Code statt eines oeffentlichen Plugin-Vertrags`
        : FORBIDDEN_HOST_WORKSPACE_PACKAGES.has(moduleSpecifier)
          ? `${pluginPackage.packageName} importiert das interne Host-Package ${moduleSpecifier}`
          : `${pluginPackage.packageName} importiert mit ${moduleSpecifier} einen nicht freigegebenen Workspace-Vertrag`;
      violations.push(createViolation(pluginPackage.packageName, relativePath, 'workspace-import', moduleSpecifier, message));
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
      if (normalizedPath.includes(signal)) {
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

export const parsePluginArchitectureBaseline = (markdown: string): readonly PluginArchitectureBaselineEntry[] => {
  const baselineMatch = markdown.match(/## Machine Readable Baseline\s+```json\s*([\s\S]*?)```/m);
  if (!baselineMatch) {
    throw new Error('Machine Readable Baseline JSON-Codeblock fehlt.');
  }

  const parsed = JSON.parse(baselineMatch[1]) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Machine Readable Baseline muss ein JSON-Array sein.');
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Baseline-Eintrag ${index} ist kein Objekt.`);
    }
    const candidate = entry as Record<string, unknown>;
    const { packageName, rule, subject, owner, justification, removalChange } = candidate;
    if (
      typeof packageName !== 'string' ||
      typeof rule !== 'string' ||
      typeof subject !== 'string' ||
      typeof owner !== 'string' ||
      typeof justification !== 'string' ||
      typeof removalChange !== 'string'
    ) {
      throw new Error(`Baseline-Eintrag ${index} ist unvollstaendig oder typungueltig.`);
    }
    if (!RULES.has(rule as PluginArchitectureViolationRule)) {
      throw new Error(`Baseline-Eintrag ${index} verwendet die unbekannte Regel ${rule}.`);
    }
    return {
      packageName,
      rule: rule as PluginArchitectureViolationRule,
      subject,
      owner,
      justification,
      removalChange,
    };
  });
};

const getViolationKey = (violation: Pick<PluginArchitectureViolation, 'packageName' | 'rule' | 'subject'>): string =>
  `${violation.packageName}::${violation.rule}::${violation.subject}`;

export const diffViolationsAgainstBaseline = (
  violations: readonly PluginArchitectureViolation[],
  baseline: readonly PluginArchitectureBaselineEntry[]
): readonly PluginArchitectureViolation[] => {
  const baselineKeys = new Set(baseline.map(getViolationKey));
  return violations.filter((violation) => !baselineKeys.has(getViolationKey(violation)));
};

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
