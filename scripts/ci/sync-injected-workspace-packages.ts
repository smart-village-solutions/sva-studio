import { cp, mkdir, readdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type WorkspacePackage = {
  dir: string;
  distDir: string;
  name: string;
  realDir: string;
};

const consumerDir = path.resolve(process.argv[2] ?? process.cwd());

const pathExists = async (targetPath: string) => {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

const resolveExistingPath = async (targetPath: string): Promise<string | null> => {
  return (await pathExists(targetPath)) ? targetPath : null;
};

const readPackageName = async (packageJsonPath: string): Promise<string | null> => {
  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { name?: string };
    return packageJson.name ?? null;
  } catch {
    return null;
  }
};

const findWorkspaceRoot = async (startDir: string) => {
  let currentDir = startDir;

  while (true) {
    if (await pathExists(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(`Kein pnpm-Workspace oberhalb von ${startDir} gefunden.`);
    }
    currentDir = parentDir;
  }
};

const readWorkspacePackage = async (packageDir: string): Promise<WorkspacePackage | null> => {
  const packageJsonPath = path.join(packageDir, 'package.json');
  if (!(await pathExists(packageJsonPath))) {
    return null;
  }

  const packageName = await readPackageName(packageJsonPath);
  if (!packageName) {
    return null;
  }

  return {
    dir: packageDir,
    distDir: path.join(packageDir, 'dist'),
    name: packageName,
    realDir: await realpath(packageDir),
  };
};

const collectWorkspacePackages = async (workspaceRoot: string) => {
  const packageRoots = ['apps', 'packages', 'tooling'];
  const workspacePackages: WorkspacePackage[] = [];

  for (const packageRoot of packageRoots) {
    const absoluteRoot = path.join(workspaceRoot, packageRoot);
    if (!(await pathExists(absoluteRoot))) {
      continue;
    }

    const entries = await readdir(absoluteRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const workspacePackage = await readWorkspacePackage(path.join(absoluteRoot, entry.name));
      if (workspacePackage) {
        workspacePackages.push(workspacePackage);
      }
    }
  }

  return workspacePackages;
};

const getInstalledPackageNodeModulesDirs = (packageDir: string): string[] => {
  const candidates = [path.join(packageDir, 'node_modules')];
  if (!packageDir.split(path.sep).join('/').includes('/node_modules/')) {
    return candidates;
  }

  const packageParentDir = path.dirname(packageDir);
  candidates.push(path.basename(packageParentDir).startsWith('@') ? path.dirname(packageParentDir) : packageParentDir);
  return [...new Set(candidates)];
};

const collectPackageDirs = async (nodeModulesDir: string): Promise<readonly string[]> => {
  const packageDirs: string[] = [];
  const entries = await readdir(nodeModulesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const entryPath = path.join(nodeModulesDir, entry.name);
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      const scopeEntries = await readdir(entryPath, { withFileTypes: true });
      for (const scopeEntry of scopeEntries) {
        if (scopeEntry.isDirectory() || scopeEntry.isSymbolicLink()) {
          packageDirs.push(path.join(entryPath, scopeEntry.name));
        }
      }
      continue;
    }

    if (entry.isDirectory() || entry.isSymbolicLink()) {
      packageDirs.push(entryPath);
    }
  }

  return packageDirs;
};

const findReachableWorkspacePackageNames = async (
  consumerDirPath: string,
  workspacePackages: readonly WorkspacePackage[]
): Promise<Set<string>> => {
  const workspaceRoot = await findWorkspaceRoot(consumerDirPath);
  const reachableWorkspacePackageNames = new Set<string>();
  const workspacePackageNames = new Set(workspacePackages.map((workspacePackage) => workspacePackage.name));
  const workspacePackagesByName = new Map(workspacePackages.map((workspacePackage) => [workspacePackage.name, workspacePackage]));
  const visitedNodeModulesDirs = new Set<string>();
  const visitedPackageDirs = new Set<string>();

  const inspectPackageDir = async (packageDir: string): Promise<void> => {
    let resolvedPackageDir: string;
    try {
      resolvedPackageDir = await realpath(packageDir);
    } catch {
      return;
    }

    if (visitedPackageDirs.has(resolvedPackageDir)) {
      return;
    }
    visitedPackageDirs.add(resolvedPackageDir);

    const packageJsonPath = path.join(resolvedPackageDir, 'package.json');
    if (!(await pathExists(packageJsonPath))) {
      return;
    }

    const packageName = await readPackageName(packageJsonPath);
    if (!packageName || !workspacePackageNames.has(packageName)) {
      return;
    }

    reachableWorkspacePackageNames.add(packageName);

    for (const nodeModulesDir of getInstalledPackageNodeModulesDirs(packageDir)) {
      await walkNodeModules(nodeModulesDir);
    }

    if (resolvedPackageDir !== packageDir) {
      const workspacePackage = workspacePackagesByName.get(packageName);
      if (workspacePackage && workspacePackage.realDir === resolvedPackageDir) {
        const injectedCopies = await findInjectedCopies(workspaceRoot, packageName);
        for (const injectedCopy of injectedCopies) {
          if (injectedCopy.realDir === resolvedPackageDir) {
            continue;
          }
          await inspectPackageDir(injectedCopy.dir);
        }
      } else {
        for (const nodeModulesDir of getInstalledPackageNodeModulesDirs(resolvedPackageDir)) {
          await walkNodeModules(nodeModulesDir);
        }
      }
    }
  };

  const walkNodeModules = async (nodeModulesDir: string): Promise<void> => {
    if (!(await pathExists(nodeModulesDir))) {
      return;
    }

    let resolvedNodeModulesDir: string;
    try {
      resolvedNodeModulesDir = await realpath(nodeModulesDir);
    } catch {
      return;
    }

    if (visitedNodeModulesDirs.has(resolvedNodeModulesDir)) {
      return;
    }
    visitedNodeModulesDirs.add(resolvedNodeModulesDir);

    for (const packageDir of await collectPackageDirs(resolvedNodeModulesDir)) {
      await inspectPackageDir(packageDir);
    }
  };

  await walkNodeModules(path.join(consumerDirPath, 'node_modules'));
  return reachableWorkspacePackageNames;
};

const findInjectedCopies = async (workspaceRoot: string, packageName: string) => {
  const virtualStoreDir = path.join(workspaceRoot, 'node_modules', '.pnpm');
  if (!(await pathExists(virtualStoreDir))) {
    return [];
  }

  const packageSegments = packageName.split('/');
  const virtualStoreEntries = await readdir(virtualStoreDir, { withFileTypes: true });
  const copies = new Map<string, string>();

  for (const entry of virtualStoreEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidateDir = path.join(virtualStoreDir, entry.name, 'node_modules', ...packageSegments);
    if (!(await pathExists(candidateDir))) {
      continue;
    }

    copies.set(await realpath(candidateDir), candidateDir);
  }

  return [...copies.entries()].map(([realDir, dir]) => ({ dir, realDir }));
};

const replaceInjectedDist = async (sourceDistDir: string, injectedPackageDir: string) => {
  const targetDistDir = path.join(injectedPackageDir, 'dist');
  await mkdir(injectedPackageDir, { recursive: true });
  await rm(targetDistDir, { recursive: true, force: true });
  await cp(sourceDistDir, targetDistDir, { force: true, recursive: true });
};

// fallow-ignore-next-line complexity
const syncWorkspacePackage = async (workspaceRoot: string, workspacePackage: WorkspacePackage) => {
  const sourceDistDir = await resolveExistingPath(workspacePackage.distDir);
  if (!sourceDistDir) {
    return { skipped: true, updatedCopies: 0 };
  }

  const injectedCopies = await findInjectedCopies(workspaceRoot, workspacePackage.name);
  let updatedCopies = 0;

  for (const injectedCopy of injectedCopies) {
    if (injectedCopy.realDir === workspacePackage.realDir) {
      continue;
    }

    const liveSourceDistDir = await resolveExistingPath(sourceDistDir);
    if (!liveSourceDistDir) {
      throw new Error(
        `Workspace-Paket ${workspacePackage.name} verlor ${sourceDistDir} während des Syncs nach ${updatedCopies} aktualisierten Injected-Copies.`
      );
    }
    await replaceInjectedDist(liveSourceDistDir, injectedCopy.dir);
    updatedCopies += 1;
  }

  return { skipped: false, updatedCopies };
};

const main = async () => {
  const workspaceRoot = await findWorkspaceRoot(consumerDir);
  const workspacePackages = await collectWorkspacePackages(workspaceRoot);
  const reachableWorkspacePackageNames = await findReachableWorkspacePackageNames(consumerDir, workspacePackages);

  const results = await Promise.all(
    workspacePackages
      .filter((workspacePackage) => reachableWorkspacePackageNames.has(workspacePackage.name))
      .map(async (workspacePackage) => ({
      name: workspacePackage.name,
      ...(await syncWorkspacePackage(workspaceRoot, workspacePackage)),
    }))
  );

  const updatedPackages = results.filter((result) => result.updatedCopies > 0);
  process.stdout.write(
    `${JSON.stringify(
      {
        consumerDir,
        reachableWorkspacePackages: [...reachableWorkspacePackageNames].sort(),
        updatedCopyCount: updatedPackages.reduce((total, result) => total + result.updatedCopies, 0),
        updatedPackages,
        workspaceRoot,
      },
      null,
      2
    )}\n`
  );
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

export { collectWorkspacePackages, findReachableWorkspacePackageNames, findInjectedCopies, findWorkspaceRoot, syncWorkspacePackage };
