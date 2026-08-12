import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { PackageJson, PluginPackage } from './plugin-architecture-boundary-workspace.ts';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

export const toPosixRelativePath = (projectRoot: string, targetPath: string): string =>
  path.relative(projectRoot, targetPath).split(path.sep).join(path.posix.sep);

export const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

export const collectSourceFiles = async (directory: string): Promise<string[]> => {
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

export const readPluginPackages = async (
  projectRoot: string
): Promise<readonly PluginPackage[]> => {
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

export const isWorkspaceDependency = (packageName: string, version: string): boolean =>
  packageName.startsWith('@sva/') && version.startsWith('workspace:');

const normalizeWorkspaceResolvedTarget = (
  packageName: string,
  resolvedRelativePath: string
): string => {
  if (!resolvedRelativePath.startsWith('packages/')) return resolvedRelativePath;

  const sourceMatch = resolvedRelativePath.match(/^packages\/([^/]+)\/src\/(.+)$/);
  if (!sourceMatch) return packageName;

  const [, , sourceSubpath] = sourceMatch;
  const withoutExtension = sourceSubpath.replace(/\.[^.]+$/, '');
  const cleaned = withoutExtension.replace(/\/index$/, '');
  const segments = cleaned.split('/');
  if (segments.length > 1 && !withoutExtension.endsWith('/index')) {
    segments.pop();
  }
  return segments.length > 0 ? `${packageName}/${segments.join('/')}` : packageName;
};

export const normalizeWorkspaceModuleSpecifier = async (
  moduleSpecifier: string,
  importerPath: string,
  packageDir: string,
  projectRoot: string
): Promise<string | null> => {
  if (moduleSpecifier.startsWith('@sva/')) return moduleSpecifier;
  const normalized = path.posix.normalize(moduleSpecifier.replaceAll('\\', '/'));
  const withoutRelativePrefix = normalized.replace(/^(?:(?:\.\.\/)|(?:\.\/))+/, '');
  if (withoutRelativePrefix.startsWith('apps/')) return withoutRelativePrefix;
  if (!normalized.startsWith('.')) return null;
  const resolvedPath = path.resolve(path.dirname(importerPath), moduleSpecifier);
  const pluginPackagePrefix = `${packageDir}${path.sep}`;
  if (resolvedPath === packageDir || resolvedPath.startsWith(pluginPackagePrefix)) return null;
  const projectRootPrefix = `${projectRoot}${path.sep}`;
  if (!resolvedPath.startsWith(projectRootPrefix)) return null;
  const resolvedRelativePath = toPosixRelativePath(projectRoot, resolvedPath);
  if (resolvedRelativePath.startsWith('apps/')) return resolvedRelativePath;
  if (!resolvedRelativePath.startsWith('packages/')) return null;
  let currentDirectory = path.dirname(resolvedPath);
  while (currentDirectory === projectRoot || currentDirectory.startsWith(projectRootPrefix)) {
    const packageJsonPath = path.join(currentDirectory, 'package.json');
    if (await pathExists(packageJsonPath)) {
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson;
      return packageJson.name
        ? normalizeWorkspaceResolvedTarget(packageJson.name, resolvedRelativePath)
        : resolvedRelativePath;
    }
    if (currentDirectory === projectRoot) break;
    currentDirectory = path.dirname(currentDirectory);
  }
  return resolvedRelativePath;
};
