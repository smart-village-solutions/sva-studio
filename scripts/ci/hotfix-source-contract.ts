import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const shaPattern = /^[0-9a-f]{40}$/u;
const tagPattern = /^studio-v\d+\.\d+\.\d+$/u;
const branchPattern = /^refs\/heads\/hotfix\/[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export type HotfixSource = Readonly<{
  controllerSha: string;
  baseTag: string;
  branchRef: string;
  sourceSha: string;
}>;

export type HotfixSourceGit = Readonly<{
  remoteRef: (ref: string) => string;
  fetch: (branchRef: string, tagRef: string) => void;
  commit: (ref: string) => string;
  isAncestor: (baseSha: string, sourceSha: string) => boolean;
}>;

export const validateHotfixDispatch = (input: Readonly<{
  event: string;
  ref: string;
  controllerSha: string;
  workflowSha: string;
  baseTag: string;
  branchRef: string;
  sourceSha: string;
}>): HotfixSource => {
  if (input.event !== 'workflow_dispatch' || input.ref !== 'refs/heads/main' ||
      !shaPattern.test(input.controllerSha) || input.workflowSha !== input.controllerSha ||
      !tagPattern.test(input.baseTag) || !branchPattern.test(input.branchRef) ||
      !shaPattern.test(input.sourceSha)) {
    throw new Error('Ungültiger Hotfix-Dispatch des Main-Controllers.');
  }
  return {
    controllerSha: input.controllerSha,
    baseTag: input.baseTag,
    branchRef: input.branchRef,
    sourceSha: input.sourceSha,
  };
};

export const verifyHotfixSource = (source: HotfixSource, git: HotfixSourceGit): void => {
  const tagRef = `refs/tags/${source.baseTag}`;
  const peeledTagRef = `${tagRef}^{}`;
  const branchBefore = git.remoteRef(source.branchRef);
  const tagBefore = git.remoteRef(peeledTagRef);
  if (branchBefore !== source.sourceSha || !shaPattern.test(tagBefore) ||
      tagBefore === source.sourceSha) {
    throw new Error('Hotfix-Ref oder annotierter Production-Basistag stimmt nicht mit dem Quell-SHA überein.');
  }
  git.fetch(source.branchRef, tagRef);
  if (git.commit(source.sourceSha) !== source.sourceSha ||
      git.commit(tagRef) !== tagBefore ||
      !git.isAncestor(tagBefore, source.sourceSha) ||
      git.remoteRef(source.branchRef) !== branchBefore ||
      git.remoteRef(peeledTagRef) !== tagBefore) {
    throw new Error('Hotfix-Quellstand ist nicht unverändert vom Production-Basistag abgeleitet.');
  }
};

const gitCommand = (args: readonly string[]): string =>
  execFileSync('git', [...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const remoteRef = (ref: string): string => {
  const lines = gitCommand(['ls-remote', '--exit-code', 'origin', ref]).split('\n');
  if (lines.length !== 1) throw new Error('Git-Ref ist nicht eindeutig.');
  const [sha, actualRef] = lines[0]!.split('\t');
  if (actualRef !== ref || !shaPattern.test(sha ?? '')) throw new Error('Git-Ref stimmt nicht überein.');
  return sha!;
};

const cliGit: HotfixSourceGit = {
  remoteRef,
  fetch: (branchRef, tagRef) => {
    gitCommand(['fetch', '--no-tags', 'origin', branchRef, `${tagRef}:${tagRef}`]);
  },
  commit: (ref) => gitCommand(['rev-parse', '--verify', `${ref}^{commit}`]),
  isAncestor: (baseSha, sourceSha) =>
    spawnSync('git', ['merge-base', '--is-ancestor', baseSha, sourceSha], { stdio: 'ignore' }).status === 0,
};

export const runHotfixSourceContract = (env: NodeJS.ProcessEnv = process.env): HotfixSource => {
  const source = validateHotfixDispatch({
    event: env.GITHUB_EVENT_NAME ?? '',
    ref: env.GITHUB_REF ?? '',
    controllerSha: env.GITHUB_SHA ?? '',
    workflowSha: env.GITHUB_WORKFLOW_SHA ?? '',
    baseTag: env.HOTFIX_BASE_TAG ?? '',
    branchRef: env.HOTFIX_REF ?? '',
    sourceSha: env.HOTFIX_SHA ?? '',
  });
  verifyHotfixSource(source, cliGit);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `source_sha=${source.sourceSha}\n`, 'utf8');
  return source;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runHotfixSourceContract();
}
