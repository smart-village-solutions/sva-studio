import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  collectTypeScriptImportEdges,
  type TypeScriptImportKind,
} from './typescript-import-edges.ts';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../..');

const SOURCE_EXTENSIONS = new Set(['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);
const IGNORED_DIRECTORIES = new Set([
  '.nx',
  '.output',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);

export type AppBoundaryViolation = {
  readonly sourceApp: string;
  readonly targetApp: string;
  readonly relativePath: string;
  readonly importSpecifier: string;
  readonly resolvedTarget: string;
  readonly kind: TypeScriptImportKind;
};

export type AppBoundaryCheckResult = {
  readonly violations: readonly AppBoundaryViolation[];
  readonly exitCode: 0 | 1;
};

export type AppBoundaryCheckLogger = Pick<typeof console, 'error'>;

const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const toPosixRelativePath = (projectRoot: string, targetPath: string): string =>
  path.relative(projectRoot, targetPath).split(path.sep).join(path.posix.sep);

const collectSourceFiles = async (directory: string): Promise<readonly string[]> => {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !IGNORED_DIRECTORIES.has(entry.name)) {
      files.push(...(await collectSourceFiles(path.join(directory, entry.name))));
      continue;
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
};

const resolveTargetApp = (
  projectRoot: string,
  importerPath: string,
  moduleSpecifier: string
): Readonly<{ targetApp: string; resolvedTarget: string }> | null => {
  const normalizedSpecifier = moduleSpecifier.replaceAll('\\', '/');
  const resolvedPath = normalizedSpecifier.startsWith('.')
    ? path.resolve(path.dirname(importerPath), normalizedSpecifier)
    : normalizedSpecifier.startsWith('apps/')
      ? path.resolve(projectRoot, normalizedSpecifier)
      : null;
  if (!resolvedPath) {
    return null;
  }

  const resolvedTarget = toPosixRelativePath(projectRoot, resolvedPath);
  const match = resolvedTarget.match(/^apps\/([^/]+)(?:\/|$)/u);
  return match?.[1] ? { targetApp: match[1], resolvedTarget } : null;
};

export const collectAppBoundaryViolations = async (
  projectRoot = PROJECT_ROOT
): Promise<readonly AppBoundaryViolation[]> => {
  const appsDirectory = path.join(projectRoot, 'apps');
  if (!(await pathExists(appsDirectory))) {
    return [];
  }

  const violations: AppBoundaryViolation[] = [];
  for (const appEntry of await readdir(appsDirectory, { withFileTypes: true })) {
    if (!appEntry.isDirectory()) {
      continue;
    }
    const sourceApp = appEntry.name;
    const appDirectory = path.join(appsDirectory, sourceApp);
    for (const filePath of await collectSourceFiles(appDirectory)) {
      const relativePath = toPosixRelativePath(projectRoot, filePath);
      const edges = collectTypeScriptImportEdges(filePath, await readFile(filePath, 'utf8'));
      for (const edge of edges) {
        const target = resolveTargetApp(projectRoot, filePath, edge.importSpecifier);
        if (!target || target.targetApp === sourceApp) {
          continue;
        }
        violations.push({
          sourceApp,
          targetApp: target.targetApp,
          relativePath,
          importSpecifier: edge.importSpecifier,
          resolvedTarget: target.resolvedTarget,
          kind: edge.kind,
        });
      }
    }
  }

  return violations.sort((left, right) =>
    `${left.relativePath}:${left.importSpecifier}:${left.kind}`.localeCompare(
      `${right.relativePath}:${right.importSpecifier}:${right.kind}`
    )
  );
};

export const runAppBoundaryCheck = async (projectRoot = PROJECT_ROOT): Promise<AppBoundaryCheckResult> => {
  const violations = await collectAppBoundaryViolations(projectRoot);
  return {
    violations,
    exitCode: violations.length > 0 ? 1 : 0,
  };
};

export const reportAppBoundaryCheckResult = (
  result: AppBoundaryCheckResult,
  logger: AppBoundaryCheckLogger = console
): boolean => {
  if (result.violations.length === 0) {
    return false;
  }

  logger.error('App-Boundary-Check meldet direkte Quellimporte zwischen Anwendungen.');
  for (const violation of result.violations) {
    logger.error(
      `- [${violation.kind}] ${violation.relativePath}: ${violation.sourceApp} -> ${violation.targetApp} (${violation.importSpecifier})`
    );
  }
  return true;
};

const run = async (): Promise<void> => {
  const result = await runAppBoundaryCheck();
  reportAppBoundaryCheckResult(result);
  process.exitCode = result.exitCode;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run();
}
