import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  buildPromoteFailure,
  PromoteContractError,
  redactPromoteFailure,
  writePromoteFailureRecord,
} from './promote-result.ts';
import { validateBackupAgentCapabilities } from './verify-backup-agent-capabilities.ts';

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
  it.each([
    ['PROMOTE_MAIN_E2E_NOT_READY', true],
    ['PROMOTE_MAIN_E2E_REJECTED', false],
    ['PROMOTE_MAIN_E2E_LOOKUP_FAILED', true],
  ] as const)('defines the stable %s failure contract', (code, retryable) => {
    expect(
      buildPromoteFailure({ code, environment: 'staging', phase: 'main-e2e-evidence' })
    ).toMatchObject({ code, retryable, phase: 'main-e2e-evidence' });
  });

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
      baseRef: 'origin/main',
      headRef: 'feature/promote',
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
      gates: [{ gate: 'config-build', phase: 'config-build', status: 'failed' }],
      recordedFailure: untrustedFailure,
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
      baseRef: 'origin/main',
      headRef: 'feature/promote',
      baseSha: sha,
      headSha: otherSha,
      gates: [{ gate: 'deploy', phase: 'deploy', status: 'failed' }],
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
        baseRef: 'origin/main',
        headRef: 'feature/promote',
        baseSha: sha,
        headSha: otherSha,
        targetImage: digest,
        imageRevision: configRevision,
        configRevision,
        gates: [{ gate: 'deploy', phase: 'deploy', status: 'passed' }],
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
      baseRef: 'origin/main',
      headRef: 'feature/promote',
      baseSha: sha,
      headSha: otherSha,
      targetImage: 'not-pinned',
      imageRevision: 'latest',
      gates: [{ gate: 'deploy', phase: 'deploy', status: 'passed' }],
    });

    expect(evidence.image).toEqual({
      previousDigest: null,
      targetDigest: null,
      revision: 'latest',
    });
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
        PROMOTE_BASE_REF: 'origin/main',
        PROMOTE_HEAD_REF: 'feature/promote',
        PROMOTE_BASE_SHA: sha,
        PROMOTE_HEAD_SHA: otherSha,
        PROMOTE_TARGET_IMAGE: digest,
        PROMOTE_IMAGE_REVISION: configRevision,
        PROMOTE_CONFIG_REVISION: configRevision,
        PROMOTE_SECRET_REFERENCES: '["waste_database_password_v2"]',
        PROMOTE_GATE_CONFIG_BUILD: 'success',
        PROMOTE_GATE_MAIN_E2E_EVIDENCE: 'success',
        PROMOTE_GATE_STATIC_PREFLIGHT: 'success',
        PROMOTE_GATE_DEPLOY: 'success',
      });
      const evidence = JSON.parse(readFileSync(outputPath, 'utf8')) as {
        status: string;
        terminalFailure: unknown;
      };

      expect(evidence).toMatchObject({ status: 'passed', terminalFailure: null });
      expect((evidence as { gates?: Array<{ gate: string }> }).gates).toContainEqual(
        expect.objectContaining({ gate: 'main-e2e-evidence' })
      );
      expect(readFileSync(summaryPath, 'utf8')).toContain('| target_digest |');
      expect(readFileSync(githubOutput, 'utf8')).toContain(`evidence_path=${outputPath}`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('writes evidence when source resolution failed before a SHA was available', () => {
    const directory = mkdtempSync(join(tmpdir(), 'promote-source-failure-'));
    const failurePath = join(directory, 'failure.json');
    try {
      const failure = {
        code: 'PROMOTE_SOURCE_CONTRACT_INVALID',
        environment: 'prod',
        phase: 'source-contract',
      } as const;
      const canonical = redactPromoteFailure(new PromoteContractError(failure as never), {
        environment: 'prod',
        phase: 'source-contract',
      });
      writeFileSync(failurePath, JSON.stringify(canonical));
      const outputPath = writePromoteEvidenceFromEnvironment({
        RUNNER_TEMP: directory,
        GITHUB_RUN_ID: '789',
        GITHUB_RUN_ATTEMPT: '1',
        PROMOTE_ENVIRONMENT: 'prod',
        PROMOTE_JOB_STATUS: 'failure',
        PROMOTE_BASE_REF: 'origin/main',
        PROMOTE_HEAD_REF: 'missing/head',
        PROMOTE_GATE_SOURCE: 'failure',
        PROMOTE_FAILURE_PATH: failurePath,
      });
      const evidence = JSON.parse(readFileSync(outputPath, 'utf8')) as {
        git: { baseSha: null; headSha: null };
        terminalFailure: { code: string };
      };
      expect(evidence.git).toMatchObject({ baseSha: null, headSha: null });
      expect(evidence.terminalFailure.code).toBe('PROMOTE_SOURCE_CONTRACT_INVALID');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('normalizes an invalid workflow-call environment without losing terminal evidence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'promote-invalid-environment-'));
    const failurePath = join(directory, 'failure.json');
    try {
      writePromoteFailureRecord(
        buildPromoteFailure({
          code: 'PROMOTE_INPUT_INVALID',
          environment: 'invalid',
          phase: 'input-validation',
        }),
        failurePath
      );
      const outputPath = writePromoteEvidenceFromEnvironment({
        RUNNER_TEMP: directory,
        GITHUB_RUN_ID: '790',
        GITHUB_RUN_ATTEMPT: '1',
        PROMOTE_ENVIRONMENT: 'person@example.test',
        PROMOTE_JOB_STATUS: 'failure',
        PROMOTE_BASE_REF: 'origin/main',
        PROMOTE_HEAD_REF: 'feature/promote',
        PROMOTE_GATE_INPUT: 'failure',
        PROMOTE_FAILURE_PATH: failurePath,
      });
      const serialized = readFileSync(outputPath, 'utf8');
      expect(JSON.parse(serialized)).toMatchObject({
        environment: 'invalid',
        terminalFailure: { code: 'PROMOTE_INPUT_INVALID', environment: 'invalid' },
      });
      expect(serialized).not.toContain('person@example.test');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('round-trips the live backup capability contract into final evidence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'promote-capability-roundtrip-'));
    try {
      const capabilities = validateBackupAgentCapabilities(
        'staging',
        {
          protocolVersions: [2],
          agentRevision: `registry.example/backup@${digest}`,
          databaseTargets: ['studio', 'waste'],
          resultFields: [
            'bytes',
            'database',
            'deployImageDigest',
            'environment',
            'objectKey',
            'requestId',
            'sha256',
            'status',
            'steps',
          ],
          wasteInventory: true,
        },
        true
      );
      const outputPath = writePromoteEvidenceFromEnvironment({
        RUNNER_TEMP: directory,
        GITHUB_RUN_ID: '791',
        GITHUB_RUN_ATTEMPT: '1',
        PROMOTE_ENVIRONMENT: 'staging',
        PROMOTE_JOB_STATUS: 'success',
        PROMOTE_BASE_REF: 'origin/main',
        PROMOTE_HEAD_REF: 'feature/promote',
        PROMOTE_BACKUP_AGENT: JSON.stringify(capabilities),
        PROMOTE_GATE_BACKUP_CAPABILITIES: 'success',
      });
      expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toMatchObject({
        backupAgent: {
          resultFields: expect.arrayContaining(['deployImageDigest', 'objectKey', 'requestId']),
        },
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps an observed shadow failure honest without making it terminal', () => {
    const directory = mkdtempSync(join(tmpdir(), 'promote-shadow-gate-'));
    try {
      const outputPath = writePromoteEvidenceFromEnvironment({
        RUNNER_TEMP: directory,
        GITHUB_RUN_ID: '792',
        GITHUB_RUN_ATTEMPT: '1',
        PROMOTE_ENVIRONMENT: 'staging',
        PROMOTE_JOB_STATUS: 'success',
        PROMOTE_BASE_REF: 'origin/main',
        PROMOTE_HEAD_REF: 'feature/promote',
        PROMOTE_GATE_CANDIDATE_PREFLIGHT: 'failure',
        PROMOTE_GATE_CANDIDATE_PREFLIGHT_BLOCKING: 'false',
      });
      const evidence = JSON.parse(readFileSync(outputPath, 'utf8')) as {
        gates: Array<{ gate: string; status: string; blocking: boolean; failure?: unknown }>;
        terminalFailure: unknown;
      };
      expect(evidence.gates.find((gate) => gate.gate === 'candidate-preflight')).toEqual({
        gate: 'candidate-preflight',
        phase: 'candidate-preflight',
        status: 'failed',
        blocking: false,
      });
      expect(evidence.terminalFailure).toBeNull();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('records a shadow Main-E2E rejection without making a successful staging workflow terminal', () => {
    const directory = mkdtempSync(join(tmpdir(), 'promote-main-e2e-shadow-'));
    try {
      const outputPath = writePromoteEvidenceFromEnvironment({
        RUNNER_TEMP: directory,
        GITHUB_RUN_ID: '793',
        GITHUB_RUN_ATTEMPT: '1',
        PROMOTE_ENVIRONMENT: 'staging',
        PROMOTE_JOB_STATUS: 'success',
        PROMOTE_BASE_REF: 'origin/main',
        PROMOTE_HEAD_REF: 'feature/promote',
        PROMOTE_GATE_MAIN_E2E_EVIDENCE: 'failure',
        PROMOTE_GATE_MAIN_E2E_EVIDENCE_BLOCKING: 'false',
      });
      const evidence = JSON.parse(readFileSync(outputPath, 'utf8')) as {
        gates: Array<{ gate: string; status: string; blocking: boolean }>;
        terminalFailure: unknown;
      };
      expect(evidence.gates.find((gate) => gate.gate === 'main-e2e-evidence')).toEqual({
        gate: 'main-e2e-evidence',
        phase: 'main-e2e-evidence',
        status: 'failed',
        blocking: false,
      });
      expect(evidence.terminalFailure).toBeNull();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('makes an enforced Main-E2E rejection terminal with the same stable failure', () => {
    const failure = buildPromoteFailure({
      code: 'PROMOTE_MAIN_E2E_REJECTED',
      environment: 'staging',
      phase: 'main-e2e-evidence',
    });
    const evidence = buildPromoteEvidence({
      runId: '794',
      runAttempt: 1,
      environment: 'staging',
      status: 'failed',
      baseRef: 'origin/main',
      headRef: 'feature/promote',
      gates: [
        {
          gate: 'main-e2e-evidence',
          phase: 'main-e2e-evidence',
          status: 'failed',
          blocking: true,
        },
      ],
      recordedFailure: failure,
    });
    expect(evidence.terminalFailure).toEqual(failure);
    expect(evidence.gates[0]?.failure).toBe(evidence.terminalFailure);
  });

  it('makes the same failed gate terminal when enforcement is enabled', () => {
    const failure = buildPromoteFailure({
      code: 'PROMOTE_PREFLIGHT_CONFIG_INVALID',
      environment: 'staging',
      phase: 'candidate-preflight',
    });
    const evidence = buildPromoteEvidence({
      runId: '793',
      runAttempt: 1,
      environment: 'staging',
      status: 'failed',
      baseRef: 'origin/main',
      headRef: 'feature/promote',
      gates: [
        {
          gate: 'candidate-preflight',
          phase: 'candidate-preflight',
          status: 'failed',
          blocking: true,
        },
      ],
      recordedFailure: failure,
    });
    expect(evidence.gates[0]).toMatchObject({ status: 'failed', blocking: true, failure });
    expect(evidence.terminalFailure).toEqual(failure);
  });

  it.each([
    'PROMOTE_SMOKE_REALM_MISMATCH',
    'PROMOTE_SMOKE_CALLBACK_MISMATCH',
    'PROMOTE_READINESS_NOT_READY',
    'PROMOTE_INTERNAL_ERROR',
  ] as const)('keeps %s identical and redacted across smoke evidence surfaces', (code) => {
    const failure = buildPromoteFailure({ code, environment: 'prod', phase: 'external-smoke' });
    const evidence = buildPromoteEvidence({
      runId: '794',
      runAttempt: 1,
      environment: 'prod',
      status: 'failed',
      baseRef: 'origin/main',
      headRef: 'feature/promote',
      gates: [{ gate: 'runtime-smoke', phase: 'external-smoke', status: 'failed' }],
      recordedFailure: {
        ...failure,
        summary: sentinelValues.join('\n'),
        logs: sentinelValues,
      } as never,
    });
    const surfaces = [
      JSON.stringify(evidence),
      renderPromoteSummary(evidence),
      renderPromoteAnnotation(evidence) ?? '',
    ];
    expect(evidence.terminalFailure?.code).toBe(code);
    for (const surface of surfaces) {
      expect(surface).toContain(code);
      for (const sentinel of sentinelValues) expect(surface).not.toContain(sentinel);
    }
  });

  it.each([
    ['run id', { runId: 'person@example.test' }],
    ['base ref', { baseRef: 'https://person@example.test/repo' }],
    ['head ref', { headRef: 'feature/person@example.test' }],
    ['base sha', { baseSha: 'person@example.test' }],
    ['head sha', { headSha: 'person@example.test' }],
    ['image revision', { imageRevision: 'person@example.test' }],
    ['config revision', { configRevision: 'person@example.test' }],
    [
      'agent revision',
      {
        backupAgent: {
          agentRevision: 'person@example.test',
          protocolVersions: [2],
          databaseTargets: ['studio'],
          resultFields: ['status'],
          wasteInventory: false,
        },
      },
    ],
    [
      'database target',
      {
        backupAgent: {
          agentRevision: 'f'.repeat(40),
          protocolVersions: [2],
          databaseTargets: ['person@example.test'],
          resultFields: ['status'],
          wasteInventory: false,
        },
      },
    ],
    [
      'result field',
      {
        backupAgent: {
          agentRevision: 'f'.repeat(40),
          protocolVersions: [2],
          databaseTargets: ['studio'],
          resultFields: ['person@example.test'],
          wasteInventory: false,
        },
      },
    ],
    ['secret reference', { externalSecretReferences: ['person@example.test'] }],
    ['environment', { environment: 'person@example.test' }],
    ['status', { status: 'person@example.test' }],
    ['gate name', { gates: [{ gate: 'person@example.test', phase: 'deploy', status: 'passed' }] }],
    ['gate phase', { gates: [{ gate: 'deploy', phase: 'person@example.test', status: 'passed' }] }],
    [
      'gate status',
      { gates: [{ gate: 'deploy', phase: 'deploy', status: 'person@example.test' }] },
    ],
  ])('rejects PII in the allowlisted %s field', (_label, override) => {
    expect(() =>
      buildPromoteEvidence({
        runId: '123',
        runAttempt: 1,
        environment: 'prod',
        status: 'passed',
        baseRef: 'origin/main',
        headRef: 'feature/promote',
        baseSha: sha,
        headSha: otherSha,
        gates: [{ gate: 'deploy', phase: 'deploy', status: 'passed' }],
        ...override,
      } as never)
    ).toThrow();
  });

  it('strips arbitrary registry prefixes from published digest fields', () => {
    const evidence = buildPromoteEvidence({
      runId: '123',
      runAttempt: 1,
      environment: 'prod',
      status: 'passed',
      baseRef: 'origin/main',
      headRef: 'feature/promote',
      previousImage: `person@example.test/private@${digest}`,
      targetImage: `https://person@example.test/private@${digest}`,
      gates: [{ gate: 'deploy', phase: 'deploy', status: 'passed' }],
    });
    expect(evidence.image).toMatchObject({ previousDigest: digest, targetDigest: digest });
    expect(JSON.stringify(evidence)).not.toContain('person@example.test');
  });
});
