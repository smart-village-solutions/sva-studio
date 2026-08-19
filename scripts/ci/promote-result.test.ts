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
const mainE2EAttestation = {
  schemaVersion: 1,
  workflow: 'App E2E',
  event: 'push',
  ref: 'refs/heads/main',
  branch: 'main',
  headSha: otherSha,
  run: { id: '987654', attempt: 2 },
  result: 'success',
  testOutcome: 'success',
  evidenceClass: 'canonical-main',
  subject: {
    kind: 'local-app-service-stack',
    app: 'sva-studio-react',
    services: ['redis', 'loki', 'otel-collector', 'promtail'],
    containerArtifactVerified: false,
  },
} as const;

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
    ['PROMOTE_CANDIDATE_JOB_FAILED', 'candidate-preflight'],
    ['PROMOTE_MIGRATION_FAILED', 'migration'],
    ['PROMOTE_BOOTSTRAP_FAILED', 'bootstrap'],
  ] as const)('defines the stable %s one-shot contract', (code, phase) => {
    expect(buildPromoteFailure({ code, environment: 'staging', phase })).toMatchObject({
      code,
      phase,
      retryable: false,
    });
  });
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
        'mode',
        'recoveryReasonProvided',
        'git',
        'image',
        'config',
        'backupAgent',
        'mainE2E',
        'rollback',
        'recovery',
        'seedPreparation',
        'seedAuthorization',
        'gates',
        'terminalFailure',
      ]);
      expect(persisted.mainE2E).toBeNull();
      expect(persisted.schemaVersion).toBe(2);
      expect(readFileSync(summaryPath, 'utf8')).toContain('## Promote-Evidenz');
      expect(stdout).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('projects only the allowlisted recovery and previous-config contract', () => {
    const recoveryReason = 'person@example.test https://internal.example.test secret=value';
    const evidence = buildPromoteEvidence({
      runId: '124',
      runAttempt: 2,
      environment: 'prod',
      status: 'passed',
      promoteMode: 'recovery',
      recoveryReasonProvided: true,
      baseRef: 'origin/main',
      headRef: 'feature/recovery',
      baseSha: sha,
      headSha: otherSha,
      previousImage: `registry.example/studio@${digest}`,
      targetImage: digest,
      imageRevision: configRevision,
      configRevision,
      previousConfigRevision: 'e'.repeat(64),
      recoveryContract: {
        mode: 'recovery',
        reasonRecorded: true,
        previousDigest: digest,
        previousConfigRevision: 'e'.repeat(64),
        sameDigestRetry: {
          authorization: 'documented-cause',
          previousFailureCode: null,
        },
        recoveryReason,
        secretSnapshot: 'sentinel-secret',
      },
      gates: [{ gate: 'deploy', phase: 'deploy', status: 'passed' }],
    });
    const surfaces = [JSON.stringify(evidence), renderPromoteSummary(evidence)];

    expect(evidence.config.previousRevision).toBe('e'.repeat(64));
    expect(evidence.rollback).toEqual({
      imageDigest: digest,
      configRevision: 'e'.repeat(64),
    });
    expect(evidence.recovery).toEqual({
      mode: 'recovery',
      reasonRecorded: true,
      previousDigest: digest,
      previousConfigRevision: 'e'.repeat(64),
      sameDigestRetry: {
        authorization: 'documented-cause',
        previousFailureCode: null,
      },
    });
    for (const surface of surfaces) {
      expect(surface).not.toContain(recoveryReason);
      expect(surface).not.toContain('sentinel-secret');
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
    expect(evidence.rollback).toBeNull();
  });

  it('does not claim rollback readiness from an unpaired live digest', () => {
    const evidence = buildPromoteEvidence({
      runId: '8',
      runAttempt: 1,
      environment: 'prod',
      status: 'failed',
      baseRef: 'origin/main',
      headRef: 'feature/promote',
      previousImage: digest,
      targetImage: `sha256:${'e'.repeat(64)}`,
      gates: [{ gate: 'recovery-contract', phase: 'static-preflight', status: 'failed' }],
    });

    expect(evidence.image.previousDigest).toBe(digest);
    expect(evidence.config.previousRevision).toBeNull();
    expect(evidence.rollback).toBeNull();
  });

  it('records a separate allowlisted seed authorization without inventing rollback readiness', () => {
    const seedAuthorization = {
      authorization: 'staging-legacy-config-label-v1' as const,
      evidenceRun: { id: '123456', attempt: 1 },
      sourceSha: otherSha,
      imageDigest: digest,
      configRevision,
      actor: 'person@example.test',
      artifactUrl: 'https://internal.example.test/evidence',
    };
    const evidence = buildPromoteEvidence({
      runId: '8',
      runAttempt: 2,
      environment: 'staging',
      status: 'passed',
      baseRef: otherSha,
      headRef: otherSha,
      baseSha: otherSha,
      headSha: otherSha,
      previousImage: digest,
      targetImage: digest,
      imageRevision: otherSha,
      configRevision,
      seedAuthorization,
      gates: [
        { gate: 'legacy-config-seed', phase: 'static-preflight', status: 'passed' },
        { gate: 'legacy-config-seed-recheck', phase: 'static-preflight', status: 'passed' },
      ],
    });

    expect(evidence.seedAuthorization).toEqual({
      authorization: 'staging-legacy-config-label-v1',
      evidenceRun: { id: '123456', attempt: 1 },
      sourceSha: otherSha,
      imageDigest: digest,
      configRevision,
    });
    expect(evidence.config.previousRevision).toBeNull();
    expect(evidence.rollback).toBeNull();
    expect(JSON.stringify(evidence)).not.toMatch(/person@example\.test|internal\.example\.test/u);
    expect(renderPromoteSummary(evidence)).toContain('| seed_evidence_run | 123456/1 |');
  });

  it('rejects seed evidence authorized by the wrong or multiple environment gates', () => {
    const productionAuthorization = {
      authorization: 'production-legacy-config-label-v1' as const,
      evidenceRun: { id: '123456', attempt: 1 },
      sourceSha: otherSha,
      imageDigest: digest,
      configRevision,
    };
    const base = {
      runId: '8',
      runAttempt: 2,
      environment: 'prod' as const,
      status: 'passed' as const,
      baseRef: otherSha,
      headRef: otherSha,
      baseSha: otherSha,
      headSha: otherSha,
      previousImage: digest,
      targetImage: digest,
      imageRevision: otherSha,
      configRevision,
      seedAuthorization: productionAuthorization,
    };
    expect(() =>
      buildPromoteEvidence({
        ...base,
        gates: [{ gate: 'legacy-config-seed', phase: 'static-preflight', status: 'passed' }],
      })
    ).toThrow('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
    expect(() =>
      buildPromoteEvidence({
        ...base,
        gates: [
          { gate: 'legacy-config-seed', phase: 'static-preflight', status: 'passed' },
          { gate: 'production-config-seed', phase: 'static-preflight', status: 'passed' },
        ],
      })
    ).toThrow('mehrere autorisierende Gates');
  });

  it('records the allowlisted Prepare marker only with its passed gate', () => {
    const seedPreparation = {
      contract: 'staging-live-config-label-prepare-v1',
      sourceSha: otherSha,
      imageDigest: digest,
      configRevision,
      liveConfigRevisionState: 'missing',
      backupExecutor: 'agent',
      actor: 'person@example.test',
    };
    const evidence = buildPromoteEvidence({
      runId: '7',
      runAttempt: 1,
      environment: 'staging',
      status: 'failed',
      baseRef: otherSha,
      headRef: otherSha,
      headSha: otherSha,
      targetImage: digest,
      configRevision,
      seedPreparation,
      gates: [
        {
          gate: 'legacy-config-seed-preparation',
          phase: 'static-preflight',
          status: 'passed',
        },
      ],
    });
    expect(evidence.seedPreparation).toEqual({
      contract: 'staging-live-config-label-prepare-v1',
      sourceSha: otherSha,
      imageDigest: digest,
      configRevision,
      liveConfigRevisionState: 'missing',
      backupExecutor: 'agent',
    });
    expect(JSON.stringify(evidence)).not.toContain('person@example.test');
    expect(() =>
      buildPromoteEvidence({
        runId: '7',
        runAttempt: 1,
        environment: 'staging',
        status: 'failed',
        baseRef: otherSha,
        headRef: otherSha,
        headSha: otherSha,
        targetImage: digest,
        configRevision,
        seedPreparation,
        gates: [],
      })
    ).toThrow('Seed-Vorbereitung widerspricht dem Gate-Vertrag.');
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
        PROMOTE_HEAD_SHA: otherSha,
        PROMOTE_BACKUP_AGENT: JSON.stringify(capabilities),
        PROMOTE_MAIN_E2E_REFERENCE: JSON.stringify(mainE2EAttestation),
        PROMOTE_GATE_MAIN_E2E_EVIDENCE: 'success',
        PROMOTE_GATE_BACKUP_CAPABILITIES: 'success',
      });
      expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toMatchObject({
        backupAgent: {
          resultFields: expect.arrayContaining(['deployImageDigest', 'objectKey', 'requestId']),
        },
        mainE2E: {
          run: { id: '987654', attempt: 2 },
          headSha: otherSha,
          result: 'success',
          testOutcome: 'success',
          evidenceClass: 'canonical-main',
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
        PROMOTE_HEAD_SHA: otherSha,
        PROMOTE_MAIN_E2E_REFERENCE: JSON.stringify(mainE2EAttestation),
        PROMOTE_GATE_MAIN_E2E_EVIDENCE: 'failure',
        PROMOTE_GATE_MAIN_E2E_EVIDENCE_BLOCKING: 'false',
      });
      const evidence = JSON.parse(readFileSync(outputPath, 'utf8')) as {
        gates: Array<{ gate: string; status: string; blocking: boolean }>;
        mainE2E: unknown;
        terminalFailure: unknown;
      };
      expect(evidence.gates.find((gate) => gate.gate === 'main-e2e-evidence')).toEqual({
        gate: 'main-e2e-evidence',
        phase: 'main-e2e-evidence',
        status: 'failed',
        blocking: false,
      });
      expect(evidence.mainE2E).toBeNull();
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

  it('keeps a valid Main-E2E reference when a later gate fails', () => {
    const failure = buildPromoteFailure({
      code: 'PROMOTE_LIVE_DIGEST_MISMATCH',
      environment: 'staging',
      phase: 'digest-verification',
    });
    const evidence = buildPromoteEvidence({
      runId: '795',
      runAttempt: 1,
      environment: 'staging',
      status: 'failed',
      baseRef: 'origin/main',
      headRef: 'main',
      headSha: otherSha,
      mainE2EReference: mainE2EAttestation,
      gates: [
        {
          gate: 'main-e2e-evidence',
          phase: 'main-e2e-evidence',
          status: 'passed',
        },
        {
          gate: 'digest-verification',
          phase: 'digest-verification',
          status: 'failed',
        },
      ],
      recordedFailure: failure,
    });

    expect(evidence.mainE2E).toEqual({
      run: { id: '987654', attempt: 2 },
      headSha: otherSha,
      result: 'success',
      testOutcome: 'success',
      evidenceClass: 'canonical-main',
    });
    expect(evidence.terminalFailure).toEqual(failure);
    const summary = renderPromoteSummary(evidence);
    expect(summary).toContain('| main_e2e_run | 987654/2 |');
    expect(summary).toContain(`| main_e2e_head_sha | ${otherSha} |`);
    expect(summary).toContain('| main_e2e_result | success |');
    expect(summary).toContain('| main_e2e_test_outcome | success |');
    expect(summary).toContain('| main_e2e_evidence_class | canonical-main |');
  });

  it('drops invalid Main-E2E output without leaking untrusted fields', () => {
    const directory = mkdtempSync(join(tmpdir(), 'promote-invalid-main-e2e-'));
    const summaryPath = join(directory, 'summary.md');
    try {
      const outputPath = writePromoteEvidenceFromEnvironment({
        RUNNER_TEMP: directory,
        GITHUB_RUN_ID: '796',
        GITHUB_RUN_ATTEMPT: '1',
        GITHUB_STEP_SUMMARY: summaryPath,
        PROMOTE_ENVIRONMENT: 'staging',
        PROMOTE_JOB_STATUS: 'success',
        PROMOTE_BASE_REF: 'origin/main',
        PROMOTE_HEAD_REF: 'main',
        PROMOTE_HEAD_SHA: otherSha,
        PROMOTE_MAIN_E2E_REFERENCE: JSON.stringify({
          ...mainE2EAttestation,
          run: { id: 'not-a-run', attempt: 2 },
          privateValue: 'top-secret-value',
        }),
        PROMOTE_GATE_MAIN_E2E_EVIDENCE: 'success',
      });
      const serialized = readFileSync(outputPath, 'utf8');
      const summary = readFileSync(summaryPath, 'utf8');

      expect(JSON.parse(serialized)).toMatchObject({ mainE2E: null });
      expect(summary).toContain('| main_e2e_run | not-evaluated |');
      expect(serialized).not.toContain('top-secret-value');
      expect(summary).not.toContain('top-secret-value');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
