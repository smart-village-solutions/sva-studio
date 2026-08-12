import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  diffViolationsAgainstBaseline,
  parsePluginArchitectureBaseline,
} from './plugin-architecture-boundary-baseline.ts';
import {
  collectSourceFiles,
  isWorkspaceDependency,
  normalizeWorkspaceModuleSpecifier,
  pathExists,
  readPluginPackages,
  toPosixRelativePath,
} from './plugin-architecture-boundary-filesystem.ts';
import { collectTypeScriptImportEdges } from './typescript-import-edges.ts';
import {
  FORBIDDEN_HOST_WORKSPACE_PACKAGES,
  FORBIDDEN_PATH_SIGNALS,
  getWorkspaceImportSubject,
  isAllowedWorkspaceDependency,
  isAllowedWorkspaceModuleSpecifier,
  isForbiddenHostWorkspaceModuleSpecifier,
  matchesReviewRequiredPathSignal,
  type PluginArchitectureImportKind,
  type PluginPackage,
  REVIEW_REQUIRED_PATH_SIGNALS,
  WORKSPACE_DEPENDENCY_FIELDS,
} from './plugin-architecture-boundary-workspace.ts';
export type { PluginArchitectureImportKind } from './plugin-architecture-boundary-workspace.ts';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../..');
export const DEFAULT_BASELINE_PATH = path.join(
  PROJECT_ROOT,
  'docs/reports/plugin-architecture-boundary-baseline.md'
);

export type PluginArchitectureViolationRule =
  | 'workspace-dependency'
  | 'workspace-import'
  | 'forbidden-path-signal'
  | 'review-required-path-signal';
export type PluginArchitectureViolation = {
  packageName: string;
  relativePath: string;
  rule: PluginArchitectureViolationRule;
  subject: string;
  message: string;
  importSpecifier?: string;
  resolvedTarget?: string;
  kind?: PluginArchitectureImportKind;
};
export type PluginArchitectureBaselineEntry = {
  packageName: string;
  relativePath: string;
  rule: PluginArchitectureViolationRule;
  subject: string;
  owner: string;
  justification: string;
  removalChange: string;
};
const createViolation = (
  packageName: string,
  relativePath: string,
  rule: PluginArchitectureViolationRule,
  subject: string,
  message: string,
  details: Partial<
    Pick<PluginArchitectureViolation, 'importSpecifier' | 'resolvedTarget' | 'kind'>
  > = {}
): PluginArchitectureViolation => ({
  packageName,
  relativePath,
  rule,
  subject,
  message,
  ...details,
});

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
      if (
        !isWorkspaceDependency(dependencyName, version) ||
        isAllowedWorkspaceDependency(pluginPackage.packageName, dependencyName)
      ) {
        continue;
      }
      const message = FORBIDDEN_HOST_WORKSPACE_PACKAGES.has(dependencyName)
        ? `${pluginPackage.packageName} darf ${dependencyName} nicht direkt als Host-Package konsumieren`
        : `${pluginPackage.packageName} führt mit ${dependencyName} eine nicht freigegebene Workspace-Abhängigkeit ein`;
      violations.push(
        createViolation(
          pluginPackage.packageName,
          packageRelativePath,
          'workspace-dependency',
          dependencyName,
          message
        )
      );
    }
  }

  const sourceDir = path.join(pluginPackage.packageDir, 'src');
  if (!(await pathExists(sourceDir))) {
    return violations;
  }

  for (const filePath of await collectSourceFiles(sourceDir)) {
    const relativePath = toPosixRelativePath(projectRoot, filePath);

    for (const edge of collectTypeScriptImportEdges(filePath, await readFile(filePath, 'utf8'))) {
      const resolvedTarget = await normalizeWorkspaceModuleSpecifier(
        edge.importSpecifier,
        filePath,
        pluginPackage.packageDir,
        projectRoot
      );
      if (
        !resolvedTarget ||
        isAllowedWorkspaceModuleSpecifier(pluginPackage.packageName, resolvedTarget)
      ) {
        continue;
      }
      const subject = getWorkspaceImportSubject(resolvedTarget);
      const message = resolvedTarget.startsWith('apps/')
        ? `${pluginPackage.packageName} importiert App-Code statt eines öffentlichen Plugin-Vertrags`
        : isForbiddenHostWorkspaceModuleSpecifier(resolvedTarget)
          ? `${pluginPackage.packageName} importiert das interne Host-Package ${subject}`
          : `${pluginPackage.packageName} importiert mit ${subject} einen nicht freigegebenen Workspace-Vertrag`;
      violations.push(
        createViolation(
          pluginPackage.packageName,
          relativePath,
          'workspace-import',
          subject,
          message,
          {
            importSpecifier: edge.importSpecifier,
            resolvedTarget,
            kind: edge.kind,
          }
        )
      );
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

export const collectPluginArchitectureViolations = async (
  projectRoot = PROJECT_ROOT
): Promise<readonly PluginArchitectureViolation[]> => {
  const pluginPackages = await readPluginPackages(projectRoot);
  const nestedViolations = await Promise.all(
    pluginPackages.map((pluginPackage) => collectPackageViolations(pluginPackage, projectRoot))
  );
  return nestedViolations
    .flat()
    .sort((left, right) =>
      `${left.packageName}:${left.rule}:${left.subject}:${left.relativePath}`.localeCompare(
        `${right.packageName}:${right.rule}:${right.subject}:${right.relativePath}`
      )
    );
};
export { diffViolationsAgainstBaseline, parsePluginArchitectureBaseline };
export const runPluginArchitectureBoundaryCheck = async (
  projectRoot = PROJECT_ROOT,
  baselinePath = DEFAULT_BASELINE_PATH
): Promise<readonly PluginArchitectureViolation[]> => {
  const [baselineMarkdown, violations] = await Promise.all([
    readFile(baselinePath, 'utf8'),
    collectPluginArchitectureViolations(projectRoot),
  ]);
  return diffViolationsAgainstBaseline(
    violations,
    parsePluginArchitectureBaseline(baselineMarkdown)
  );
};
