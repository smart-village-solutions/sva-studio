import { spawnSync } from 'node:child_process';

import type { GhCommandResult, GhExecutor, PullRequestRef, PullRequestSummary } from './pr-review-intake.types.js';

export const createGhExecutor = (): GhExecutor => {
  return (args, options) => {
    const result = spawnSync('gh', args, {
      cwd: process.cwd(),
      input: options?.input,
      maxBuffer: 16 * 1024 * 1024,
    });

    return {
      exitCode: result.status ?? 1,
      stdout: Buffer.from(result.stdout ?? []).toString('utf8'),
      stderr: Buffer.from(result.stderr ?? []).toString('utf8'),
      stdoutBytes: Buffer.from(result.stdout ?? []),
    };
  };
};

export const runGh = (executor: GhExecutor, args: readonly string[], options?: { input?: string }): GhCommandResult => {
  return executor(args, options);
};

export const runGhJson = <T>(executor: GhExecutor, args: readonly string[], options?: { input?: string }): T => {
  const result = runGh(executor, args, options);
  if (result.exitCode !== 0) {
    throw new Error((result.stderr || result.stdout || `gh ${args.join(' ')} fehlgeschlagen`).trim());
  }

  try {
    return JSON.parse(result.stdout) as T;
  } catch (error) {
    throw new Error(
      `JSON-Antwort von gh konnte nicht geparst werden (${args.join(' ')}): ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const parseRepoSlug = (slug: string): { owner: string; repo: string } => {
  const [owner, repo] = slug.split('/');
  if (!owner || !repo || slug.split('/').length !== 2) {
    throw new Error(`Ungültiges Repository-Slug: ${slug}`);
  }
  return { owner, repo };
};

const parsePullRequestUrl = (url: string): { owner: string; repo: string; number: number } => {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/.*)?$/u.exec(url.trim());
  if (!match) {
    throw new Error(`PR-URL konnte nicht ausgewertet werden: ${url}`);
  }

  return {
    owner: match[1],
    repo: match[2],
    number: Number.parseInt(match[3], 10),
  };
};

export const ensureGhAuthenticated = (executor: GhExecutor): void => {
  const result = runGh(executor, ['auth', 'status']);
  if (result.exitCode !== 0) {
    throw new Error((result.stderr || result.stdout || 'gh auth status fehlgeschlagen').trim());
  }
};

export const resolvePullRequestRef = (
  options: { repo?: string; pullRequestNumber?: number },
  executor: GhExecutor
): PullRequestRef => {
  if (options.repo && options.pullRequestNumber) {
    const { owner, repo } = parseRepoSlug(options.repo);
    return { owner, repo, number: options.pullRequestNumber, source: 'explicit' };
  }

  const current = runGhJson<{ number: number; url: string }>(executor, ['pr', 'view', '--json', 'number,url']);
  const parsed = parsePullRequestUrl(current.url);
  return { owner: parsed.owner, repo: parsed.repo, number: current.number, source: 'branch' };
};

export const fetchPullRequestSummary = (ref: PullRequestRef, executor: GhExecutor): PullRequestSummary => {
  const fields = [
    'number',
    'title',
    'url',
    'state',
    'isDraft',
    'headRefName',
    'baseRefName',
    'author',
    'reviewDecision',
    'mergeable',
    'changedFiles',
    'additions',
    'deletions',
  ];
  const repoSlug = `${ref.owner}/${ref.repo}`;
  const data = runGhJson<{
    number: number;
    title: string;
    url: string;
    state: string;
    isDraft: boolean;
    headRefName: string;
    baseRefName: string;
    reviewDecision: string | null;
    mergeable: string | null;
    changedFiles: number;
    additions: number;
    deletions: number;
    author?: { login?: string | null } | null;
  }>(executor, ['pr', 'view', String(ref.number), '--repo', repoSlug, '--json', fields.join(',')]);

  return {
    ...data,
    authorLogin: data.author?.login ?? null,
    source: ref.source,
  };
};
