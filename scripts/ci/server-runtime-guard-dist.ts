import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { discoverWorkspacePackages, isDirectory, readJsonFile } from './server-runtime-guard-workspace.js';
import type { RuntimeViolation } from './server-runtime-guard-workspace.js';

const safeRemoveDirectory = (targetDir: string): void => {
  try {
    fs.rmSync(targetDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 25,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
};

const replaceInjectedDist = (sourceDistDir: string, injectedPackageDir: string): void => {
  fs.mkdirSync(injectedPackageDir, { recursive: true });

  const targetDistDir = path.join(injectedPackageDir, 'dist');
  const swapSuffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const stagedDistDir = path.join(injectedPackageDir, `.dist-sync-${swapSuffix}`);
  const backupDistDir = path.join(injectedPackageDir, `.dist-backup-${swapSuffix}`);

  safeRemoveDirectory(stagedDistDir);
  safeRemoveDirectory(backupDistDir);

  try {
    fs.cpSync(sourceDistDir, stagedDistDir, { force: true, recursive: true });

    if (fs.existsSync(targetDistDir)) {
      fs.renameSync(targetDistDir, backupDistDir);
    }
    fs.renameSync(stagedDistDir, targetDistDir);
  } catch (error) {
    safeRemoveDirectory(stagedDistDir);

    if (fs.existsSync(backupDistDir) && !fs.existsSync(targetDistDir)) {
      fs.renameSync(backupDistDir, targetDistDir);
    }

    throw error;
  }

  safeRemoveDirectory(backupDistDir);
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

const resolveWorkspaceRuntimePackageDirs = (
  rootDir: string,
  packageDir: string,
  workspacePackages = discoverWorkspacePackages(rootDir)
): ReadonlySet<string> => {
  const packageDirs = new Set<string>();
  const pending = [packageDir];

  while (pending.length > 0) {
    const currentPackageDir = pending.pop();
    if (!currentPackageDir || packageDirs.has(currentPackageDir)) {
      continue;
    }
    packageDirs.add(currentPackageDir);

    const packageJson = readJsonFile<{
      dependencies?: Record<string, string>;
    }>(path.join(currentPackageDir, 'package.json'));

    for (const [dependencyName, dependencyRange] of Object.entries(packageJson.dependencies ?? {})) {
      if (!dependencyRange.startsWith('workspace:')) {
        continue;
      }
      const workspaceDependency = workspacePackages.get(dependencyName);
      if (workspaceDependency) {
        pending.push(workspaceDependency.packageDir);
      }
    }
  }

  return packageDirs;
};

export const syncInjectedWorkspacePackageDists = (
  rootDir: string,
  packageDirs: Iterable<string> = [...discoverWorkspacePackages(rootDir).values()].map(
    (workspacePackage) => workspacePackage.packageDir
  )
): number => {
  const virtualStoreDir = path.join(rootDir, 'node_modules', '.pnpm');
  if (!isDirectory(virtualStoreDir)) {
    return 0;
  }

  let updatedCopies = 0;
  const virtualStoreEntries = fs.readdirSync(virtualStoreDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  for (const packageDir of packageDirs) {
    const packageJson = readJsonFile<{ name?: string }>(path.join(packageDir, 'package.json'));
    if (!packageJson.name) {
      continue;
    }

    const sourceDistDir = path.join(packageDir, 'dist');
    if (!isDirectory(sourceDistDir)) {
      continue;
    }

    const sourceRealDir = fs.realpathSync(packageDir);
    const packageSegments = packageJson.name.split('/');

    for (const entry of virtualStoreEntries) {
      const injectedPackageDir = path.join(virtualStoreDir, entry.name, 'node_modules', ...packageSegments);
      if (!isDirectory(injectedPackageDir)) {
        continue;
      }
      if (fs.realpathSync(injectedPackageDir) === sourceRealDir) {
        continue;
      }

      replaceInjectedDist(sourceDistDir, injectedPackageDir);
      updatedCopies += 1;
    }
  }

  return updatedCopies;
};

export const runDistRuntimeSmokeCheck = async (rootDir: string, packageDir: string): Promise<RuntimeViolation[]> => {
  const violations: RuntimeViolation[] = [];
  const previousEnableOtel = process.env.ENABLE_OTEL;

  if (previousEnableOtel === undefined) {
    process.env.ENABLE_OTEL = 'false';
  }

  try {
    syncInjectedWorkspacePackageDists(rootDir, resolveWorkspaceRuntimePackageDirs(rootDir, packageDir));

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
