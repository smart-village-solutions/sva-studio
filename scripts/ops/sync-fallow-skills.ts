import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, posix, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type SyncFallowSkillSnapshotOptions = {
  packageRoot: string;
  repoRoot: string;
};

type SyncFallowSkillSnapshotResult = {
  sourceDir: string;
  sourceVersion: string;
  targetDir: string;
};

const FALLOW_PACKAGE_NAME = 'fallow';
const FALLOW_SKILL_RELATIVE_PATH = join('node_modules', FALLOW_PACKAGE_NAME, 'skills', 'fallow');
const FALLOW_SKILL_SOURCE_RELATIVE_PATH = posix.join('node_modules', FALLOW_PACKAGE_NAME, 'skills', 'fallow');
const FALLOW_PACKAGE_JSON_RELATIVE_PATH = join('node_modules', FALLOW_PACKAGE_NAME, 'package.json');
const TARGET_SKILL_RELATIVE_PATH = join('.agents', 'skills', 'fallow');
const UPSTREAM_METADATA_FILENAME = '.upstream.json';

const readSourceVersion = (packageRoot: string): string => {
  const packageJsonPath = join(packageRoot, FALLOW_PACKAGE_JSON_RELATIVE_PATH);
  const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonContent) as { version?: string };

  if (!packageJson.version) {
    throw new Error(`Missing version in ${packageJsonPath}`);
  }

  return packageJson.version;
};

export const syncFallowSkillSnapshot = (
  options: SyncFallowSkillSnapshotOptions,
): SyncFallowSkillSnapshotResult => {
  const packageRoot = resolve(options.packageRoot);
  const repoRoot = resolve(options.repoRoot);
  const sourceDir = join(packageRoot, FALLOW_SKILL_RELATIVE_PATH);

  if (!existsSync(sourceDir)) {
    throw new Error(`Bundled Fallow skill source not found: ${sourceDir}`);
  }

  const targetDir = join(repoRoot, TARGET_SKILL_RELATIVE_PATH);
  const sourceVersion = readSourceVersion(packageRoot);

  rmSync(targetDir, { force: true, recursive: true });
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });

  writeFileSync(
    join(targetDir, UPSTREAM_METADATA_FILENAME),
    `${JSON.stringify(
      {
        packageName: FALLOW_PACKAGE_NAME,
        sourceRelativePath: FALLOW_SKILL_SOURCE_RELATIVE_PATH,
        sourceVersion,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return {
    sourceDir,
    sourceVersion,
    targetDir,
  };
};

const runCli = (): void => {
  const result = syncFallowSkillSnapshot({
    packageRoot: process.cwd(),
    repoRoot: process.cwd(),
  });

  process.stdout.write(
    `Synced Fallow skill ${result.sourceVersion} to ${relative(process.cwd(), result.targetDir) || '.'}\n`,
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
