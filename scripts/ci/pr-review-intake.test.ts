import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeCheckRecord, fetchChecks } from './pr-review-intake.checks.ts';
import { executePrReviewIntake, runPrReviewIntake } from './pr-review-intake.ts';
import { ensureGhAuthenticated, fetchPullRequestSummary, resolvePullRequestRef, runGhJson } from './pr-review-intake.gh.ts';
import { fetchReviewThreads } from './pr-review-intake.threads.ts';
import { buildSnapshotSummary, extractFailureSnippet, extractJobId, extractRunId, parseAvailableFields, parseCliOptions } from './pr-review-intake.utils.ts';
import type { GhExecutor } from './pr-review-intake.types.ts';

const fixturePath = (...parts: string[]): string =>
  path.join(process.cwd(), 'scripts/ci/fixtures/pr-review-intake', ...parts);

const readJsonFixture = <T>(filename: string): T =>
  JSON.parse(readFileSync(fixturePath(filename), 'utf8')) as T;

const readTextFixture = (filename: string): string => readFileSync(fixturePath(filename), 'utf8');

interface ScriptedResponse {
  match: (args: readonly string[]) => boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  stdoutBytes?: Buffer;
}

const createExecutor = (responses: readonly ScriptedResponse[]): GhExecutor => {
  return (args) => {
    const response = responses.find((candidate) => candidate.match(args));
    if (!response) {
      throw new Error(`Kein Fixture-Match für gh ${args.join(' ')}`);
    }
    const stdout = response.stdout ?? '';
    return {
      exitCode: response.exitCode ?? 0,
      stdout,
      stderr: response.stderr ?? '',
      stdoutBytes: response.stdoutBytes ?? Buffer.from(stdout),
    };
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pr-review-intake', () => {
  it('priorisiert explizites repo/pr vor Branch-Fallback', () => {
    const options = parseCliOptions(['snapshot', '--repo', 'smart-village-solutions/sva-studio', '--pr', '602', '--json']);

    expect(options).toMatchObject({
      command: 'snapshot',
      repo: 'smart-village-solutions/sva-studio',
      pullRequestNumber: 602,
      json: true,
    });
  });

  it('parst max-lines und context explizit', () => {
    expect(parseCliOptions(['checks', '--repo', 'smart-village-solutions/sva-studio', '--pr', '602', '--max-lines', '50', '--context', '12'])).toMatchObject({
      maxLines: 50,
      context: 12,
    });
  });

  it('weist fehlerhafte CLI-Argumente zurück', () => {
    expect(() => parseCliOptions(['foo'])).toThrow(/Subcommand/);
    expect(() => parseCliOptions(['snapshot', '--repo', 'smart-village-solutions/sva-studio'])).toThrow(/gemeinsam gesetzt/);
    expect(() => parseCliOptions(['snapshot', '--pr', 'abc'])).toThrow(/Ungültiger Wert/);
    expect(() => parseCliOptions(['snapshot', '--unknown'])).toThrow(/Unbekanntes Argument/);
  });

  it('wertet gh pr checks mit Feld-Drift über Fallback-Felder aus', () => {
    const executor = createExecutor([
      {
        match: (args) => args.join(' ') === 'auth status',
      },
      {
        match: (args) => args.join(' ') === 'pr view --json number,url',
        stdout: JSON.stringify(readJsonFixture('branch-pr-view.json')),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'pr view 602 --repo smart-village-solutions/sva-studio --json number,title,url,state,isDraft,headRefName,baseRefName,author,reviewDecision,mergeable,changedFiles,additions,deletions',
        stdout: JSON.stringify(readJsonFixture('pr-summary.json')),
      },
      {
        match: (args) => args[0] === 'api' && args[1] === 'graphql',
        stdout: JSON.stringify(readJsonFixture('review-threads-page-1.json')),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'pr checks 602 --repo smart-village-solutions/sva-studio --json name,state,conclusion,detailsUrl,startedAt,completedAt',
        exitCode: 1,
        stderr: readTextFixture('pr-checks-primary-error.txt'),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'pr checks 602 --repo smart-village-solutions/sva-studio --json name,state,bucket,link,startedAt,completedAt,workflow',
        stdout: JSON.stringify(readJsonFixture('pr-checks-fallback.json')),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'run view 201 --repo smart-village-solutions/sva-studio --json conclusion,status,workflowName,name,event,headBranch,headSha,url',
        stdout: JSON.stringify(readJsonFixture('run-metadata-201.json')),
      },
      {
        match: (args) => args.join(' ') === 'run view 201 --repo smart-village-solutions/sva-studio --log',
        stdout: readTextFixture('run-log-201.txt'),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'run view 202 --repo smart-village-solutions/sva-studio --json conclusion,status,workflowName,name,event,headBranch,headSha,url',
        stdout: JSON.stringify(readJsonFixture('run-metadata-202.json')),
      },
    ]);

    const options = parseCliOptions(['snapshot', '--json']);
    const ref = resolvePullRequestRef(options, executor);
    const snapshot = {
      pr: fetchPullRequestSummary(ref, executor),
      reviewThreads: fetchReviewThreads(ref, executor),
      checks: fetchChecks(ref, executor, options),
    };

    expect(buildSnapshotSummary(snapshot)).toEqual({
      openThreads: 1,
      resolvedThreads: 1,
      failingChecks: 1,
      pendingChecks: 1,
      hasBlockers: true,
    });
    expect(snapshot.checks.failing[0]).toMatchObject({
      name: 'Quality Gates / Types',
      analysisStatus: 'ok',
      runId: '201',
      jobId: '301',
    });
    expect(snapshot.checks.pending[0]).toMatchObject({
      name: 'Quality Gates / Unit',
      analysisStatus: 'pending',
      runId: '202',
      jobId: '302',
    });
  });

  it('klassifiziert failing, pending und externe Checks robust', () => {
    expect(
      normalizeCheckRecord({
        name: 'Fail',
        state: 'COMPLETED',
        conclusion: 'FAILURE',
        detailsUrl: 'https://github.com/org/repo/actions/runs/1/job/2',
      }).health
    ).toBe('failing');

    expect(
      normalizeCheckRecord({
        name: 'Pending',
        state: 'IN_PROGRESS',
        detailsUrl: 'https://github.com/org/repo/actions/runs/1/job/2',
      }).health
    ).toBe('pending');

    expect(
      normalizeCheckRecord({
        name: 'External',
        bucket: 'fail',
        link: 'https://buildkite.example.test/builds/1',
      })
    ).toMatchObject({
      health: 'failing',
      runId: null,
      jobId: null,
    });
  });

  it('liefert aussagekräftige Defaults für Extractor-Helfer', () => {
    expect(extractRunId('')).toBeNull();
    expect(extractJobId('')).toBeNull();
    expect(extractFailureSnippet('', 5, 2)).toBe('');
    expect(extractFailureSnippet('all good\nstill good', 5, 2)).toContain('still good');
    expect(parseAvailableFields('plain error')).toEqual([]);
  });

  it('extrahiert Run-/Job-IDs und fokussierte Failure-Snippets', () => {
    expect(extractRunId('https://github.com/org/repo/actions/runs/201/job/301')).toBe('201');
    expect(extractJobId('https://github.com/org/repo/actions/runs/201/job/301')).toBe('301');

    const snippet = extractFailureSnippet(readTextFixture('run-log-201.txt'), 5, 2);
    expect(snippet).toContain('Error: Type mismatch in route loader');
    expect(snippet.split('\n').length).toBeLessThanOrEqual(5);
  });

  it('normalisiert offene und resolved Review-Threads aus GraphQL-Fixtures', () => {
    const executor = createExecutor([
      {
        match: (args) => args.join(' ') === 'auth status',
      },
      {
        match: (args) => args.join(' ') === 'pr view --json number,url',
        stdout: JSON.stringify(readJsonFixture('branch-pr-view.json')),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'pr view 602 --repo smart-village-solutions/sva-studio --json number,title,url,state,isDraft,headRefName,baseRefName,author,reviewDecision,mergeable,changedFiles,additions,deletions',
        stdout: JSON.stringify(readJsonFixture('pr-summary.json')),
      },
      {
        match: (args) => args[0] === 'api' && args[1] === 'graphql',
        stdout: JSON.stringify(readJsonFixture('review-threads-page-1.json')),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'pr checks 602 --repo smart-village-solutions/sva-studio --json name,state,conclusion,detailsUrl,startedAt,completedAt',
        stdout: '[]',
      },
    ]);

    const options = parseCliOptions(['snapshot']);
    const ref = resolvePullRequestRef(options, executor);
    const snapshot = {
      pr: fetchPullRequestSummary(ref, executor),
      reviewThreads: fetchReviewThreads(ref, executor),
      checks: fetchChecks(ref, executor, options),
    };

    expect(snapshot.reviewThreads.open).toHaveLength(1);
    expect(snapshot.reviewThreads.resolved).toHaveLength(1);
    expect(snapshot.reviewThreads.open[0]).toMatchObject({
      path: 'packages/data/src/query.ts',
      line: 42,
      commentCount: 2,
    });
  });

  it('unterstützt explizite PR-Resolution und validiert Repo-Slugs', () => {
    const executor = createExecutor([]);
    expect(resolvePullRequestRef({ repo: 'smart-village-solutions/sva-studio', pullRequestNumber: 602 }, executor)).toMatchObject({
      owner: 'smart-village-solutions',
      repo: 'sva-studio',
      number: 602,
      source: 'explicit',
    });
    expect(() => resolvePullRequestRef({ repo: 'broken-slug', pullRequestNumber: 602 }, executor)).toThrow(/Ungültiges Repository-Slug/);
  });

  it('meldet Auth- und JSON-Fehler aus gh klar zurück', () => {
    const authExecutor = createExecutor([
      {
        match: (args) => args.join(' ') === 'auth status',
        exitCode: 1,
        stderr: 'gh auth login erforderlich',
      },
    ]);
    expect(() => ensureGhAuthenticated(authExecutor)).toThrow(/gh auth login erforderlich/);

    const jsonExecutor = createExecutor([
      {
        match: () => true,
        stdout: 'not-json',
      },
    ]);
    expect(() => runGhJson(jsonExecutor, ['pr', 'view'])).toThrow(/nicht geparst/);
  });

  it('behandelt PR-Metadaten ohne Autor robust', () => {
    const executor = createExecutor([
      {
        match: (args) =>
          args.join(' ') ===
          'pr view 602 --repo smart-village-solutions/sva-studio --json number,title,url,state,isDraft,headRefName,baseRefName,author,reviewDecision,mergeable,changedFiles,additions,deletions',
        stdout: JSON.stringify({
          ...readJsonFixture<Record<string, unknown>>('pr-summary.json'),
          author: null,
        }),
      },
    ]);

    expect(
      fetchPullRequestSummary(
        { owner: 'smart-village-solutions', repo: 'sva-studio', number: 602, source: 'explicit' },
        executor
      ).authorLogin
    ).toBeNull();
  });

  it('unterstützt paginierte Threads und meldet GraphQL-Fehler', () => {
    const pagedExecutor = createExecutor([
      {
        match: (args) => args[0] === 'api' && args[1] === 'graphql' && !args.includes('cursor=page-2'),
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  pageInfo: { hasNextPage: true, endCursor: 'page-2' },
                  nodes: [
                    {
                      id: 't1',
                      isResolved: false,
                      isOutdated: false,
                      path: 'a.ts',
                      line: 1,
                      originalLine: 1,
                      comments: { nodes: [{ id: 'c1', body: 'open', createdAt: '2026-06-18T00:00:00Z', url: 'u1', author: { login: 'bot' } }] },
                    },
                  ],
                },
              },
            },
          },
        }),
      },
      {
        match: (args) => args[0] === 'api' && args[1] === 'graphql' && args.includes('cursor=page-2'),
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      id: 't2',
                      isResolved: true,
                      isOutdated: false,
                      path: 'b.ts',
                      line: 2,
                      originalLine: 2,
                      comments: { nodes: [{ id: 'c2', body: 'done', createdAt: '2026-06-18T00:00:00Z', url: 'u2', author: { login: 'bot' } }] },
                    },
                  ],
                },
              },
            },
          },
        }),
      },
    ]);

    const threads = fetchReviewThreads(
      { owner: 'smart-village-solutions', repo: 'sva-studio', number: 602, source: 'explicit' },
      pagedExecutor
    );
    expect(threads.open).toHaveLength(1);
    expect(threads.resolved).toHaveLength(1);

    const errorExecutor = createExecutor([
      {
        match: () => true,
        stdout: JSON.stringify({ errors: [{ message: 'boom' }] }),
      },
    ]);
    expect(() =>
      fetchReviewThreads({ owner: 'smart-village-solutions', repo: 'sva-studio', number: 602, source: 'explicit' }, errorExecutor)
    ).toThrow(/GraphQL meldet Fehler/);
  });

  it('liefert Exit-Code 2 bei Nutzungs- oder Auth-Fehlern', () => {
    const executor = createExecutor([
      {
        match: (args) => args.join(' ') === 'auth status',
        exitCode: 1,
        stderr: 'gh auth login erforderlich',
      },
    ]);

    const result = executePrReviewIntake(['snapshot'], { executor });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('gh auth login erforderlich');
  });

  it('parst verfügbare gh pr checks Felder aus Fehlermeldungen', () => {
    expect(parseAvailableFields(readTextFixture('pr-checks-primary-error.txt'))).toEqual([
      'name',
      'state',
      'bucket',
      'link',
      'startedAt',
      'completedAt',
      'workflow',
    ]);
  });

  it('liefert JSON-Output und Blocker-Exit-Code für snapshot', () => {
    const executor = createExecutor([
      { match: (args) => args.join(' ') === 'auth status' },
      {
        match: (args) => args.join(' ') === 'pr view --json number,url',
        stdout: JSON.stringify(readJsonFixture('branch-pr-view.json')),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'pr view 602 --repo smart-village-solutions/sva-studio --json number,title,url,state,isDraft,headRefName,baseRefName,author,reviewDecision,mergeable,changedFiles,additions,deletions',
        stdout: JSON.stringify(readJsonFixture('pr-summary.json')),
      },
      {
        match: (args) => args[0] === 'api' && args[1] === 'graphql',
        stdout: JSON.stringify(readJsonFixture('review-threads-page-1.json')),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'pr checks 602 --repo smart-village-solutions/sva-studio --json name,state,conclusion,detailsUrl,startedAt,completedAt',
        stdout: '[]',
      },
    ]);

    const result = executePrReviewIntake(['snapshot', '--json'], { executor });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      summary: {
        openThreads: 1,
        failingChecks: 0,
      },
    });
  });

  it('liefert Plain-Text für threads und checks', () => {
    const executor = createExecutor([
      { match: (args) => args.join(' ') === 'auth status' },
      {
        match: (args) =>
          args.join(' ') ===
          'pr view 602 --repo smart-village-solutions/sva-studio --json number,title,url,state,isDraft,headRefName,baseRefName,author,reviewDecision,mergeable,changedFiles,additions,deletions',
        stdout: JSON.stringify(readJsonFixture('pr-summary.json')),
      },
      {
        match: (args) => args[0] === 'api' && args[1] === 'graphql',
        stdout: JSON.stringify(readJsonFixture('review-threads-page-1.json')),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'pr checks 602 --repo smart-village-solutions/sva-studio --json name,state,conclusion,detailsUrl,startedAt,completedAt',
        stdout: JSON.stringify([
          {
            name: 'External Provider',
            state: 'COMPLETED',
            conclusion: 'FAILURE',
            detailsUrl: 'https://example.test/buildkite/123',
            startedAt: '2026-06-18T10:00:00Z',
            completedAt: '2026-06-18T10:05:00Z',
          },
        ]),
      },
    ]);

    const threads = executePrReviewIntake(['threads', '--repo', 'smart-village-solutions/sva-studio', '--pr', '602'], { executor });
    expect(threads.exitCode).toBe(1);
    expect(threads.stdout).toContain('Offene Review-Threads: 1');

    const checks = executePrReviewIntake(['checks', '--repo', 'smart-village-solutions/sva-studio', '--pr', '602'], { executor });
    expect(checks.exitCode).toBe(1);
    expect(checks.stdout).toContain('Failing Checks: 1');
  });

  it('deckt externe, pending-log und job-log-Fehlerpfade bei Checks ab', () => {
    const baseRef = { owner: 'smart-village-solutions', repo: 'sva-studio', number: 602, source: 'explicit' } as const;

    const externalExecutor = createExecutor([
      {
        match: (args) =>
          args.join(' ') ===
          'pr checks 602 --repo smart-village-solutions/sva-studio --json name,state,conclusion,detailsUrl,startedAt,completedAt',
        stdout: JSON.stringify([
          {
            name: 'External',
            state: 'COMPLETED',
            conclusion: 'FAILURE',
            detailsUrl: 'https://buildkite.example.test/1',
            startedAt: '2026-06-18T10:00:00Z',
            completedAt: '2026-06-18T10:01:00Z',
          },
        ]),
      },
    ]);
    expect(fetchChecks(baseRef, externalExecutor, { maxLines: 20, context: 5 }).failing[0]).toMatchObject({
      analysisStatus: 'external',
    });

    const pendingExecutor = createExecutor([
      {
        match: (args) =>
          args.join(' ') ===
          'pr checks 602 --repo smart-village-solutions/sva-studio --json name,state,conclusion,detailsUrl,startedAt,completedAt',
        stdout: JSON.stringify([
          {
            name: 'Types',
            state: 'COMPLETED',
            conclusion: 'FAILURE',
            detailsUrl: 'https://github.com/smart-village-solutions/sva-studio/actions/runs/201/job/301',
            startedAt: '2026-06-18T10:00:00Z',
            completedAt: '2026-06-18T10:01:00Z',
          },
        ]),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'run view 201 --repo smart-village-solutions/sva-studio --json conclusion,status,workflowName,name,event,headBranch,headSha,url',
        stdout: JSON.stringify(readJsonFixture('run-metadata-201.json')),
      },
      {
        match: (args) => args.join(' ') === 'run view 201 --repo smart-village-solutions/sva-studio --log',
        exitCode: 1,
        stderr: 'Log will be available when it is complete',
      },
      {
        match: (args) => args.join(' ') === 'api /repos/smart-village-solutions/sva-studio/actions/jobs/301/logs',
        exitCode: 1,
        stderr: 'still in progress',
      },
    ]);
    expect(fetchChecks(baseRef, pendingExecutor, { maxLines: 20, context: 5 }).failing[0]).toMatchObject({
      analysisStatus: 'log_pending',
    });

    const zipExecutor = createExecutor([
      {
        match: (args) =>
          args.join(' ') ===
          'pr checks 602 --repo smart-village-solutions/sva-studio --json name,state,conclusion,detailsUrl,startedAt,completedAt',
        stdout: JSON.stringify([
          {
            name: 'Types',
            state: 'COMPLETED',
            conclusion: 'FAILURE',
            detailsUrl: 'https://github.com/smart-village-solutions/sva-studio/actions/runs/201/job/301',
            startedAt: '2026-06-18T10:00:00Z',
            completedAt: '2026-06-18T10:01:00Z',
          },
        ]),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'run view 201 --repo smart-village-solutions/sva-studio --json conclusion,status,workflowName,name,event,headBranch,headSha,url',
        stdout: JSON.stringify(readJsonFixture('run-metadata-201.json')),
      },
      {
        match: (args) => args.join(' ') === 'run view 201 --repo smart-village-solutions/sva-studio --log',
        exitCode: 1,
        stderr: 'Log will be available when it is complete',
      },
      {
        match: (args) => args.join(' ') === 'api /repos/smart-village-solutions/sva-studio/actions/jobs/301/logs',
        stdoutBytes: Buffer.from('PKzipdata'),
      },
    ]);
    expect(fetchChecks(baseRef, zipExecutor, { maxLines: 20, context: 5 }).failing[0]).toMatchObject({
      analysisStatus: 'log_unavailable',
    });
  });

  it('deckt die Terminal-Hülle des CLI ab', () => {
    const executor = createExecutor([
      { match: (args) => args.join(' ') === 'auth status' },
      {
        match: (args) => args.join(' ') === 'pr view --json number,url',
        stdout: JSON.stringify(readJsonFixture('branch-pr-view.json')),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'pr view 602 --repo smart-village-solutions/sva-studio --json number,title,url,state,isDraft,headRefName,baseRefName,author,reviewDecision,mergeable,changedFiles,additions,deletions',
        stdout: JSON.stringify(readJsonFixture('pr-summary.json')),
      },
      {
        match: (args) => args[0] === 'api' && args[1] === 'graphql',
        stdout: JSON.stringify(readJsonFixture('review-threads-page-1.json')),
      },
      {
        match: (args) =>
          args.join(' ') ===
          'pr checks 602 --repo smart-village-solutions/sva-studio --json name,state,conclusion,detailsUrl,startedAt,completedAt',
        stdout: '[]',
      },
    ]);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const exitCode = runPrReviewIntake(['snapshot'], { executor });

    expect(exitCode).toBe(1);
    expect(stdoutSpy).toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
