import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildAppE2EEvidence, writeAppE2EEvidenceFromEnvironment } from './app-e2e-evidence.ts';

const sha = 'a'.repeat(40);
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
      failureClass: 'none',
      headSha: sha,
      result: 'success',
      subject: { kind: 'local-app-service-stack', containerArtifactVerified: false },
      rerunPolicy: { automaticSuccessRetry: false },
    });
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

  it('keeps a deterministic test failure red after finalization', () => {
    const evidence = buildAppE2EEvidence({
      ...canonicalInput,
      result: 'failure',
      testOutcome: 'failure',
    });
    expect(evidence).toMatchObject({ result: 'failure', failureClass: 'test' });
  });

  it('classifies a failure before test execution as infrastructure setup', () => {
    const evidence = buildAppE2EEvidence({
      ...canonicalInput,
      result: 'failure',
      testOutcome: '',
    });
    expect(evidence).toMatchObject({
      result: 'failure',
      failureClass: 'infrastructure-setup',
    });
  });

  it('retains run identity and distinguishes a manual rerun attempt', () => {
    const first = buildAppE2EEvidence({
      ...canonicalInput,
      result: 'failure',
      testOutcome: 'failure',
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
        'failureClass',
        'evidenceClass',
        'subject',
        'rerunPolicy',
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
});
