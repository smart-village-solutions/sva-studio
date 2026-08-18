import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { buildAppE2EEvidence } from './app-e2e-evidence.ts';
import { PromoteContractError } from './promote-result.ts';
import {
  runMainE2EPreflight,
  selectCanonicalMainRun,
  selectEvidenceArtifact,
  selectEvidenceJsonFile,
  verifyMainE2EEvidence,
  type MainE2EVerifierDependencies,
  type MainE2EWorkflowRun,
} from './verify-main-e2e-evidence.ts';

const headSha = 'a'.repeat(40);
const run = {
  id: 123,
  run_attempt: 2,
  path: '.github/workflows/app-e2e.yml',
  event: 'push',
  head_branch: 'main',
  head_sha: headSha,
  status: 'completed',
  conclusion: 'success',
} satisfies MainE2EWorkflowRun;
const evidence = buildAppE2EEvidence({
  workflow: 'App E2E',
  event: 'push',
  ref: 'refs/heads/main',
  branch: 'main',
  headSha,
  runId: '123',
  runAttempt: 2,
  result: 'success',
  testOutcome: 'success',
});

const dependencies = (
  overrides: Partial<MainE2EVerifierDependencies> = {}
): MainE2EVerifierDependencies => ({
  readWorkflowRuns: () => ({ workflow_runs: [run] }),
  readWorkflowRun: () => run,
  readRunArtifacts: () => ({
    artifacts: [
      {
        id: 987,
        name: 'app-e2e-evidence-123-2',
        expired: false,
        workflow_run: { id: 123, head_sha: headSha },
      },
    ],
  }),
  readArtifactArchive: () => ({
    entries: ['app-e2e-evidence-123-2.json'],
    readText: () => JSON.stringify(evidence),
  }),
  ...overrides,
});

const failureCode = (operation: () => unknown): string => {
  try {
    operation();
    return 'none';
  } catch (error) {
    expect(error).toBeInstanceOf(PromoteContractError);
    return (error as PromoteContractError).failure.code;
  }
};

describe('canonical Main App E2E preflight', () => {
  it('accepts one terminal successful canonical run and its exact allowlisted evidence', () => {
    expect(verifyMainE2EEvidence(headSha, dependencies())).toEqual(evidence);
  });

  it('paginates workflow runs until it finds the exact head SHA', () => {
    const foreignRuns = Array.from({ length: 100 }, (_, index) => ({
      ...run,
      id: 1_000 + index,
      head_sha: 'b'.repeat(40),
    }));
    const readWorkflowRuns = vi.fn((page: number) =>
      page === 1
        ? { workflow_runs: foreignRuns, total_count: 101 }
        : { workflow_runs: [run], total_count: 101 }
    );
    expect(verifyMainE2EEvidence(headSha, dependencies({ readWorkflowRuns }))).toEqual(evidence);
    expect(readWorkflowRuns).toHaveBeenCalledWith(2);
  });

  it('uses the latest attempt of one run identity', () => {
    expect(selectCanonicalMainRun([{ ...run, run_attempt: 1 }, run], headSha)).toEqual(run);
  });

  it('ignores a diagnostic run when one exact canonical push run exists', () => {
    expect(
      selectCanonicalMainRun([{ ...run, id: 124, event: 'schedule', run_attempt: 1 }, run], headSha)
    ).toEqual(run);
  });

  it.each([
    ['missing', [], 'PROMOTE_MAIN_E2E_NOT_READY'],
    [
      'in progress',
      [{ ...run, status: 'in_progress', conclusion: null }],
      'PROMOTE_MAIN_E2E_NOT_READY',
    ],
    ['red', [{ ...run, conclusion: 'failure' }], 'PROMOTE_MAIN_E2E_REJECTED'],
    ['cancelled', [{ ...run, conclusion: 'cancelled' }], 'PROMOTE_MAIN_E2E_REJECTED'],
    ['manual', [{ ...run, event: 'workflow_dispatch' }], 'PROMOTE_MAIN_E2E_REJECTED'],
    ['nightly', [{ ...run, event: 'schedule' }], 'PROMOTE_MAIN_E2E_REJECTED'],
    ['PR', [{ ...run, event: 'pull_request' }], 'PROMOTE_MAIN_E2E_REJECTED'],
    ['foreign branch', [{ ...run, head_branch: 'feature/example' }], 'PROMOTE_MAIN_E2E_REJECTED'],
    [
      'foreign workflow',
      [{ ...run, path: '.github/workflows/other.yml' }],
      'PROMOTE_MAIN_E2E_REJECTED',
    ],
  ])('rejects %s run state fail-closed', (_, runs, code) => {
    expect(failureCode(() => selectCanonicalMainRun(runs, headSha))).toBe(code);
  });

  it('does not let an older green run mask a newer distinct red run for the same SHA', () => {
    expect(
      failureCode(() =>
        selectCanonicalMainRun(
          [run, { ...run, id: 124, run_attempt: 1, conclusion: 'failure' }],
          headSha
        )
      )
    ).toBe('PROMOTE_MAIN_E2E_REJECTED');
  });

  it('does not accept evidence for a foreign SHA', () => {
    expect(failureCode(() => selectCanonicalMainRun([run], 'b'.repeat(40)))).toBe(
      'PROMOTE_MAIN_E2E_NOT_READY'
    );
  });

  it.each([
    ['missing', [], 'PROMOTE_MAIN_E2E_NOT_READY'],
    [
      'expired',
      [
        {
          id: 987,
          name: 'app-e2e-evidence-123-2',
          expired: true,
          workflow_run: { id: 123, head_sha: headSha },
        },
      ],
      'PROMOTE_MAIN_E2E_NOT_READY',
    ],
    [
      'wrong attempt',
      [
        {
          id: 987,
          name: 'app-e2e-evidence-123-1',
          expired: false,
          workflow_run: { id: 123, head_sha: headSha },
        },
      ],
      'PROMOTE_MAIN_E2E_NOT_READY',
    ],
    [
      'ambiguous',
      [
        {
          id: 987,
          name: 'app-e2e-evidence-123-2',
          expired: false,
          workflow_run: { id: 123, head_sha: headSha },
        },
        {
          id: 988,
          name: 'app-e2e-evidence-123-2',
          expired: false,
          workflow_run: { id: 123, head_sha: headSha },
        },
      ],
      'PROMOTE_MAIN_E2E_REJECTED',
    ],
  ])('rejects %s artifact state', (_, artifacts, code) => {
    expect(
      failureCode(() => selectEvidenceArtifact(artifacts, run as Required<MainE2EWorkflowRun>))
    ).toBe(code);
  });

  it.each([
    ['nested path', ['nested/app-e2e-evidence-123-2.json']],
    ['wrong name', ['evidence.json']],
    ['multiple JSON files', ['app-e2e-evidence-123-2.json', 'extra.json']],
    ['no JSON', ['README.md']],
  ])('rejects an archive with %s', (_, entries) => {
    expect(
      failureCode(() => selectEvidenceJsonFile(entries, run as Required<MainE2EWorkflowRun>))
    ).toBe('PROMOTE_MAIN_E2E_REJECTED');
  });

  it.each([
    ['diagnostic evidence', { evidenceClass: 'diagnostic' }],
    ['red evidence', { result: 'failure', testOutcome: 'failure' }],
    ['foreign SHA evidence', { headSha: 'b'.repeat(40) }],
    ['wrong run evidence', { run: { id: '124', attempt: 2 } }],
    ['extra schema key', { unexpected: 'value' }],
  ])('rejects %s', (_, override) => {
    const candidate = { ...evidence, ...override };
    expect(
      failureCode(() =>
        verifyMainE2EEvidence(
          headSha,
          dependencies({
            readArtifactArchive: () => ({
              entries: ['app-e2e-evidence-123-2.json'],
              readText: () => JSON.stringify(candidate),
            }),
          })
        )
      )
    ).toBe('PROMOTE_MAIN_E2E_REJECTED');
  });

  it('rejects malformed JSON and a rerun race', () => {
    expect(
      failureCode(() =>
        verifyMainE2EEvidence(
          headSha,
          dependencies({
            readArtifactArchive: () => ({
              entries: ['app-e2e-evidence-123-2.json'],
              readText: () => '{',
            }),
          })
        )
      )
    ).toBe('PROMOTE_MAIN_E2E_REJECTED');
    expect(
      failureCode(() =>
        verifyMainE2EEvidence(
          headSha,
          dependencies({
            readWorkflowRun: () => ({
              ...run,
              run_attempt: 3,
              status: 'in_progress',
              conclusion: null,
            }),
          })
        )
      )
    ).toBe('PROMOTE_MAIN_E2E_NOT_READY');
  });

  it('rejects a newly appearing second canonical run identity during the race recheck', () => {
    let reads = 0;
    expect(
      failureCode(() =>
        verifyMainE2EEvidence(
          headSha,
          dependencies({
            readWorkflowRuns: () => {
              reads += 1;
              return {
                workflow_runs:
                  reads === 1
                    ? [run]
                    : [run, { ...run, id: 124, status: 'in_progress', conclusion: null }],
              };
            },
          })
        )
      )
    ).toBe('PROMOTE_MAIN_E2E_REJECTED');
  });

  it('maps unknown lookup errors to a static retryable failure without leaking diagnostics', () => {
    const directory = mkdtempSync(join(tmpdir(), 'main-e2e-preflight-'));
    const failurePath = join(directory, 'failure.json');
    const stderr = { write: vi.fn(() => true) };
    try {
      expect(
        runMainE2EPreflight(
          {
            EXPECTED_CHANGE_HEAD: headSha,
            GITHUB_REPOSITORY: 'example/repo',
            GITHUB_TOKEN: 'secret-token',
            PROMOTE_FAILURE_PATH: failurePath,
          },
          stderr,
          () =>
            dependencies({
              readWorkflowRuns: () => {
                throw new Error('person@example.test https://internal.example\nremote-log');
              },
            })
        )
      ).toBeNull();
      const serialized = `${readFileSync(failurePath, 'utf8')} ${stderr.write.mock.calls.flat().join(' ')}`;
      expect(serialized).toContain('PROMOTE_MAIN_E2E_LOOKUP_FAILED');
      expect(serialized).not.toMatch(
        /person@example\.test|internal\.example|remote-log|secret-token/u
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it('maps unexpected controller errors to PROMOTE_INTERNAL_ERROR', () => {
    const stderr = { write: vi.fn(() => true) };
    expect(
      runMainE2EPreflight(
        {
          EXPECTED_CHANGE_HEAD: headSha,
          GITHUB_REPOSITORY: 'example/repo',
          GITHUB_TOKEN: 'token',
        },
        stderr,
        () => {
          throw new Error('unexpected controller failure');
        }
      )
    ).toBeNull();
    expect(stderr.write).toHaveBeenCalledWith(expect.stringContaining('PROMOTE_INTERNAL_ERROR'));
  });
});
