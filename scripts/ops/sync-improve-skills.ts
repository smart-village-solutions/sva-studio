// fallow-ignore-file code-duplication
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

type SyncImproveSkillSnapshotOptions = {
  repoRoot: string;
  sourceDir: string;
  sourceRevision: string;
};

type SyncImproveSkillSnapshotResult = {
  sourceDir: string;
  sourceRevision: string;
  targetDir: string;
};

const IMPROVE_REPOSITORY_URL = 'https://github.com/shadcn/improve.git';
const IMPROVE_SOURCE_REVISION = '03369ee6d7cafbfcecc4346539b05b3dc0a603bb';
const IMPROVE_SKILL_SOURCE_RELATIVE_PATH = posix.join('skills', 'improve');
const TARGET_SKILL_RELATIVE_PATH = join('.agents', 'skills', 'improve');
const UPSTREAM_METADATA_FILENAME = '.upstream.json';

export const syncImproveSkillSnapshot = (
  options: SyncImproveSkillSnapshotOptions,
): SyncImproveSkillSnapshotResult => {
  const repoRoot = resolve(options.repoRoot);
  const sourceDir = resolve(options.sourceDir);

  if (!existsSync(sourceDir)) {
    throw new Error(`Bundled improve skill source not found: ${sourceDir}`);
  }

  const targetDir = join(repoRoot, TARGET_SKILL_RELATIVE_PATH);

  rmSync(targetDir, { force: true, recursive: true });
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });

  writeFileSync(
    join(targetDir, UPSTREAM_METADATA_FILENAME),
    `${JSON.stringify(
      {
        repositoryUrl: IMPROVE_REPOSITORY_URL,
        sourceRelativePath: IMPROVE_SKILL_SOURCE_RELATIVE_PATH,
        sourceRevision: options.sourceRevision,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return {
    sourceDir,
    sourceRevision: options.sourceRevision,
    targetDir,
  };
};

const cloneImproveSkillSource = (): { checkoutRoot: string; sourceDir: string } => {
  const checkoutRoot = mkdtempSync(join(tmpdir(), 'improve-skill-sync-'));

  try {
    execFileSync('git', ['clone', IMPROVE_REPOSITORY_URL, checkoutRoot], {
      stdio: 'pipe',
    });
    execFileSync('git', ['checkout', IMPROVE_SOURCE_REVISION], {
      cwd: checkoutRoot,
      stdio: 'pipe',
    });
  } catch (error) {
    rmSync(checkoutRoot, { force: true, recursive: true });
    throw error;
  }

  return {
    checkoutRoot,
    sourceDir: join(checkoutRoot, IMPROVE_SKILL_SOURCE_RELATIVE_PATH),
  };
};

const runCli = (): void => {
  const { checkoutRoot, sourceDir } = cloneImproveSkillSource();

  try {
    const result = syncImproveSkillSnapshot({
      repoRoot: process.cwd(),
      sourceDir,
      sourceRevision: IMPROVE_SOURCE_REVISION,
    });

    process.stdout.write(
      `Synced improve skill ${result.sourceRevision} to ${relative(process.cwd(), result.targetDir) || '.'}\n`,
    );
  } finally {
    rmSync(checkoutRoot, { force: true, recursive: true });
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli();
}
