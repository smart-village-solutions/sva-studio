import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildPromoteEvidence,
  renderPromoteAnnotation,
  renderPromoteSummary,
  writePromoteEvidence,
  writePromoteEvidenceFromEnvironment,
} from './promote-evidence.ts';
import {
  PromoteContractError,
  parsePromoteFailure,
  redactPromoteFailure,
} from './promote-result.ts';

const sha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);
const digest = `sha256:${'c'.repeat(64)}`;
const configRevision = 'd'.repeat(64);

const sentinelValues = [
  'top-secret-value',
  'secret-hash-sentinel',
  'secret-length-sentinel',
  'environment-dump-sentinel',
  'remote-log-sentinel',
  'person@example.test',
  'private stack trace',
];

describe('promote evidence contract', () => {
  it('uses one canonical redacted failure for JSON, annotation, and summary', () => {
    const untrustedFailure = {
      code: 'PROMOTE_CONFIG_INVALID' as const,
      environment: 'prod' as const,
      phase: 'config-build' as const,
      summary: sentinelValues.join(' '),
      retryable: true,
      nextAction: sentinelValues.join(' '),
      secretHash: 'secret-hash-sentinel',
      valueLength: 9001,
      logs: 'remote-log-sentinel',
    };
    const failure = redactPromoteFailure(new PromoteContractError(untrustedFailure), {
      environment: 'prod',
      phase: 'config-build',
    });
    const evidence = buildPromoteEvidence({
      runId: '123456',
      runAttempt: 2,
      environment: 'prod',
      status: 'failed',
      baseSha: sha,
      headSha: otherSha,
      previousImage: `registry.example/studio@${digest}`,
      targetImage: digest,
      imageRevision: 'e'.repeat(64),
      configRevision,
      externalSecretReferences: ['waste_database_password_v2'],
      backupAgent: {
        agentRevision: `registry.example/backup@${digest}`,
        protocolVersions: [2],
        databaseTargets: ['studio'],
        resultFields: ['status'],
        wasteInventory: false,
        secretHash: 'secret-hash-sentinel',
      } as never,
      gates: [{ phase: 'config-build', status: 'failed' }],
      recordedFailure: parsePromoteFailure(untrustedFailure),
    });
    const json = JSON.stringify(evidence);
    const summary = renderPromoteSummary(evidence);
    const annotation = renderPromoteAnnotation(evidence) ?? '';

    expect(evidence.terminalFailure).toBe(evidence.gates[0]?.failure);
    expect(evidence.terminalFailure).toEqual(failure);
    expect(json).toContain('PROMOTE_CONFIG_INVALID');
    expect(summary).toContain('PROMOTE_CONFIG_INVALID');
    expect(annotation).toContain('PROMOTE_CONFIG_INVALID');
    expect(json).not.toMatch(/secretHash|secretLength|valueLength|logs|logTail|environmentDump/u);
    for (const sentinel of sentinelValues) {
      expect(json).not.toContain(sentinel);
      expect(summary).not.toContain(sentinel);
      expect(annotation).not.toContain(sentinel);
    }
  });

  it('maps unknown exceptions to PROMOTE_INTERNAL_ERROR without exception details', () => {
    const failure = redactPromoteFailure(new Error(sentinelValues.join('\n')), {
      environment: 'staging',
      phase: 'deploy',
    });
    const evidence = buildPromoteEvidence({
      runId: '99',
      runAttempt: 1,
      environment: 'staging',
      status: 'failed',
      baseSha: sha,
      headSha: otherSha,
      gates: [{ phase: 'deploy', status: 'failed' }],
      recordedFailure: failure,
    });
    const surfaces = [
      JSON.stringify(evidence),
      renderPromoteSummary(evidence),
      renderPromoteAnnotation(evidence) ?? '',
    ];

    expect(failure.code).toBe('PROMOTE_INTERNAL_ERROR');
    for (const surface of surfaces) {
      expect(surface).toContain('PROMOTE_INTERNAL_ERROR');
      for (const sentinel of sentinelValues) expect(surface).not.toContain(sentinel);
    }
  });

  it('writes only the allowlisted versioned evidence shape', () => {
    const directory = mkdtempSync(join(tmpdir(), 'promote-evidence-'));
    const outputPath = join(directory, 'evidence.json');
    const summaryPath = join(directory, 'summary.md');
    const stdout: string[] = [];
    try {
      const evidence = buildPromoteEvidence({
        runId: '123',
        runAttempt: 1,
        environment: 'dev',
        status: 'passed',
        baseSha: sha,
        headSha: otherSha,
        targetImage: digest,
        imageRevision: configRevision,
        configRevision,
        gates: [{ phase: 'deploy', status: 'passed' }],
      });
      writePromoteEvidence(evidence, {
        outputPath,
        summaryPath,
        stdout: {
          write: (value) => {
            stdout.push(String(value));
            return true;
          },
        },
      });
      const persisted = JSON.parse(readFileSync(outputPath, 'utf8')) as Record<string, unknown>;

      expect(Object.keys(persisted)).toEqual([
        'schemaVersion',
        'run',
        'environment',
        'status',
        'git',
        'image',
        'config',
        'backupAgent',
        'gates',
        'terminalFailure',
      ]);
      expect(readFileSync(summaryPath, 'utf8')).toContain('## Promote-Evidenz');
      expect(stdout).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('represents mutable Dev images without inventing an immutable digest', () => {
    const evidence = buildPromoteEvidence({
      runId: '7',
      runAttempt: 1,
      environment: 'dev',
      status: 'passed',
      baseSha: sha,
      headSha: otherSha,
      targetImage: 'not-pinned',
      imageRevision: 'latest',
      gates: [{ phase: 'deploy', status: 'passed' }],
    });

    expect(evidence.image).toEqual({ previousDigest: null, targetDigest: null, revision: 'latest' });
  });

  it('builds the final workflow artifact from allowlisted step outputs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'promote-workflow-evidence-'));
    const summaryPath = join(directory, 'summary.md');
    const githubOutput = join(directory, 'github-output');
    try {
      const outputPath = writePromoteEvidenceFromEnvironment({
        RUNNER_TEMP: directory,
        GITHUB_RUN_ID: '456',
        GITHUB_RUN_ATTEMPT: '3',
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_OUTPUT: githubOutput,
        PROMOTE_ENVIRONMENT: 'staging',
        PROMOTE_JOB_STATUS: 'success',
        PROMOTE_BASE_SHA: sha,
        PROMOTE_HEAD_SHA: otherSha,
        PROMOTE_TARGET_IMAGE: digest,
        PROMOTE_IMAGE_REVISION: configRevision,
        PROMOTE_CONFIG_REVISION: configRevision,
        PROMOTE_SECRET_REFERENCES: '["waste_database_password_v2"]',
        PROMOTE_GATE_CONFIG_BUILD: 'success',
        PROMOTE_GATE_STATIC_PREFLIGHT: 'success',
        PROMOTE_GATE_DEPLOY: 'success',
      });
      const evidence = JSON.parse(readFileSync(outputPath, 'utf8')) as {
        status: string;
        terminalFailure: unknown;
      };

      expect(evidence).toMatchObject({ status: 'passed', terminalFailure: null });
      expect(readFileSync(summaryPath, 'utf8')).toContain('| target_digest |');
      expect(readFileSync(githubOutput, 'utf8')).toContain(`evidence_path=${outputPath}`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
