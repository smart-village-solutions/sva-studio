import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

type PackageProbe = {
  name: string;
  resolveFrom: string;
};

const workspaceRoot = process.cwd();
const requireFromHere = createRequire(import.meta.url);

const packageJson = JSON.parse(
  readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'),
) as {
  packageManager?: string;
};

const nvmrcPath = path.join(workspaceRoot, '.nvmrc');
const lockfilePath = path.join(workspaceRoot, 'pnpm-lock.yaml');
const appRoot = path.join(workspaceRoot, 'apps', 'sva-studio-react');

const packageProbes: PackageProbe[] = [
  { name: 'vite', resolveFrom: workspaceRoot },
  { name: 'vitest', resolveFrom: workspaceRoot },
  { name: '@nx/vite', resolveFrom: workspaceRoot },
  { name: '@nx/vitest', resolveFrom: workspaceRoot },
  { name: '@vitejs/plugin-react', resolveFrom: appRoot },
  { name: '@tanstack/react-start', resolveFrom: appRoot },
  { name: '@tanstack/router-plugin', resolveFrom: appRoot },
  { name: 'nitro', resolveFrom: appRoot },
];

const mismatches: string[] = [];
const notes: string[] = [];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readExpectedNodeVersion(): string | null {
  if (!existsSync(nvmrcPath)) {
    return null;
  }

  const raw = readFileSync(nvmrcPath, 'utf8').trim();
  return raw.length > 0 ? raw : null;
}

function normalizeNodeMajor(version: string): string {
  return version.replace(/^v/, '').split('.')[0] ?? version;
}

function detectPnpmVersion(): string {
  return execFileSync('pnpm', ['--version'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  }).trim();
}

function readExpectedPnpmVersion(): string | null {
  const packageManager = packageJson.packageManager;
  if (!packageManager?.startsWith('pnpm@')) {
    return null;
  }

  return packageManager.slice('pnpm@'.length);
}

function findLockedVersion(packageName: string): string | null {
  const lockfile = readFileSync(lockfilePath, 'utf8');
  const pattern = new RegExp(
    `^ {2}'?${escapeRegExp(packageName)}@([^(':]+)`,
    'm',
  );
  const match = lockfile.match(pattern);
  return match?.[1] ?? null;
}

function findInstalledVersion(packageName: string, resolveFrom: string): string | null {
  try {
    const packageJsonSegments = [
      'node_modules',
      ...packageName.split('/'),
      'package.json',
    ];

    let currentDir = resolveFrom;
    while (true) {
      const directPackageJsonPath = path.join(currentDir, ...packageJsonSegments);
      if (existsSync(directPackageJsonPath)) {
        const installed = JSON.parse(
          readFileSync(directPackageJsonPath, 'utf8'),
        ) as {
          name?: string;
          version?: string;
        };

        if (installed.name === packageName) {
          return installed.version ?? null;
        }
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    const resolvedEntryPath = requireFromHere.resolve(packageName, {
      paths: [resolveFrom],
    });

    let entryDir = path.dirname(resolvedEntryPath);
    while (true) {
      const packageJsonPath = path.join(entryDir, 'package.json');
      if (existsSync(packageJsonPath)) {
        const installed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
          name?: string;
          version?: string;
        };

        if (installed.name === packageName) {
          return installed.version ?? null;
        }
      }

      const parentDir = path.dirname(entryDir);
      if (parentDir === entryDir) {
        break;
      }
      entryDir = parentDir;
    }

    return null;
  } catch {
    return null;
  }
}

const expectedNodeVersion = readExpectedNodeVersion();
if (expectedNodeVersion) {
  const expectedMajor = normalizeNodeMajor(expectedNodeVersion);
  const actualMajor = normalizeNodeMajor(process.version);
  if (expectedMajor !== actualMajor) {
    mismatches.push(
      `Node-Version stimmt nicht mit .nvmrc ueberein: erwartet ${expectedMajor}, aktiv ${actualMajor} (${process.version}) via ${process.execPath}.`,
    );
  } else {
    notes.push(`Node ${process.version} passt zu .nvmrc (${expectedNodeVersion}).`);
  }
}

const expectedPnpmVersion = readExpectedPnpmVersion();
const actualPnpmVersion = detectPnpmVersion();
if (expectedPnpmVersion && actualPnpmVersion !== expectedPnpmVersion) {
  mismatches.push(
    `pnpm-Version stimmt nicht mit packageManager ueberein: erwartet ${expectedPnpmVersion}, aktiv ${actualPnpmVersion}.`,
  );
} else if (expectedPnpmVersion) {
  notes.push(`pnpm ${actualPnpmVersion} passt zu packageManager (${expectedPnpmVersion}).`);
}

for (const probe of packageProbes) {
  const lockedVersion = findLockedVersion(probe.name);
  const installedVersion = findInstalledVersion(probe.name, probe.resolveFrom);

  if (!lockedVersion) {
    mismatches.push(
      `Lockfile-Version fuer ${probe.name} konnte nicht ermittelt werden.`,
    );
    continue;
  }

  if (!installedVersion) {
    mismatches.push(
      `${probe.name} ist relativ zu ${path.relative(workspaceRoot, probe.resolveFrom) || '.'} nicht installiert.`,
    );
    continue;
  }

  if (installedVersion !== lockedVersion) {
    mismatches.push(
      `${probe.name} weicht vom Lockfile ab: installiert ${installedVersion}, Lockfile ${lockedVersion}.`,
    );
    continue;
  }

  notes.push(`${probe.name} ${installedVersion} entspricht dem Lockfile.`);
}

if (mismatches.length > 0) {
  console.error('Toolchain-Konsistenzpruefung fehlgeschlagen.');
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`);
  }
  console.error('');
  console.error(
    'Abhilfe: `pnpm install --frozen-lockfile` im Workspace ausfuehren und danach den Verify erneut starten.',
  );
  process.exit(1);
}

console.log('Toolchain-Konsistenzpruefung erfolgreich.');
for (const note of notes) {
  console.log(`- ${note}`);
}
