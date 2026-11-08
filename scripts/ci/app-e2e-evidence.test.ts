import { mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildAppE2EEvidence,
  parseAppE2EEvidence,
  writeAppE2EEvidenceFromEnvironment,
  writeAppE2EShardEvidenceFromEnvironment,
  validateAppE2EShards,
} from './app-e2e-evidence.ts';

const sha = 'a'.repeat(40);
const hotfixSha = 'b'.repeat(40);
const hotfix = {
  controllerSha: sha,
  baseTag: 'studio-v0.10.4',
  ref: 'refs/heads/hotfix/studio-v0-10-5-changelog',
  sourceSha: hotfixSha,
};
const canonicalInput = {
  workflow: 'App E2E',
  event: 'push',
  ref: 'refs/heads/main',
  branch: 'main',
  headSha: sha,
  runId: '123',
  runAttempt: 1,
  result: 'success',
  testOutcome: 'success',
};

describe('App E2E evidence', () => {
  it('classifies only the canonical main push as canonical evidence', () => {
    const evidence = buildAppE2EEvidence(canonicalInput);
    expect(evidence).toMatchObject({
      evidenceClass: 'canonical-main',
      headSha: sha,
      result: 'success',
      testOutcome: 'success',
      subject: { kind: 'local-app-service-stack', containerArtifactVerified: false },
    });
  });

  it('strictly parses the canonical evidence schema without accepting contradictory fields', () => {
    const evidence = buildAppE2EEvidence(canonicalInput);
    expect(parseAppE2EEvidence(evidence)).toEqual(evidence);
    expect(parseAppE2EEvidence({ ...evidence, unexpected: 'value' })).toBeNull();
    expect(parseAppE2EEvidence({ ...evidence, evidenceClass: 'diagnostic' })).toBeNull();
    expect(parseAppE2EEvidence({ ...evidence, run: { ...evidence.run, id: 123 } })).toBeNull();
    expect(
      parseAppE2EEvidence({ ...evidence, subject: { ...evidence.subject, extra: true } })
    ).toBeNull();
  });

  it.each(['schedule', 'workflow_dispatch'] as const)(
    'keeps %s diagnostic even on main',
    (event) => {
      const evidence = buildAppE2EEvidence({ ...canonicalInput, event, runAttempt: 2 });
      expect(evidence).toMatchObject({ evidenceClass: 'diagnostic', run: { attempt: 2 } });
    }
  );

  it('keeps a manually dispatched tag diagnostic', () => {
    const evidence = buildAppE2EEvidence({
      ...canonicalInput,
      event: 'workflow_dispatch',
      ref: 'refs/tags/diagnostic-1',
      branch: 'diagnostic-1',
    });
    expect(evidence.evidenceClass).toBe('diagnostic');
  });

  it('keeps an unverified hotfix-like dispatch diagnostic', () => {
    const evidence = buildAppE2EEvidence({
      ...canonicalInput,
      event: 'workflow_dispatch',
      ref: 'refs/heads/hotfix/studio-v0.10.5-fix',
      branch: 'hotfix/studio-v0.10.5-fix',
    });
    expect(evidence.evidenceClass).toBe('diagnostic');
  });

  it('binds a controlled hotfix to controller, source, base tag and branch', () => {
    const evidence = buildAppE2EEvidence({
      ...canonicalInput,
      event: 'workflow_dispatch',
      headSha: hotfixSha,
      hotfix,
    });
    expect(evidence.evidenceClass).toBe('controlled-hotfix');
    expect(parseAppE2EEvidence(evidence)).toEqual(evidence);
    for (const invalid of [
      { hotfix: { ...hotfix, sourceSha: sha } },
      { hotfix: { ...hotfix, controllerSha: hotfixSha } },
      { hotfix: { ...hotfix, baseTag: 'studio-v0.11.0-beta.1' } },
      { hotfix: { ...hotfix, ref: 'refs/heads/feature/unrelated' } },
      { evidenceClass: 'diagnostic' },
    ])
      expect(parseAppE2EEvidence({ ...evidence, ...invalid })).toBeNull();
  });

  it('writes only validated controlled hotfix metadata from a Main dispatch', () => {
    const directory = mkdtempSync(join(tmpdir(), 'app-e2e-hotfix-'));
    try {
      const env = {
        GITHUB_WORKFLOW: 'App E2E',
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_REF: 'refs/heads/main',
        GITHUB_REF_NAME: 'main',
        GITHUB_SHA: sha,
        GITHUB_WORKFLOW_SHA: sha,
        GITHUB_RUN_ID: '789',
        GITHUB_RUN_ATTEMPT: '1',
        APP_E2E_RESULT: 'success',
        APP_E2E_TEST_OUTCOME: 'success',
        HOTFIX_MODE: 'hotfix',
        HOTFIX_SOURCE_SHA: hotfixSha,
        HOTFIX_BASE_TAG: hotfix.baseTag,
        HOTFIX_REF: hotfix.ref,
        RUNNER_TEMP: directory,
      };
      const evidence = parseAppE2EEvidence(
        JSON.parse(readFileSync(writeAppE2EEvidenceFromEnvironment(env), 'utf8'))
      );
      expect(evidence).toMatchObject({
        evidenceClass: 'controlled-hotfix',
        headSha: hotfixSha,
        hotfix,
      });
      expect(() =>
        writeAppE2EEvidenceFromEnvironment({ ...env, GITHUB_WORKFLOW_SHA: hotfixSha })
      ).toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps a deterministic test failure red after finalization', () => {
    const evidence = buildAppE2EEvidence({
      ...canonicalInput,
      result: 'failure',
      testOutcome: 'failure',
    });
    expect(evidence).toMatchObject({ result: 'failure', testOutcome: 'failure' });
  });

  it.each(['', 'skipped'])(
    'records a terminal failure with raw outcome %j only as test not run',
    (testOutcome) => {
      const evidence = buildAppE2EEvidence({
        ...canonicalInput,
        result: 'failure',
        testOutcome,
      });
      expect(evidence).toMatchObject({ result: 'failure', testOutcome: 'not-run' });
    }
  );

  it('preserves a successful test step when a later workflow step fails', () => {
    const evidence = buildAppE2EEvidence({
      ...canonicalInput,
      result: 'failure',
      testOutcome: 'success',
    });
    expect(evidence).toMatchObject({ result: 'failure', testOutcome: 'success' });
  });

  it('retains run identity and distinguishes a manual rerun attempt', () => {
    const first = buildAppE2EEvidence({
      ...canonicalInput,
      result: 'failure',
      testOutcome: '',
    });
    const rerun = buildAppE2EEvidence({ ...canonicalInput, runAttempt: 2 });
    expect(first.run).toEqual({ id: '123', attempt: 1 });
    expect(rerun.run).toEqual({ id: '123', attempt: 2 });
  });

  it('writes an allowlisted artifact without environment, PII, or secret diagnostics', () => {
    const directory = mkdtempSync(join(tmpdir(), 'app-e2e-evidence-'));
    try {
      const output = writeAppE2EEvidenceFromEnvironment({
        GITHUB_WORKFLOW: 'App E2E',
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF: 'refs/heads/main',
        GITHUB_REF_NAME: 'main',
        GITHUB_SHA: sha,
        GITHUB_RUN_ID: '456',
        GITHUB_RUN_ATTEMPT: '3',
        APP_E2E_RESULT: 'failure',
        APP_E2E_TEST_OUTCOME: 'failure',
        RUNNER_TEMP: directory,
        SECRET_VALUE: 'person@example.test https://internal.example remote-log secret-key=value',
      });
      const serialized = readFileSync(output, 'utf8');
      expect(Object.keys(JSON.parse(serialized))).toEqual([
        'schemaVersion',
        'workflow',
        'event',
        'ref',
        'branch',
        'headSha',
        'run',
        'result',
        'testOutcome',
        'evidenceClass',
        'subject',
      ]);
      expect(serialized).not.toMatch(
        /person@example\.test|internal\.example|remote-log|secret-key|SECRET_VALUE/u
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    { event: 'pull_request' },
    { ref: 'refs/heads/person@example.test' },
    { headSha: 'short' },
    { result: 'in_progress' },
    { testOutcome: 'unexpected' },
  ])('rejects invalid or unsafe evidence input', (override) => {
    expect(() => buildAppE2EEvidence({ ...canonicalInput, ...override })).toThrow();
  });

  it.each(['failure', 'cancelled', 'skipped', ''])(
    'rejects success with non-successful raw test outcome %j',
    (testOutcome) => {
      expect(() => buildAppE2EEvidence({ ...canonicalInput, testOutcome })).toThrow();
    }
  );

  it('rejects a failure result paired with a cancelled test step', () => {
    expect(() =>
      buildAppE2EEvidence({
        ...canonicalInput,
        result: 'failure',
        testOutcome: 'cancelled',
      })
    ).toThrow();
  });
});

describe('App E2E shard completeness', () => {
  const report = (ids: string[], status = 'passed') => ({
    suites: [
      {
        specs: [
          {
            id: 'setup',
            tests: [
              {
                projectName: 'auth-setup',
                expectedStatus: 'passed',
                results: [{ status: 'passed' }],
              },
            ],
          },
        ],
      },
      {
        specs: ids.map((id) => ({
          id,
          tests: [
            {
              projectName: 'chromium',
              expectedStatus: 'passed',
              results: [{ status }],
            },
          ],
        })),
      },
    ],
  });
  const withShards = (run: (directory: string) => void) => {
    const directory = mkdtempSync(join(tmpdir(), 'app-e2e-shards-'));
    const shards = join(directory, 'shards');
    try {
      const manifest = join(directory, 'manifest.json');
      const results = join(directory, 'results.json');
      writeFileSync(manifest, JSON.stringify(report(['a', 'b', 'c', 'd'])));
      for (let shard = 1; shard <= 4; shard += 1) {
        writeFileSync(results, JSON.stringify(report(['abcd'[shard - 1]])));
        writeAppE2EShardEvidenceFromEnvironment({
          APP_E2E_SHARD_INDEX: String(shard),
          APP_E2E_SOURCE_SHA: sha,
          APP_E2E_TEST_OUTCOME: 'success',
          GITHUB_RUN_ID: '123',
          APP_E2E_MANIFEST_PATH: manifest,
          APP_E2E_REPORT_PATH: results,
          APP_E2E_SHARD_DIRECTORY: shards,
        });
      }
      run(shards);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };

  it('accepts exactly four complete disjoint source-bound shards', () => {
    withShards((directory) =>
      expect(() => validateAppE2EShards(directory, sha, '123')).not.toThrow()
    );
  });

  it('rejects a missing shard', () => {
    withShards((directory) => {
      unlinkSync(join(directory, 'app-e2e-shard-4.json'));
      expect(() => validateAppE2EShards(directory, sha, '123')).toThrow('unvollständig');
    });
  });

  it.each([
    { shard: 1 },
    { headSha: hotfixSha },
    { runId: '456' },
    { testOutcome: 'failure' },
    { testOutcome: 'cancelled' },
    { manifestHash: 'forged' },
    { executedTestIds: [] },
    { executedTestIds: ['auth-setup:setup:passed'] },
    { executedTestIds: ['auth-setup:setup:passed', 'chromium:b:passed', 'chromium:b:passed'] },
    { executedTestIds: ['auth-setup:setup:passed', 'chromium:foreign'] },
    { executedTestIds: ['auth-setup:setup:passed', 'chromium:b:skipped'] },
    { executedTestIds: ['auth-setup:setup:passed', 'chromium:a:passed'] },
    { extra: true },
  ])('rejects incomplete, overlapping or foreign evidence %j', (patch) => {
    withShards((directory) => {
      const target = join(directory, 'app-e2e-shard-2.json');
      const evidence = JSON.parse(readFileSync(target, 'utf8'));
      writeFileSync(target, JSON.stringify({ ...evidence, ...patch }));
      expect(() => validateAppE2EShards(directory, sha, '123')).toThrow();
    });
  });

  it.each([false, true])(
    'allows repeated attempts only for an explicitly retryable diagnostic (%s)',
    (allowRetry) => {
      withShards((directory) => {
        const results = report(['d']);
        results.suites[1].specs[0].tests[0].results = [{ status: 'failed' }, { status: 'passed' }];
        const reportPath = join(directory, '..', 'results.json');
        writeFileSync(reportPath, JSON.stringify(results));
        const write = () =>
          writeAppE2EShardEvidenceFromEnvironment({
            APP_E2E_SHARD_INDEX: '4',
            APP_E2E_SOURCE_SHA: sha,
            APP_E2E_TEST_OUTCOME: 'success',
            APP_E2E_ALLOW_RETRY: String(allowRetry),
            GITHUB_RUN_ID: '123',
            APP_E2E_MANIFEST_PATH: join(directory, '..', 'manifest.json'),
            APP_E2E_REPORT_PATH: reportPath,
            APP_E2E_SHARD_DIRECTORY: directory,
          });
        if (allowRetry) expect(write).not.toThrow();
        else expect(write).toThrow();
      });
    }
  );

  it('preserves completed shard tests when later job cleanup fails', () => {
    withShards((directory) => {
      const output = writeAppE2EEvidenceFromEnvironment({
        GITHUB_WORKFLOW: 'App E2E',
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF: 'refs/heads/main',
        GITHUB_REF_NAME: 'main',
        GITHUB_SHA: sha,
        GITHUB_RUN_ID: '123',
        GITHUB_RUN_ATTEMPT: '1',
        APP_E2E_RESULT: 'failure',
        APP_E2E_TEST_OUTCOME: 'failure',
        APP_E2E_SHARD_DIRECTORY: directory,
        RUNNER_TEMP: directory,
      });
      expect(parseAppE2EEvidence(JSON.parse(readFileSync(output, 'utf8')))).toMatchObject({
        result: 'failure',
        testOutcome: 'success',
        evidenceClass: 'canonical-main',
      });
    });
  });

  it('refuses to publish final evidence when shard validation fails', () => {
    withShards((directory) => {
      expect(() =>
        writeAppE2EEvidenceFromEnvironment({
          GITHUB_WORKFLOW: 'App E2E',
          GITHUB_EVENT_NAME: 'push',
          GITHUB_REF: 'refs/heads/main',
          GITHUB_REF_NAME: 'main',
          GITHUB_SHA: hotfixSha,
          GITHUB_RUN_ID: '123',
          GITHUB_RUN_ATTEMPT: '1',
          APP_E2E_RESULT: 'success',
          APP_E2E_TEST_OUTCOME: 'success',
          APP_E2E_SHARD_DIRECTORY: directory,
          RUNNER_TEMP: directory,
        })
      ).toThrow();
    });
  });
});
